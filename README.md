# Hack Club Fellows Fund™

The application site for Fellows Fund™: a landing page, the application form, an applicant status page, and an admin area for reviewing applications and watching the funnel.

Applicants pick one of two paths:

- **Project:** sign in with Hack Club, connect Hackatime, pick a project with at least 2 hours logged, and add a GitHub repo, a playable URL and a description. The program credits only 2 hours of that project.
- **Financial aid** (once per person, for people new to Hack Club): sign in with Hack Club and submit an unlisted YouTube video introducing the team and the startup, plus a reason for requesting aid.

### Teams

A founder can put up to 3 partners on their application (4 people total) on either path:

1. On the apply form, the founder clicks **Add partners** in the "Bring your team" step and copies the invite link.
2. A partner opens `/join/<token>`, signs in with Hack Club and confirms. Partners don't connect Hackatime and pay no hours. The 2-hour fee and the aid attempt are only ever the founder's.
3. While the team is open, the founder can remove partners (which also replaces the link), replace the link, or apply solo instead. Partners can leave on their own.
4. **Submitting locks the team.** No one can join, leave or be removed. If the team changed after the founder opened the form, submit is refused and shows the current team.
5. **"Needs changes" reopens the team** until the founder resubmits, which locks it again. Each submitted application keeps its own record of who was on it.
6. While a partner is on an open team, or on an application under review or marked "Needs changes", they can't apply on their own, start a team, or join another one. They're released when the application is accepted or not accepted, when they leave or are removed, or when the founder deletes the pending application (which dissolves the team).

Partners see the application's status, the reviewer note and the team on `/submissions`. Only the founder deletes or resubmits.

The behavior contract lives in `openspec/changes/incubator-fund-application/` and `openspec/changes/team-applications/` (proposal, design, specs).

## Stack

Next.js 16 (App Router, TypeScript), Postgres 17 with Drizzle, Vitest and Testing Library, Playwright.

## Local setup

Requirements: Node 24+, Docker.

```bash
npm install
cp .env.example .env
npm run keys:generate          # paste the three printed lines into .env
# fill in the four OAuth client variables (see "OAuth apps" below);
# any non-empty placeholder works if you'll only use test mode
npm run db:up                  # Postgres for dev (port 5442) and tests (port 5443)
npm run db:migrate
npm run dev                    # http://localhost:3000
```

Sign-in needs real OAuth apps (see below). To click through the whole app without them, run it in test mode, which uses the built-in mock providers:

```bash
npm run build
E2E_TEST_MODE=1 APP_URL=http://localhost:3000 \
  HACKCLUB_AUTH_URL=http://localhost:3000/test-oauth/hackclub \
  HACKATIME_URL=http://localhost:3000/test-oauth/hackatime \
  YOUTUBE_OEMBED_URL=http://localhost:3000/test-oauth/youtube/oembed \
  ADMIN_HACKCLUB_IDS='ident!me' npx next start
```

Sign in as `ident!me` to see the admin area. Test mode only turns on when `E2E_TEST_MODE=1` **and** `APP_URL` is localhost, so it can't be enabled on a deployment by accident.

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | yes | Public base URL, used to build OAuth redirect URIs |
| `HACKCLUB_AUTH_CLIENT_ID` / `_SECRET` | yes | Hack Club Auth OIDC app |
| `HACKATIME_CLIENT_ID` / `_SECRET` | yes | Hackatime OAuth app |
| `ENCRYPTION_KEYS` | yes | JSON map of key version to base64 32-byte key, e.g. `{"1":"…"}` |
| `ENCRYPTION_ACTIVE_KEY_VERSION` | yes | Version used for new writes; must exist in `ENCRYPTION_KEYS` |
| `LOOKUP_KEY` | yes | base64 32-byte HMAC key for identifier lookups. **Never rotate it.** |
| `ADMIN_HACKCLUB_IDS` | no | Comma-separated Hack Club ids (OIDC `sub`, e.g. `ident!abc123`) allowed into `/admin` |
| `AIRTABLE_PAT`, `AIRTABLE_APP_NAME`, `AIRTABLE_TABLE_NAME` | no | Airtable token, base id and table id for "Sync to Airtable" (docs/airtable.md) |
| `HACKCLUB_AUTH_EXTRA_SCOPES` | no | Extra Hack Club Auth scopes, e.g. `birthdate address`, only if the app is approved for them |
| `TELESCREEN_URL` | no | Telescreen base for review links (default `https://telescreen.hackclub.com`) |
| `HACKCLUB_AUTH_URL`, `HACKATIME_URL`, `YOUTUBE_OEMBED_URL` | no | Provider base URLs. Defaults are the real services; override only for tests |

The server validates all of these when it starts and lists every bad variable in one error.

### OAuth apps

- **Hack Club Auth:** https://auth.hackclub.com/developer/apps. Redirect URI `${APP_URL}/auth/hackclub/callback`, scopes `openid profile email slack_id`. Details are in [docs/hackclub-auth.md](docs/hackclub-auth.md).
- **Hackatime:** https://hackatime.hackclub.com/oauth/applications. Redirect URI `${APP_URL}/auth/hackatime/callback`, scopes `profile read`, and check **Confidential**. Details are in [docs/hackatime.md](docs/hackatime.md).

## Data protection

- PII (name, email, Hack Club id, Slack id), every application field, and reviewer notes are encrypted with AES-256-GCM before they reach Postgres. Each ciphertext is bound to its table, column and row, so copying it to another row makes decryption fail. Timestamps, statuses, application type and hour counts stay in plaintext.
- Users are looked up by `HMAC(LOOKUP_KEY, hackclub_id)`. That hash also enforces "one aid request per person", even after an application is deleted.
- Team invite links are looked up by `HMAC(LOOKUP_KEY, token)`. The token itself is stored only encrypted, so the founder can see the link again.
- Hackatime tokens are never stored in the database. They live only in a 30-minute encrypted cookie.
- The funnel uses a first-party anonymous cookie. No IP addresses or user agents are stored, and nothing goes to third-party analytics.

### Keys: back them up, and how to rotate

**Losing `ENCRYPTION_KEYS` or `LOOKUP_KEY` makes all applicant data unreadable.** Keep them in your host's secret manager and keep an offline backup.

To rotate the encryption key:

1. Generate a new key (`npm run keys:generate`) and **add** it under a new version: `{"1":"old…","2":"new…"}`.
2. Set `ENCRYPTION_ACTIVE_KEY_VERSION=2` and redeploy. New writes use version 2, and old rows still decrypt with version 1.
3. Keep version 1 in `ENCRYPTION_KEYS` for as long as any row was written with it. There's no re-encryption script yet, so for now that means keeping it permanently.

Never rotate `LOOKUP_KEY`. Every user lookup and every aid claim is keyed by it, so changing it would orphan all accounts and reset the once-only aid rule.

## Tests

```bash
npm run db:up            # the test database on port 5443
npm test                 # unit + component + integration (Vitest)
npm run test:e2e         # browser tests against a production build with mock providers (Playwright)
npx playwright install chromium   # once, before the first e2e run
```

Integration and e2e tests truncate the test database (`fellows_test` on port 5443). They never touch the dev database.

## Layout

```
src/app/                pages, route handlers, server actions
  apply/ submissions/   applicant flow (including the team section and partner view)
  join/[token]/         invite link: sign in, then join a team
  admin/                review list, detail and decisions, funnel
  auth/                 Hack Club + Hackatime OAuth routes
  test-oauth/           mock providers (test mode only)
src/lib/
  applications/         validation (shared with the client) and lifecycle rules
  locks.ts              per-user transaction lock (always taken before a team lock)
  auth/                 OAuth flows, sessions, guards
  admin/                review and funnel queries
  teams/                team lifecycle: invite, join, kick, leave, lock and release
  crypto.ts env.ts funnel.ts hackatime.ts
src/db/schema.ts        tables and the constraints that back the business rules
src/proxy.ts            sets the anonymous funnel cookie
```
