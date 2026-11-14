# Design

## Context

Today an application belongs to a single user. One live application per user is enforced by a partial unique index on `applications.user_id`. The 2-hour fee is checked by `applications_hours_match_kind`. Form content only exists once it's submitted: there are no drafts. Users are looked up by HMAC hash and their PII is AES-GCM encrypted (`src/lib/crypto.ts`). See proposal.md for why teams are needed and specs/application-teams for the rules.

## Goals / Non-Goals

**Goals:**
- Have the database enforce team membership rules (one active team per person, size cap, lock state) so a race or a hand-crafted request can't break them.
- Keep the existing application row, fee check and aid rules unchanged.
- Keep a record of the team as it was on each submitted application, including ones replaced after "Needs changes".

**Non-Goals:**
- Saving drafts of application content. The team exists before submit, the form contents don't.
- Partners connecting Hackatime or paying hours.
- Funnel events for invites and joins (can be added later).
- Notifying partners by email or Slack when the status changes.

## Decisions

### The team is its own object, separate from the application

```
  teams                         team_members (live state)
  -----------------             ---------------------------
  id                            team_id   -> teams.id
  founder_user_id               user_id   -> users.id
  invite_token_hash  (lookup)   role      founder | partner
  invite_token_enc   (re-show)  joined_at
  version            (int)      released_at   NULL = active
  locked_at                     UNIQUE (user_id) WHERE released_at IS NULL
  dissolved_at
  created_at                    application_members (snapshot at submit)
                                ---------------------------
  applications                  application_id -> applications.id
  + team_id NULL -> teams.id    user_id, role
```

A team is created only when the founder clicks "add partners". Solo applicants never get one. Each submitted application, solo or not, gets `application_members` rows, so the admin view and the status page always read members from a single place.

*Alternative:* make the application row exist from the start as a draft and hang members off it. That would mean saving half-filled form contents and making `content_enc`, the fee check and the one-live index work with drafts. That's a much bigger change to code that's already tested, just to hold a member list.

### One active team per person, enforced by a partial unique index

The partial unique index on `team_members(user_id) WHERE released_at IS NULL` means a person, founder or partner, can be active on only one team. That covers "tied to one team" for joining and for founding. The submit action separately refuses users who have an active `partner` row, which extends the "one live application" rule.

Members are released by setting `released_at`, not by deleting rows, so the history stays. The founder's row is released along with everyone else's when the team is decided or dissolved. That doesn't free the founder to apply again, because the existing one-live-application rule still covers them.

### Lifecycle transitions live in the actions that already exist

```
 form team ----> open (locked_at NULL)
                   |  join / kick / leave / replace link: version++
                   |
          submit --+--> locked_at = now, write application_members,
                   |     applications.team_id = team
                   |
 admin decide:     |
   malformed  -----+--> locked_at = NULL (open again, same members)
   approved / cut ----> released_at = now for all members
 delete pending -------> dissolved_at = now, release all
 founder dissolves open team -> same as delete
```

Every transition runs in one transaction that starts with `SELECT ... FOR UPDATE` on the `teams` row. So two people joining at once take turns, and the size check (count of active members ≤ 4) can't be beaten by a race. The decide action and the delete action, both already transactional, gain these updates.

### Optimistic `version` check on submit

The form sends the `teams.version` it showed. Submit compares it with the current version under the row lock, and refuses with the current member list if they differ. This is the "team changed before submit" scenario. Any membership or link change bumps the version.

*Alternative:* send the list of member IDs and compare sets. That works too, but a single integer is simpler and also catches a link replacement.

### Invite token: hashed for lookup, encrypted so it can be shown again

The token is 32 random bytes in base64url. `invite_token_hash` uses the existing HMAC lookup key so `/join/[token]` can find the team. `invite_token_enc` uses the app encryption key so the founder's Team section can show the link again later. A raw token is never stored. Replacing the link overwrites both columns, so the old token's hash matches nothing.

### Join flow reuses Hack Club sign-in with a return path

`/join/[token]` checks the token first. If the visitor isn't signed in, it sends them through Hack Club sign-in with a return path to that join page. The return path is checked to be a relative path inside the app, so it can't redirect somewhere else. The confirm screen shows the founder's name by decrypting the founder's PII, and the join Server Action re-checks everything under the row lock.

### Partner status page reads through `application_members`

The status page loads the user's most recent application through `application_members` instead of `applications.user_id`, so partners see the team's application. Actions (delete, resubmit, team editing) are rendered and allowed only when `role = founder`. A partner on an open team that hasn't submitted yet sees the team and a Leave action.

## Risks / Trade-offs

- [The invite link reveals the founder's name to anyone who has it] → The founder chooses who gets the link and can replace it at any time. The join page shows only the founder's name, never other members or application contents.
- [Lifecycle updates spread across the submit, decide and delete actions could drift apart] → Put every transition behind one team service module (lock, transition, bump version) and test each transition in the state diagram with an integration test.
- [The partial unique index makes a "join" a constraint failure instead of a friendly message] → Check eligibility first for the message, and treat the constraint violation as a fallback mapped to the same "already on a team" error.
- [Releasing partners when an application is approved lets them apply again even though they're part of an accepted team] → This is how the rule was specified. If the program later needs approval to bind partners too, it's a single change in the decide transition.

## Migration Plan

1. Additive migration: create `teams`, `team_members` and `application_members`, and add the nullable `applications.team_id`.
2. Backfill one `application_members` row (role `founder`) for every existing application, in the same migration.
3. Deploy the code. Existing solo applications behave exactly as before.
4. Rollback: revert the code. The new tables and the nullable column can stay, since old code never reads them.

## Open Questions

- Should the join page show how many partner spots are left, or only the founder's name? This is copy only and doesn't affect the rules.
