# Tasks

## 1. Data model

- [x] 1.1 Add the `fee_mode` enum, `teams.fee_mode`, `applications.fee_mode`, the `team_members` draft columns (`project_enc`, `project_seconds`, `project_hackatime_id_enc`, `project_saved_at`) and the `application_members` project and Airtable columns, with their CHECK, to `src/db/schema.ts`. Verify `npm run typecheck` passes.
- [x] 1.2 Generate `drizzle/0006_partner_paid_fees.sql` (enum, columns, defaults, CHECK). Verify it applies to a database with existing applications, that the old rows read back as `founder_pays`, and that the drizzle snapshot matches `schema.ts` (`drizzle-kit check`).

## 2. Partner project rules and fee mode (server)

- [x] 2.1 Add `validatePartnerProject` to `src/lib/applications/shared.ts`: the project fields without a video, including `heardFrom`, with the same URL checks. Verify with unit tests in `shared.test.ts` (valid input, a bad GitHub URL, a missing description, and that a video isn't required).
- [x] 2.2 Add `setFeeMode` to `src/lib/teams/service.ts`: founder only, open team only, bumps the version. Verify with tests in `service.int.test.ts` (partner refused, locked team refused, version changes, default is `founder_pays`).
- [x] 2.3 Add `savePartnerProject`: validate, match against `eligibleProjects` with the partner's token, require a Hackatime id, then lock the team, write the encrypted draft and snapshot, and bump. Verify with integration tests (saves and bumps; refused for a founder, a non-member or a locked team; refused under 2h; refused without a Hackatime id; draft kept across mode switches).
- [x] 2.4 Extend `TeamView` with `feeMode` and a per-partner `ready` flag (no project content), and add a partner-facing read of their own draft. Verify with a test that a founder's `getMyTeam` never contains partner project content.

## 3. Submit

- [x] 3.1 Extend `teamForSubmit` to return `feeMode` and partner drafts, and `lockForApplication` to freeze partner projects onto `application_members` (credited 7200). Verify with integration tests that the frozen copy doesn't change after a later draft edit.
- [x] 3.2 Update `submitApplication` for `each_pays`: founder credited 7200, refuse when a partner isn't ready, refuse duplicate or missing Hackatime ids, and write `applications.fee_mode`. Verify with `service.int.test.ts` cases: founder-pays unchanged (6h for 3), each-pays success (2h each), partner not ready, shared Hackatime id refused, shared code URL accepted, aid ignores the mode.
- [x] 3.3 Verify the "Needs changes" round trip with an integration test: the team reopens, the partner edits their draft, the founder resubmits, the new application has the new project and the old one keeps its own.

## 4. Apply form and partner portal (UI)

- [x] 4.1 `TeamSection`: add the fee mode toggle (project path only) and the ready/not-ready badge per partner, wired to a `setFeeMode` server action. Verify with `TeamSection.test.tsx` (toggle hidden on aid, badges render).
- [x] 4.2 `ApplyForm`: base the fee, disclosures and button label on the mode ("Pay 2 hours & submit" in each-pays). Add missing partner projects to "still missing". Use a 2h `teamSize` for the picker in each-pays mode. Verify with `ApplyForm.test.tsx` covering both modes.
- [x] 4.3 Partner portal (`src/app/submissions/`): for active partners on an open `each_pays` team, show the project form (reusing `ProjectPicker` with `teamSize = 1`, plus code URL, demo URL, description and heard-from, no video) with a save server action and the Hackatime connect prompt. Otherwise show "{founder} is covering your hours", or read-only once locked. Verify with component tests and by running the app as a partner.
- [x] 4.4 Status page: show a partner their own submitted project on `each_pays` applications (`StatusCard`/`ApplicationDetails`). Verify with `StatusCard.test.tsx`.
- [x] 4.5 Join page: copy for both modes, plus the note that the founder can change the mode. Verify by opening an invite link for a team in each mode.

## 5. Admin review

- [x] 5.1 Admin detail read and `ApplicationDetails`: show the fee mode and one project block per paying member, with code, demo, logged and credited hours, description and a `TelescreenLink` per member. Verify with a test or by viewing a seeded each-pays application.
- [x] 5.2 `decide()` with `banUserId`: default to the founder, refuse non-members (`bad_ban_target`), ban only that user. Add the member picker to `DecisionForm`, shown for fraud on applications with more than one member. Verify with integration tests (partner banned and founder not, default founder, outsider refused) and `e2e/admin.spec.ts`.
- [x] 5.3 Airtable sync per candidate (founder on `applications`, partners on `application_members`), with per-record write-back and `countPendingSync` counting candidates. Verify with tests: each-pays creates 3 records, founder-pays creates 1 with 6h, and a partial failure retries only the missing records.

## 6. Copy

- [x] 6.1 Update `src/content/landing.tsx` (fee FAQ, both modes) and `src/content/docs.tsx` / `src/app/docs/page.tsx` (fee section with an example for each mode, the partner-project requirements, the meta description). Verify by reading the rendered pages and checking `e2e/landing.spec.ts` passes.

## 7. Integration

- [x] 7.1 Extend `e2e/teams.spec.ts` with an each-pays journey: the founder switches mode, a partner joins and saves a project, the founder submits, an admin sees 3 projects, marks Needs changes, the partner edits, the founder resubmits, and an admin approves. Verify `npm run test:e2e` passes.
- [x] 7.2 Run the full unit, integration and e2e suites plus `openspec validate partner-paid-fees --strict` and verify everything passes.

## 8. Unbanned founder after a partner's fraud

- [x] 8.1 Allow `rejected_fraud` to be replaced: `canReplace`, `formTeam`, `checkInvite`, and migration `0007` widening `applications_only_rejected_superseded` (plus `schema.ts`). Verify with integration tests: an unbanned founder can form a team, join one, and resubmit (the old row becomes superseded), and a banned founder is still refused all three.
- [x] 8.2 Fraud status copy: `StatusCard` takes `banned`. Banned viewers keep "can't apply again"; an unbanned founder sees "not accepted" with "Start a new application". Wire it from `/submissions`. Verify with `StatusCard.test.tsx` and by extending the each-pays e2e journey so the founder starts a new application after the partner's fraud ban.

## Workflow follow-up

- Archive `incubator-fund-application`, `team-applications` and `per-applicant-fee` before archiving this change, so `openspec/specs/` holds the base requirements this change modifies.
