# Proposal

## Why

Fellows Fund™ backs startups, and most startups have cofounders, but today an application belongs to one person. Founders need a way to put their partners on the application itself, so reviewers see the whole team and partners can't send in competing applications for the same idea.

## What Changes

- A founder can form a team of up to 4 people (the founder plus up to 3 partners) for their application, on either the project path or the financial-aid path.
- The founder shares an invite link. A partner opens it, signs in with Hack Club, and joins. Partners don't connect Hackatime.
- The application fee stays a flat 2 hours™, paid once by the founder from their Hackatime project. Adding partners costs nothing extra. On the aid path, only the founder uses up an aid attempt.
- While the team is open, the founder can kick partners (which replaces the invite link) and partners can leave on their own.
- The team locks when the application is submitted: no one can join, leave or be kicked. If the application is marked "Needs changes", the team reopens until the founder resubmits, and then it locks again.
- While a person is a partner on an open team, or on an application that is under review or marked "Needs changes", they can't start their own application, found a team or join another team. They're released when that application is accepted or not accepted, or when they leave, are kicked, or the team is dissolved.
- Partners see the application's status and any reviewer note. Only the founder edits, submits, deletes and resubmits.
- Admins see the team members on the application detail page.

## Capabilities

### New Capabilities
- `application-teams`: Forming a team for an application: the invite link, joining, kicking and leaving, the size cap, locking at submit and reopening after "Needs changes", which applications team members can be on, and what partners see.

### Modified Capabilities
- `fund-application`: "One live application per user" now also blocks users who are tied up as partners on another team.
- `application-review`: The application detail view shows the team members.
- `program-site`: The apply form gains a numbered "Team" section on both paths.

## Impact

- **Archive order:** this change modifies capabilities that `incubator-fund-application` introduces. That change must be archived first so these deltas have main specs to apply to.
- **Database:** new `teams` and `team_members` tables, and a nullable `team_id` on `applications`. The invite token is stored only as an HMAC hash, like session IDs.
- **Code:** apply form (team section), new join page, submit, delete and resubmit Server Actions (team lock, unlock and release), applicant status page (partner view), admin detail view.
- No new external dependencies. Partners use the existing Hack Club sign-in.
