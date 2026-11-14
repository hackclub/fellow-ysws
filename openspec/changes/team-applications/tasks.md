# Tasks

## 1. Schema and migration

- [x] 1.1 Add `teams`, `team_members` (with the partial unique index on `user_id WHERE released_at IS NULL`) and `application_members` to `src/db/schema.ts`, plus nullable `applications.team_id`. Generate the migration. Verify `npm run db:migrate` runs on an empty database, and add an integration test that a second active `team_members` row for the same user fails on the index
- [x] 1.2 In the same migration, backfill one `founder` row in `application_members` for every existing application. Verify with an integration test that migrates a database seeded with solo applications and checks each one has exactly one founder member

## 2. Team service (transitions and rules)

- [x] 2.1 Create the team service module: form a team, generate and replace the invite token (stored as an HMAC hash plus an encrypted copy), and lock the team row with `FOR UPDATE` and bump `version` on every change. Verify with integration tests for "Form a team", "Ineligible user can't form a team" and "Replace the link" (the old token's hash no longer matches)
- [x] 2.2 Implement join with all eligibility checks (open team, valid token, under the 4-member cap, user not active on another team, no live application of their own, not the founder), mapping a unique-index violation to the same "already on a team" error. Verify with integration tests for every scenario under "Joining through the invite link", "Invite link validity" and "Team size limit", including two concurrent joins for the last spot
- [x] 2.3 Implement kick (also replaces the token), leave and dissolve, all refused unless the team is open. Verify with integration tests for "Kick a partner", "Kick after submission", "Leave an open team", "Leave a locked team" and "Delete a pending team application" (all members released)

## 3. Application lifecycle integration

- [x] 3.1 Extend the submit Server Action: refuse users with an active partner row, compare the posted team `version` under the row lock, set `locked_at`, write `application_members` (founder only for solo applications), and set `applications.team_id`. Verify with integration tests for "Submit with a team", "Team changed before submit", "Submit alone", "Partner on another team blocked" and both scenarios under "Fee and aid unaffected by team size"
- [x] 3.2 Extend the decide action: a malformed rejection clears `locked_at`, and approved or rejected-cut releases every member. Extend resubmit to lock the team again with the current members. Verify with integration tests for "Fix the team after 'Needs changes'", "Released after a decision" and "Released after being kicked"
- [x] 3.3 Extend pending-only deletion to dissolve the team in the same transaction. Verify the existing deletion tests still pass, plus a new test that partners can apply right after the founder deletes

## 4. Apply form Team section

- [x] 4.1 Add the numbered Team section to both paths: member list, copy and replace link actions, per-partner remove, the "partners don't pay hours" note and spots left, and send the team `version` with the form. Verify with component tests for "Team section contents" and a Playwright test that the section appears in the right place on both paths ("Project path steps", "Aid path steps")
- [x] 4.2 Show a stale-team refusal on submit: re-render the current team and keep the founder's form input. Verify with a Playwright test that removes a partner in a second browser context before submit

## 5. Join page

- [x] 5.1 Build `/join/[token]`: an invalid, replaced, full or already-applied link shows its reason; a signed-out visitor goes to Hack Club sign-in with a return path checked to be an internal path; a signed-in visitor sees the founder's name and a confirm button. Verify with a Playwright test for joining end to end, unit tests rejecting external or protocol-relative return paths, and component tests for each refusal message
- [x] 5.2 Send tied-up partners who open the apply form to their team's status page. Verify with a Playwright test for "Partner tries to apply alone"

## 6. Status page and admin view

- [x] 6.1 Load the status page through `application_members`, show team members, and show founder-only actions only to the founder. A partner on an open, unsubmitted team sees the team and Leave. Verify with Playwright tests for "Partner sees 'Needs changes'" and for a partner leaving an open team
- [x] 6.2 Show the submitted members, with the founder marked, on the admin application detail view, including replaced applications. Verify with integration or component tests for "View team" and "Team history across resubmission"

## 7. Integration check

- [x] 7.1 Run the full flow in Playwright: founder forms a team, two partners join, one is kicked, founder submits, admin marks "Needs changes", founder invites a new partner and resubmits, admin approves, partners are released. Verify the test passes along with `npm test` and `npm run build`
- [x] 7.2 Update `README.md` with how teams work (cap, invite link, lock and release rules). Verify the described steps match the Playwright flow in 7.1

## Workflow follow-up

- Archive `incubator-fund-application` before archiving this change, so the modified capabilities exist in `openspec/specs/`.
