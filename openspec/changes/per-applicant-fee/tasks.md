# Tasks

## 1. Fee rule and data

- [x] 1.1 In `src/lib/hackatime-shared.ts`, add the per-person constant, `feeSeconds(teamSize)` and `coversFee(project, teamSize)`, and keep `eligibleProjects` listing projects with at least 2h. Verify with new cases in `src/lib/hackatime-shared.test.ts`: fee for 1–4 people, the boundaries of `coversFee`, and a 1h59m project still hidden.
- [x] 1.2 In `src/db/schema.ts`, take the per-person value from the shared constant. Rewrite the `applications_hours_match_kind` check as a positive multiple of 2h with `snapshot >= credited` for project rows (design decision 5). Run `npm run db:generate` to produce `drizzle/0005_per_applicant_fee.sql`, and verify the SQL only drops and re-adds that constraint.
- [x] 1.3 In `submitApplication` (`src/lib/applications/service.ts`), compute `feeSeconds(team.members.length)` after `teamForSubmit`. Reject with "that project needs Xh for a team of N" when the snapshot is below it, before any insert, and store it as `creditedSeconds`. Verify with `service.int.test.ts` cases: solo → 7200 credited; founder + 2 partners with 14h30m → 21600; founder + 3 partners with 7h10m → rejected and no row written; aid with partners → null credited.
- [x] 1.4 In `src/lib/airtable/sync.ts`, send each row's `creditedSeconds` as `cappedSeconds`. Verify with the existing Airtable sync test, or a new one, that a 6h application syncs 6h.
- [x] 1.5 Run `npm run test:int` against a database migrated with 0005 and verify that existing rows with 2h credited still pass the constraint.

## 2. Apply form

- [x] 2.1 Pass the team size into `ProjectPicker`. Render projects below the fee as disabled options with "needs Xh for a team of N", plus the "none of your projects cover Xh yet. keep building, or remove a partner." state. Update the not-connected hint copy. Verify with `ProjectPicker.test.tsx` cases for a disabled project, the note text and the none-cover state.
- [x] 2.2 In `ApplyForm.tsx`, derive the team size from `team` (1 when null). Clear `hackatimeProject` when the selected project stops covering the fee. Show the fee in step 1's bullets, the fee step title and panel ("6 hours", "2 hours × 3 people. only you pay."), the "only takes Xh of credit" line and the button label "Pay N hours & submit". Verify with `ApplyForm.test.tsx`: the button label for solo and a team of 3, a selection cleared when the team grows, and the updated disclosure text.
- [x] 2.3 In `TeamSection.tsx`, change the partner note to say each person adds 2 hours to the fee and only the founder pays it. Verify with the updated `TeamSection.test.tsx` assertion.

## 3. Site copy

- [x] 3.1 Update `src/content/landing.tsx`: the how-it-works step "A project + 2 hours™ per person", its body, and the "Why does it cost 2 hours?" FAQ answer (per person, founder pays, partners don't). Verify the landing page renders the new copy in `npm run dev` and that no landing test asserts the old strings.
- [x] 3.2 Update `src/content/docs.tsx` ("The 2 hour fee" section, the summary list, the worked example as a team of 3 paying 6h from a 7h project, the partner note) and the meta description in `src/app/docs/page.tsx`. Verify by reading `/docs` in `npm run dev`.
- [x] 3.3 Update `src/app/join/[token]/page.tsx` to say partners don't pay hours and that joining adds 2 hours to the founder's fee. Verify by opening an invite link locally.
- [x] 3.4 Render `formatHours(app.creditedSeconds)` in `src/components/submissions/ApplicationDetails.tsx` in place of "2h credited", and update the `src/app/styleguide/page.tsx` examples. Verify with `StatusCard.test.tsx` / `ApplicationDetails` assertions for a 6h application.

## 4. Integration check

- [x] 4.1 Run `npm run typecheck`, `npm run lint` and `npm test`, and verify that all pass.
- [x] 4.2 Run a manual pass in `npm run dev`: solo founder pays 2h; add 2 partners → the fee shows 6h, short projects are greyed out, and the button reads "Pay 6 hours & submit"; submit and confirm 6h credited on `/submissions` and in the admin view.

## Workflow follow-up

- Archive `incubator-fund-application` and `team-applications` before this change, so its MODIFIED deltas have base specs in `openspec/specs/`.
- Commit the uncommitted docs page (`src/app/docs/`, `src/components/docs/`, `src/content/docs.tsx`) before or with this change.
