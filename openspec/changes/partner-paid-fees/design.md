# Design

## Context

- **The Hackatime token is short-lived and only belongs to the user who holds it.** `readHackatimeToken(userId)` decrypts a 30-minute cookie in the current request. The founder's submit request can't see a partner's Hackatime. Partner hours have to be read in the partner's own session.
- **Teams:** `teams.version` changes on every membership or invite change, and `teamForSubmit` compares it with the version the form posted ("stale"). `team_members` rows are released, never deleted. A partner who leaves and rejoins gets a new row.
- **Applications:** the founder's project lives on `applications` (`content_enc`, `hackatime_seconds_snapshot`, `credited_seconds`, `hackatime_id_enc`, `airtable_record_id`). `application_members(application_id, user_id, role)` records who was on it. `applications_hours_match_kind` already allows any positive multiple of 7200 covered by the snapshot.
- **Review:** `decide()` writes the status, calls `onDecision` and, for fraud, bans `applications.user_id`, which is always the founder.
- **Airtable:** `syncReviewsToAirtable` makes one record per approved or cut project application, marked synced through `applications.airtable_record_id`.
- Encrypted columns are bound to `(table, column, rowId)` (`src/lib/crypto.ts`).

## Goals / Non-Goals

**Goals:**
- The founder's project keeps its current storage. Partner projects are added beside it, so existing rows, views and the founder-pays path barely change.
- The server decides readiness, distinct Hackatime accounts and credited hours. The client only shows them.
- The Airtable sync can be safely retried per record.

**Non-Goals:**
- A per-member mode, where the founder covers some partners and not others.
- Checking partner hours again at submit, which would need their token.
- Flagging the same Hackatime account across *different* applications.
- Per-member decisions or partial resubmits.

## Decisions

**1. `fee_mode` on `teams` and copied to `applications`.**
New enum `fee_mode = ('founder_pays', 'each_pays')`. `teams.fee_mode` defaults to `founder_pays`, so existing teams behave as today. `applications.fee_mode` (NOT NULL, default `founder_pays` for the backfill) is written at submit, so review, history and the sync never depend on a team row that can still change. Solo founders with no team submit `founder_pays`. The two modes are the same for a solo founder anyway. A new `setFeeMode(founder, mode)` in `teams/service.ts` checks the founder role and that the team is open, then calls `bump`. *Alternative:* store the mode only on the application. Rejected because partners have to see the mode before submit.

**2. The partner's draft project lives on their live `team_members` row.**
New nullable columns: `project_enc` (`{ hackatimeProject, codeUrl, playableUrl, description, heardFrom }`, bound to `team_members.project_enc` + row id), `project_seconds`, `project_hackatime_id_enc`, `project_saved_at`. `savePartnerProject(user, input)` runs in the partner's request:
   1. Validate with a new `validatePartnerProject` in `applications/shared.ts`. It is the project subset of `validateApplication`, with no video.
   2. Read the token, `fetchProjects` + `fetchHackatimeId`, and match against `eligibleProjects`. If Hackatime doesn't return an account id, the save is refused, because the id is needed for the distinct-account check and for Telescreen.
   3. In a transaction: lock the team, require it to be open and the user to be an active partner, write the columns, then `bump`.

   The draft is kept when the mode switches, so it survives "founder pays → each pays → founder pays". A partner who leaves loses it with their released row. *Alternative:* a separate `partner_projects` table. Rejected because the draft has exactly the lifetime of a membership row.

**3. The frozen copy goes on `application_members`.**
New nullable columns: `content_enc` (bound to rowId `${applicationId}:${userId}`), `hackatime_seconds_snapshot`, `credited_seconds`, `hackatime_id_enc`, `airtable_record_id`, `airtable_synced_at`. They are filled only for partner rows of `each_pays` applications. The founder row stays empty because the founder's project is already on `applications`. CHECK: either all project columns are NULL, or `content_enc` is not null AND `credited_seconds = 7200` AND `hackatime_seconds_snapshot >= 7200`. *Alternative:* move the founder's project onto `application_members` too, for symmetry. Rejected because it would mean a backfill, and every reader of `applications` (admin list, portal, sync) would have to change.

**4. Submit flow (`submitApplication` + `teamForSubmit`).**
`teamForSubmit` also returns `feeMode` and, for `each_pays`, each partner's draft. Inside the existing transaction, after the stale check:
- `founder_pays`: unchanged. `fee = feeSeconds(members)`, checked against the snapshot.
- `each_pays`: `fee = 7200` for the founder (`snapshot >= 7200` is already guaranteed by `eligibleProjects`). Every partner must have `project_saved_at`, otherwise `{ team: "<name> hasn't added their project yet" }`. Decrypt every member's Hackatime id (founder from this request, partners from their drafts). Any duplicate, or a missing founder id, gives `{ hackatimeProject: "each person needs their own hackatime account" }`.
- `lockForApplication` writes the partner project columns from the drafts.

The partner draft check only happens on the server. The client gets readiness from `TeamView`, which gains `feeMode` and a per-partner `ready` flag (never the content). The flag drives the "still missing" line.

**5. Version bumps catch stale forms.**
Mode switches and partner saves call `bump`. This reuses the existing refusal: "your team changed since you opened this page". No new mechanism is needed. A partner saving while the founder's form is open forces the founder to refresh, which is the right thing since the founder is about to submit that project.

**6. Fraud takes a ban target.**
`decide(id, decision, note, justification, banUserId?)`. For `reject_fraud`, `banUserId` defaults to the application's `user_id`. Inside the transaction it must exist in `application_members` for this application, otherwise the decision returns `{ error: "bad_ban_target" }` and nothing is written. `program_bans` gets that user. `DecisionForm` shows a member radio list (founder pre-selected) only for fraud on applications with more than one member. This applies in both modes.

**6a. An unbanned founder can replace a fraud-rejected application.**
`canReplace` gains `rejected_fraud`. A banned user is still stopped earlier by the existing `isBanned` checks in submit, `formTeam` and `checkInvite`, so "replaceable" only matters for founders who weren't banned. `formTeam` and `checkInvite` accept a live `rejected_fraud` application the same way they accept a cut one. Migration `0007` widens `applications_only_rejected_superseded` to allow `rejected_fraud` rows to be superseded. The fraud status box takes a `banned` flag: banned viewers keep "you can't apply again", and unbanned founders get the "not accepted, start a new application" box. *Alternative:* unlink the founder from the rejected application. Rejected because history and the admin view depend on `applications.user_id`.

**7. The Airtable sync works per record.**
The sync works on *candidates*, either the founder project on `applications` or a partner project on `application_members`, each with its own `airtable_record_id`. A candidate is pending when its application is approved or cut, it's a project application, and its own record id is null. The founder candidate uses the founder's PII and `applications` fields. A partner candidate uses the partner's PII, frozen content, snapshot and credited 7200. `buildFields` is unchanged because its input is already per person. Each batch writes back to whichever table the candidate came from, so a failure partway through only retries what's missing. `countPendingSync` counts candidates, not applications.

**8. Reuse the UI pieces.**
`ProjectPicker` is reused for partners with `teamSize = 1`, which gives the 2h floor. The partner project form is a new section on `/submissions` for active partners on an open `each_pays` team, using a server action. Admin `ApplicationDetails` renders one project block per paying member, each with its own `TelescreenLink`. `TeamSection` gains the mode toggle and ready badges.

## Risks / Trade-offs

- [Partner hours are a snapshot from save time, not from submit] → Hackatime totals only go up in practice, and the snapshot is what gets credited and reviewed. Telescreen gives reviewers the live view.
- [A partner's Hackatime cookie expires (30 min) before they save] → The save returns the existing "reconnect hackatime" error, and the form sends them through the Hackatime connect flow with a return path.
- [Frequent partner edits keep making the founder's form stale] → Only saves bump the version, not keystrokes. The stale message already shows the current team.
- [Two Hack Club accounts each connected the same Hackatime account] → This is exactly what the distinct-id check refuses at submit.
- [Partial Airtable failure leaves an application half-synced] → Each record tracks its own sync, and the admin page shows how many records are pending, not applications.
- [The base specs exist only in unarchived changes] → Archive `incubator-fund-application`, `team-applications` and `per-applicant-fee` before this change archives.

## Migration Plan

1. Migration `0007` relaxes `applications_only_rejected_superseded` to include `rejected_fraud`. It only widens what's allowed, so existing rows pass.
2. Migration `0006_partner_paid_fees.sql`: create the `fee_mode` enum; add `teams.fee_mode` (default `founder_pays`); add `applications.fee_mode` NOT NULL default `founder_pays` (this backfills existing rows); add the `team_members` draft columns and the `application_members` project and Airtable columns with their CHECK. Every addition is nullable or has a default, so no data rewrite is needed.
3. Deploy the migrations and the code together. Old code ignores the new columns.
4. Rollback: revert the code. The columns can stay. If `each_pays` applications were submitted in the meantime, their partner projects stay in `application_members` but old code won't show them, so look for them before dropping any columns.
