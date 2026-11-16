# Proposal

## Why

The application fee is a flat 2 hours™ whatever the team size, so a team of four gets in for the same time a solo applicant pays. The fee should scale with the people it buys a seat for: 2 hours per applicant. The founder still pays the whole fee from one project, and partners still pay nothing.

## What Changes

- **BREAKING (rule)**: The project-path fee becomes 2 hours × the number of people on the team (founder + partners): 2h solo, up to 8h for a full team of 4. Aid applications still cost no hours.
- The founder's single selected project pays the whole fee. Partners don't pay hours.
- The fee is worked out on the server from the team as it is locked at submit. The server rejects the submission if the selected project's logged time is below the fee.
- The credited hours stored on each application become that application's fee (a multiple of 2h), not a fixed 2h. Existing applications keep their 2h.
- The project picker still lists every Hackatime project with at least 2 hours logged, but greys out projects below the current team's fee and says why (e.g. "needs 6h for a team of 3"). If no project covers the fee, it says so and suggests building more or removing a partner.
- The fee step and the submit button show the current fee ("Pay 6 hours & submit") and update when the team changes on the form.
- Copy changes on the landing page (how it works, FAQ), the docs page (the fee section, examples, partner notes and the meta description), the apply page (picker hints, fee step, team note), the join page and the submission details ("2h credited" becomes the stored value).
- The Airtable sync sends each application's own credited hours instead of the 2h constant.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `application-teams`: "Fee and aid unaffected by team size" becomes a per-applicant fee that only the founder pays.
- `fund-application`: the project-path disclosures and the credited-hours record use the team-sized fee instead of a flat 2 hours.
- `applicant-identity`: the eligible project listing greys out projects below the team's fee instead of only hiding projects under 2 hours.
- `program-site`: the landing "how it works" step, the numbered apply steps, the Team section note and the submit button label show the per-applicant fee.

## Impact

- **Rules / data**: `src/lib/hackatime-shared.ts` (eligibility + new fee helper), `src/db/schema.ts` (`CREDITED_SECONDS` becomes a per-person constant; the `applications_hours_match_kind` CHECK constraint), new drizzle migration `0005`, `src/lib/applications/service.ts::submitApplication`, `src/lib/airtable/sync.ts`.
- **UI**: `src/components/apply/ApplyForm.tsx`, `ProjectPicker.tsx`, `TeamSection.tsx`, `src/components/submissions/ApplicationDetails.tsx`, `src/app/join/[token]/page.tsx`, `src/app/styleguide/page.tsx`.
- **Copy**: `src/content/landing.tsx`, `src/content/docs.tsx`, `src/app/docs/page.tsx`.
- **Tests**: `ApplyForm.test.tsx`, `ProjectPicker.test.tsx`, `TeamSection.test.tsx`, `StatusCard.test.tsx`, service tests for submit.
- **Dependency**: the modified capabilities exist only as deltas in the unarchived `incubator-fund-application` and `team-applications` changes. Those need to be archived (synced to `openspec/specs/`) before this change archives.
