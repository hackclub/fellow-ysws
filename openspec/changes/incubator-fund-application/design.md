# Design

## Context

There's no existing code: this is a new Next.js + TypeScript + Postgres app. See proposal.md for motivation and specs/ for the required behavior. Constraints that shape the approach:

- Two separate OAuth providers. Hack Club Auth is the identity for everyone. Hackatime is only a data source for the project path.
- Spec requirements that are hard to express in SQL over encrypted data: one live application per user, one aid attempt ever, delete only while pending.
- The admin is one person or a small team. Traffic is low (one application cycle), so simplicity beats scale.

## Goals / Non-Goals

**Goals:**
- Enforce every lifecycle rule (one live app, aid once, pending-only delete, decision finality, required notes) on the server and in the database, not just in the UI.
- Keep PII unreadable in database dumps and backups.
- First-party funnel data with no third-party scripts.

**Non-Goals:**
- Email, Slack or other notifications (the status page only).
- Video hosting or checking video length/visibility. YouTube hosts the video, and the 1-minute and unlisted rules rely on applicant acknowledgement.
- Editing a submitted application.
- Multiple application cycles or cohorts. One open cycle is assumed; adding a `cycle` column later is cheap.
- Admin role management beyond the env allowlist.

## Decisions

### 1. App framework: Next.js App Router with Server Actions
Form submission, delete, and admin decisions run as Server Actions, and every guard runs server-side. Pages are server components that decrypt on the server, so ciphertext and keys never reach the client.
*Alternative:* separate API routes plus client fetches. That means more surface area and more places to forget an authorization check.

### 2. Database access: Drizzle ORM + SQL migrations
Typed schema, plain SQL migrations, and first-class partial unique indexes (which the lifecycle rules need).
*Alternative:* Prisma. Fine, but partial indexes and raw constraints are clumsier, and its heavier runtime adds nothing here.

### 3. Authentication: hand-rolled OAuth/OIDC with `arctic`/`oslo` + database sessions
Hack Club Auth is the sign-in provider. Sessions are random tokens stored hashed in a `sessions` table, set as an httpOnly, Secure, SameSite=Lax cookie. Hackatime OAuth is a separate "connect" flow that doesn't create a session.
*Alternative:* Auth.js. It models Hackatime as a second sign-in account and wants to store its tokens in `accounts`, which goes against the "don't retain Hackatime tokens" requirement. Two small custom flows are clearer.

### 4. Hackatime token handling
After the Hackatime callback, the access token goes into a short-lived (30 min) httpOnly cookie, encrypted with the app key, and **never into the database**. The project picker and the submit action both call Hackatime with it. At submit, the server re-fetches the project list to check that the chosen project is the user's and has at least 2h, then snapshots the hours. If the cookie has expired, the user reconnects.
*Alternative:* store the project list as a snapshot at connect time. That's simpler, but the hours could be stale and could be tampered with on the client.

### 5. Encryption: AES-256-GCM envelope per row, HMAC-SHA-256 blind index
- `encrypt(json) -> { v: keyVersion, iv, ct, tag }`, stored as `bytea`/`jsonb` in a `*_enc` column. Keys come from `ENCRYPTION_KEYS` (a JSON map from version to base64 key) plus `ENCRYPTION_ACTIVE_KEY_VERSION`.
- The associated data (AAD) binds each ciphertext to its table, column and row ID, so ciphertext copied between rows fails authentication.
- `hc_id_hash = HMAC(LOOKUP_KEY, hackclub_user_id)` is used for lookups and uniqueness. `LOOKUP_KEY` is separate from the encryption keys and is **not** rotated, because rotating it would orphan lookups.
- Each application's form data is encrypted as **one blob**, rather than field by field. No query needs to filter on those fields, and one blob means fewer chances to leave a field unencrypted.
*Alternative:* Postgres `pgcrypto`. The key would have to be sent to the database in queries, where it could show up in logs. Rejected.

### 6. Data model

```
users              id, hc_id_hash UNIQUE, pii_enc {name,email,hc_id,slack_id},
                   hackatime_connected_at, created_at
sessions           id_hash PK, user_id, expires_at
applications       id, user_id, kind ('project'|'aid'), status
                     ('submitted'|'approved'|'rejected_cut'|'rejected_malformed'),
                   content_enc, hackatime_hours_snapshot, credited_hours (=2),
                   note_enc, decided_by_user_id, decided_at,
                   superseded_by_id, created_at
                   UNIQUE (user_id) WHERE superseded_by_id IS NULL     -- one live app
aid_claims         hc_id_hash PK, created_at                             -- never deleted
funnel_events      id, anon_id, user_id NULL, step, meta jsonb, created_at
```

- **Delete** (pending only) is a hard `DELETE` of the application row, which also removes its content. The `aid_claims` row stays.
- **Resubmit after malformed** inserts a new row and sets `superseded_by_id` on the old one in the same transaction.
- **Aid eligibility at submit:** allowed if there's no `aid_claims` row, **or** the live application being replaced is `kind='aid' AND status='rejected_malformed'`. The claim row is inserted with `ON CONFLICT DO NOTHING`.
- **Decisions** run as `UPDATE ... WHERE id=$1 AND status='submitted'`, and the action fails if no row was updated. That makes decisions final and safe under concurrent requests. A CHECK constraint requires `note_enc IS NOT NULL` when status is either rejected value.
- The applicant-facing label is mapped in a single place: `submitted -> Under review`, `approved -> Accepted`, `rejected_cut -> Not accepted`, `rejected_malformed -> Needs changes`.

### 7. Admin authorization
`ADMIN_HACKCLUB_IDS` is a comma-separated list, read at startup. A `requireAdmin()` guard compares the signed-in user's decrypted Hack Club ID against it, and every admin page and action calls it first. Admin routes live under `/admin`, and middleware adds an early redirect, but the guard inside each action is the real check.

### 8. Funnel tracking
- An `anon_id` cookie (random UUID, first-party, 1 year) is set by middleware on the first visit.
- A `visit` event is written once per anon_id per day from server components on public pages, to avoid counting every page load.
- On sign-in, `UPDATE funnel_events SET user_id=$u WHERE anon_id=$a AND user_id IS NULL` links the earlier events.
- Funnel query: `COUNT(DISTINCT COALESCE(user_id::text, anon_id))` per step within the date range. No IPs, and the user agent isn't stored.

### 9. YouTube link validation
Accept `youtube.com/watch?v=`, `youtu.be/` and `youtube.com/shorts/` URLs, normalize them to a canonical watch URL, then call `https://www.youtube.com/oembed?url=...&format=json`, which works for public and unlisted videos and fails for private or removed ones. Fail closed if oEmbed is unreachable, with a "try again" message.

### 10. Visual design: match the Fellows Fund mockups with local tokens and components
The two mockups (apply page and landing page) set the look. The flow is set by the specs, not the mockup.
- **Type:** a condensed editorial serif for everything, loaded through `next/font`. Headings, labels, nav links and buttons are uppercase. Body and helper copy is lowercase with a playful "™". Start with *Instrument Serif* and swap in the source font if a design file turns up.
- **Color tokens (CSS variables):** `--bg #ffffff`, `--topbar #2b3a42` (thin strip across the top of every page), `--ink #111`, `--ink-muted #4a5560`, `--panel #f5f6f8`, `--line #e3e6ea`, `--accent #c2410c` (links, checkboxes, focus ring), and `--cta-from #f9c79a` → `--cta-to #f08a3c` for the primary button.
- **Components:**
  - `SiteShell`: top strip, site name and nav, with REVIEW visible to admins only.
  - `Button`: gradient fill, soft shadow and 1px darker border. Disabled is pale peach with muted text.
  - `TextLink`: an underlined uppercase action such as "START RECORDING".
  - `Field` / `TextArea`: flat, hairline border, small uppercase label above.
  - `Panel`: gray block with a hairline border, used for the fee box, how-it-works cards and the video box.
  - `Accordion`: FAQ row with an "OPEN"/"CLOSE" control, built on `<details>`/`<summary>` or `aria-expanded`.
  - `PhotoStrip`: horizontal scroll that fades at both ends.
- **Layout:** forms sit in one column about 550px wide. The landing page and admin use an about 770px container. On mobile, both collapse to the 16px side gutter and the how-it-works cards stack.
- **Admin pages** reuse the same tokens. Tables are hairline-ruled and status labels are uppercase small caps, so nothing comes from a dashboard kit.
*Alternative:* a component library (shadcn/ui, Mantine). Its defaults would fight the editorial look and add more to override than to build.

## Risks / Trade-offs

- [Hackatime OAuth endpoints, scopes, or the per-project hours API don't match assumptions] → Task 1 is a spike against the real API before any dependent work. If OAuth isn't available, the fallback is the Hackatime API key the user pastes. That changes only the connect UI, not the specs.
- [Losing the encryption key makes all PII unrecoverable] → Store keys in the host's secret manager with an offline backup, and record the key versions in the deploy runbook.
- [The `LOOKUP_KEY` can't be rotated] → Accepted. It only protects identifiers from being matched against a dump. Document it.
- [Applicants may upload a public, long, or wrong video] → Covered by acknowledgements. Admins can reject as malformed.
- [Anonymous visit counts inflate from bots] → Skip known bot user agents at write time (without storing the UA). Funnel numbers are directional, not audited.
- [The admin allowlist needs a redeploy to change] → Accepted, given how small the admin team is.
- [Hackatime's reported hours can drop after submission (e.g., the user deletes heartbeats)] → The snapshot at submit is authoritative for the program.

## Migration Plan

New deployment, nothing to migrate. Steps: provision Postgres → set secrets (OAuth clients, `ENCRYPTION_KEYS`, `ENCRYPTION_ACTIVE_KEY_VERSION`, `LOOKUP_KEY`, `ADMIN_HACKCLUB_IDS`) → run migrations → deploy → do a smoke test of both paths with a test account. To roll back, redeploy the previous build. Migrations only add things.

## Open Questions

- Hosting target (Vercel, Railway, Coolify, ...). Doesn't change the code; only affects where secrets live.
- Exact copy for the disclosures and acknowledgements. The required meaning is fixed by the specs; the wording can be polished during implementation, in the lowercase voice of the mockups.
- Final display font and exact hex values, if the mockups have a source file. The tokens above are close approximations taken from screenshots.
- Fellow photos and FAQ answers. Placeholders ship until content is provided.
