# Tasks

## 1. Hackatime API spike (unblocks section 4)

- [ ] 1.1 Register a Hackatime OAuth app (or confirm OAuth isn't offered) and record the authorize/token URLs, scopes, and the endpoint that lists a user's projects with total seconds. Verify by fetching your own project list with a script, and record the findings in `docs/hackatime.md`
- [ ] 1.2 Confirm Hack Club Auth's OIDC endpoints and claims (ID, name, email, Slack ID) by completing one sign-in with a test client. Record them in `docs/hackclub-auth.md`

## 2. Project scaffolding

- [x] 2.1 Create the Next.js (App Router, TypeScript strict) app with ESLint, Vitest and Playwright. Verify `npm run build`, `npm test` and `npx playwright test --list` all succeed
- [x] 2.2 Add Drizzle with a Postgres connection and a `docker-compose.yml` for local and test databases. Verify `npm run db:migrate` runs against an empty database
- [x] 2.3 Add typed env loading that validates every secret at startup (OAuth clients, `ENCRYPTION_KEYS`, `ENCRYPTION_ACTIVE_KEY_VERSION`, `LOOKUP_KEY`, `ADMIN_HACKCLUB_IDS`). Add `.env.example`. Verify startup fails with a clear message when a variable is missing

## 2b. Visual foundation

- [x] 2b.1 Add the design tokens (CSS variables) and the condensed serif via `next/font` as described in design.md decision 10. Verify a `/styleguide` dev-only page renders type, colors and states, and compare it side by side with the mockups
- [x] 2b.2 Build `SiteShell` (top strip, site name, nav with current-page marking, REVIEW slot), `Button` (including disabled), `TextLink`, `Field`, `TextArea`, `Panel`, `Accordion` and `PhotoStrip`. Verify with component tests for disabled buttons and accordion keyboard toggling with `aria-expanded`, plus a Playwright screenshot of `/styleguide` at 375px and 1280px with no horizontal scroll
- [x] 2b.3 Build the landing page (photo strip, hero, Why Fellows, CTA, How it works cards, FAQ with placeholder answers). Verify with a Playwright test that the program-site landing scenarios pass and that the CTA leads to `/apply`

## 3. Data protection

- [x] 3.1 Implement AES-256-GCM `encrypt`/`decrypt` with a key version and AAD binding (table, column, row ID). Verify with unit tests: round trip, decrypt after rotating to a new active version, tampered ciphertext throws, ciphertext moved to another row throws
- [x] 3.2 Implement the HMAC-SHA-256 `hcIdHash` helper. Verify with unit tests that it's deterministic and different under a different key
- [x] 3.3 Write the schema and migration for `users`, `sessions`, `applications` (partial unique index on live applications, CHECK requiring a note on rejection), `aid_claims` and `funnel_events`. Verify with an integration test that a second live application insert and a note-less rejection are both refused by the database
- [x] 3.4 Add a test that inserts a full application through the repository layer, reads the raw rows, and checks that no plaintext name, email, URL, aid reason or note appears in them

## 4. Identity

- [x] 4.1 Implement Hack Club sign-in (authorize, callback, create or find the user by `hc_id_hash`, encrypt PII, database session cookie, sign-out). Verify with an integration test using a mocked provider: first sign-in creates a user, second reuses it
- [x] 4.2 Add a `requireUser()` guard and protect the form and status routes. Verify with a Playwright test that an unauthenticated visit to the form redirects to sign-in and returns afterward
- [x] 4.3 Implement the Hackatime connect flow: callback stores the token only in an encrypted, 30-minute httpOnly cookie, and sets `hackatime_connected_at`. Verify with an integration test that no token is in the database after connecting, and that a denied authorization returns to the form with an explanation
- [x] 4.4 Implement the eligible project list (hide projects under 2h, show hours, error with retry when Hackatime fails, empty state that mentions the aid path). Verify with unit tests on the filter boundary (1h59m hidden, 2h00m shown) and component tests for the empty and error states

## 5. Application submission

- [x] 5.1 Build the form UI from the 2b components as numbered steps: aid checkbox switches between the project steps and the aid steps. Project path has the "application fee: 2 hours™" panel and disclosures (2h credited, rest can be reshipped, startup not required). Aid path has the acknowledgements (new to Hack Club with an idea, once only, 1-minute team + startup video). Verify with a Playwright test that the numbered steps, disclosures and acknowledgements appear on the matching path
- [x] 5.1b Implement the submit button's "still missing" state (disabled plus a plain-word list of missing items, "Pay 2 hours & submit" label on the project path). Verify with component tests for the incomplete and complete scenarios in the program-site spec
- [x] 5.2 Implement shared validation (GitHub repo URL, http(s) playable URL, required fields, all acknowledgements). Verify with unit tests for every rejection scenario in the fund-application spec
- [x] 5.3 Implement YouTube URL normalization and the oEmbed check, failing closed. Verify with unit tests for each accepted URL form and mocked oEmbed success, 404 and network error
- [x] 5.4 Implement the submit Server Action: re-fetch Hackatime projects and check ownership and ≥2h, snapshot hours with credited = 2, enforce one live application, aid-claim rules (including the malformed-aid resubmission exception) and supersede on resubmit, all in one transaction. Verify with integration tests for each scenario under "One live application per user", "One financial-aid attempt per user" and "Resubmission after Needs changes"
- [x] 5.5 Record `form_started` and `submitted` (project/aid) funnel events. Verify with an integration test that the events exist after a submission

## 6. Applicant status page

- [x] 6.1 Build the status page with the applicant label mapping, decrypted application contents, and reviewer note when present. Verify with component tests for all four labels and note visibility
- [x] 6.2 Implement the delete action (only while submitted; hard delete; aid claim kept) and show delete or resubmit actions by status. Verify with integration tests that deleting a decided application is refused when called directly, and that deleting a pending aid application leaves the aid option disabled with its explanation

## 7. Admin review

- [x] 7.1 Implement the `requireAdmin()` guard from `ADMIN_HACKCLUB_IDS` and the `/admin` layout, and show the REVIEW nav link only to admins. Verify with integration tests that a non-admin is refused on every admin page and action, and a Playwright test that REVIEW is shown to an admin and hidden from a non-admin
- [x] 7.2 Build the application list with type and status filters. Verify with an integration test that the pending-aid filter returns only pending aid applications
- [x] 7.3 Build the detail view (decrypted content, aid acknowledgement record, history of replaced applications, deciding admin and time). Verify with a Playwright test against seeded aid and project applications
- [x] 7.4 Implement decide actions (approve / reject cut / reject malformed) with a required note on both rejections, a conditional update on `status='submitted'`, the decider and time recorded, and a `decided` funnel event. Verify with integration tests: empty note refused, a second decision refused, and malformed shows "Needs changes" with the note to the applicant

## 8. Funnel

- [x] 8.1 Add middleware for the `anon_id` cookie and a once-per-day `visit` event on public pages, skipping known bots, with no IP or user agent stored. Verify with an integration test that repeat visits the same day record one event and the stored row has no IP
- [x] 8.2 Link anonymous events to the user on sign-in, and record `signed_in` and `hackatime_connected` events. Verify with an integration test that pre-sign-in visits count toward the same person
- [x] 8.3 Build the admin funnel view: date range, unique counts per step, conversion percentages, submissions split by type, decisions split by outcome. Verify with a test against seeded events that the counts and percentages are correct

## 9. Integration check

- [x] 9.1 Run a Playwright end-to-end test with mocked OAuth providers covering: a project applicant submits and is approved; an aid applicant submits, is marked "Needs changes", and resubmits as aid; an aid applicant deletes and is then limited to the project path. Verify that all of them pass
- [x] 9.2 Write a README covering local setup, the env variables, key generation and rotation, and the fact that `LOOKUP_KEY` can't be rotated. Verify by following it from a clean clone to a running app
