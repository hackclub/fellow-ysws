# Proposal

## Why

Approving an application today admits the team straight into FELLOWS FUND™. The reviewer wants a second-round interview before final selection, so a first-pass approval should invite the team to book an interview, and admission should happen only after the reviewer decides on the interview.

## What Changes

- **BREAKING (review flow):** First-pass "Approve" no longer admits. It moves the application to a new `interview` status and invites the founder to book a second-round interview on Calendly (`https://calendly.com/sebastianhernandez-hackclub/2nd-round-hack-club-fellows`).
- New round-2 decision on applications in `interview`: **Select** (→ `approved`, the existing "you're in" letter), **Cut** (→ `rejected_cut`, the existing rejection letter; they can apply again), or **Fraud** (→ `rejected_fraud`, same ban rules as round 1). "Needs changes" is not available in round 2.
- Both rounds are recorded separately (who decided, when, note, internal justification) so the first-pass record isn't overwritten by the second.
- Applicant portal gets an interview letter ("you made it to round two") behind the existing "Decision ready" reveal. After it's read, the founder's status card keeps a **Book your interview** button. Partners see the same status but are told the founder books, with no link.
- The Calendly link is prefilled with the founder's name and email, and `utm_content` carries the application id so bookings can be matched to applications.
- Airtable sync takes the project when the application is invited to interview (as well as on a first-pass cut, as today). The round-2 outcome never touches Airtable. Applications already `approved` keep their status, with no interview.
- The team stays locked while the application is in `interview` and is released by the round-2 decision.
- Admin list, filters, labels, decision form and funnel learn the new status. The funnel records the round-2 outcome as its own step.
- Public docs describe the interview stage.

## Capabilities

### New Capabilities
- `interview-round`: the second-round interview stage: the invite letter, founder-only Calendly booking with prefilled details, what partners see, and the round-2 decision outcomes for the applicant.

### Modified Capabilities
- `application-review`: "Review decisions" changes so first-pass approve means "invite to interview", adds round-2 decisions, and changes "decisions are final" to "each round is decided once". The Airtable sync requirement changes so a project syncs when it's invited to interview.

## Impact

- **Database:** a migration adds `interview` to `application_status` and `interviewed` to `funnel_step`, adds round-2 decision columns to `applications`, and updates the rejection-note check.
- **Server:** `src/lib/admin/service.ts` (`decide`, rules, filters), `src/lib/applications/service.ts` (`toView`), `src/lib/applications/portal.ts` (letter outcome, decision-seen cookie, booking URL), `src/lib/teams/service.ts` (`onDecision`), `src/lib/airtable/sync.ts` (synced statuses), `src/lib/admin/funnel.ts`, `src/app/admin/actions.ts`.
- **UI:** `DecisionForm`, the admin application page and list, `StatusCard`, `/submissions/decision`, `src/content/portal.ts` (interview letter copy), `src/content/docs.tsx`.
- **Tests:** `StatusCard.test.tsx`, `admin.int.test.ts`, `sync.int.test.ts`, `funnel.int.test.ts`, `lifecycle.int.test.ts`, and the e2e journeys and admin specs that approve straight to "you're in".
- **External:** a Calendly link only, with no API, webhook or new dependency.
