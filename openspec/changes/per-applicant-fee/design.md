# Design

## Context

"2 hours" is set in four places that have to agree:

- `MIN_SECONDS = 7200` in `src/lib/hackatime-shared.ts` controls which projects `eligibleProjects` lists, on the client and in `submitApplication`.
- `CREDITED_SECONDS = 7200` in `src/db/schema.ts` is written to every project row in `submitApplication`.
- The `applications_hours_match_kind` CHECK constraint requires `credited_seconds = 7200` and `snapshot >= 7200` for project rows.
- `src/lib/airtable/sync.ts` sends `cappedSeconds: CREDITED_SECONDS`, not the row's value.

How team size is known today:

- **Server:** in `submitApplication`, the Hackatime snapshot is fetched *before* the transaction. The team is locked *inside* it by `teamForSubmit`, which returns `members` (founder included) or `"stale"` when the version doesn't match what the form posted.
- **Client:** `ApplyForm` holds `team: TeamView | null` in state. `TeamSection` updates it after the founder's own actions and the "refresh" action. It doesn't poll, so a partner joining through the invite link only shows up after a refresh. If the founder submits first, the server rejects it as `"stale"`.

## Goals / Non-Goals

**Goals:**
- One fee calculation shared by the client and the server.
- The server decides the fee from the locked team. The client only shows it.
- Existing rows stay valid without a backfill.

**Non-Goals:**
- Live updates of team membership on the apply form (no polling). The stale-team check already covers it.
- Changing the aid path, the team size cap, or how partners join.
- Letting more than one project, or partners' projects, pay the fee.

## Decisions

**1. A shared `feeSeconds(teamSize)` helper in `hackatime-shared.ts`.**
`HOURS_PER_APPLICANT_SECONDS = 2 * 60 * 60`, and `feeSeconds(n) = n * HOURS_PER_APPLICANT_SECONDS` with `n >= 1`. `MIN_SECONDS` stays as the listing floor and equals `feeSeconds(1)`. `schema.ts` re-exports or imports the per-person constant so the migration and the constraint use the same number. *Alternative:* keep the calculation in the service only. Rejected because the picker, the fee step and the button all need the same number on the client.

**2. Listing stays at 2h. Selectability is a separate, team-dependent check.**
`eligibleProjects` is unchanged: it filters to at least 2h and sorts. A new `coversFee(project, teamSize)` predicate decides whether a project can be selected. `ProjectPicker` receives `teamSize` and renders projects that fall short as disabled radios with the "needs Xh for a team of N" note. *Alternative:* filter by fee in `eligibleProjects`. Rejected because projects would disappear when the team grows (option B from the exploration).

**3. Clear a selection that no longer covers the fee.**
When `team` changes in `ApplyForm`, if the selected project no longer covers `feeSeconds(teamSize)`, reset `hackatimeProject` to `""`. `missingItems` then lists "a hackatime project" in the usual way. This keeps the "still missing" logic unchanged and avoids a separate error state.

**4. Check the fee on the server inside the transaction, after `teamForSubmit`.**
`submitApplication` keeps fetching the snapshot outside the transaction. It still uses `eligibleProjects` to confirm the project exists and has at least 2h. After `teamForSubmit` returns the locked members, it computes `fee = feeSeconds(team.members.length)`. If `snapshot < fee`, it returns `{ hackatimeProject: "that project needs Xh for a team of N" }` before writing anything; returning from the transaction commits, and nothing has been written at that point. Otherwise it stores `creditedSeconds: fee`. Aid stays `null`. *Alternative:* trust a fee posted by the client. Rejected because the team can change between render and submit.

**5. Relax the CHECK constraint to "a positive multiple of 2h, covered by the snapshot".**
New migration `drizzle/0005_per_applicant_fee.sql` drops `applications_hours_match_kind` and re-adds it as:
`(kind='project' AND credited_seconds >= 7200 AND credited_seconds % 7200 = 0 AND hackatime_seconds_snapshot >= credited_seconds) OR (kind='aid' AND snapshot IS NULL AND credited_seconds IS NULL)`.
Existing rows (credited 7200, snapshot ≥ 7200) pass, so no backfill is needed. An upper bound of `4 * 7200` was considered and rejected: it would tie the constraint to `TEAM_MAX_MEMBERS` for no real safety gain. `schema.ts` is updated to match so drizzle-kit's snapshot agrees.

**6. Show stored values, not the constant.**
Airtable gets `cappedSeconds: app.creditedSeconds`. `ApplicationDetails` renders `formatHours(app.creditedSeconds)` in place of the literal "2h credited". Admin views already read the row.

**7. Copy says "2 hours per person". It doesn't use "per applicant" or "per teammate".**
"Per person on the team" makes it clear that the founder counts. "2 hours™" stays the brand unit. The landing line becomes "A project + 2 hours™ per person".

## Risks / Trade-offs

- [A founder opens the form solo, a partner joins, and the founder submits before refreshing] → The existing `"stale"` team error asks them to review the team. After the refresh, the fee and the picker update. No new mechanism is needed.
- [Hackatime time changes between the snapshot and the transaction] → The snapshot is what gets stored and checked, and it's taken once per submit. This is the same as today.
- [The migration fails on a row that already breaks the new rule] → It can't happen: every existing project row has credited = 7200 ≤ snapshot. The migration still runs inside a transaction, so a failure leaves the old constraint in place.
- [Docs (`src/content/docs.tsx`, `src/app/docs/`) are uncommitted on `main`] → This change edits the working-tree versions. Whoever applies it should commit the docs page first, or alongside this change.
- [Spec deltas modify requirements that only exist in the unarchived `incubator-fund-application` and `team-applications` changes] → Archive those first, so `openspec/specs/` has the base requirements this delta modifies.

## Migration Plan

1. Deploy the migration and the code together. The relaxed constraint accepts both old and new rows, so either order works for the DB itself.
2. Rollback: revert the code. The relaxed constraint is harmless to keep. If it's reverted too, any row submitted in the meantime with credited > 7200 would break the old constraint, so check for such rows before re-tightening it.
