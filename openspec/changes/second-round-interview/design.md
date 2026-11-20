# Design

## Context

- `decide()` (`src/lib/admin/service.ts`) does a single conditional update from `submitted` to a final status. It writes `decidedAt`, `decidedByUserId`, `noteEnc` and `justificationEnc`, calls `onDecision()` to release or reopen the team, and records the `decided` funnel event with dedupe key `decided:<id>`.
- DB checks on `applications`:
  - `applications_decision_recorded`: `status = 'submitted'` exactly when the decision columns are null.
  - `applications_rejection_needs_note`: cut and malformed need `note_enc`.
  - `applications_only_rejected_superseded`: only rejected applications can be superseded.
- The Airtable sync picks project applications with status in `SYNCED_STATUSES` (`approved`, `rejected_cut`) and no `airtable_record_id`. Records are created once and never updated. The pushed fields include the justification but no status.
- Portal: `letterOutcome()` maps a status to a letter. `decisionSeen()` compares the `ff_decision_seen` cookie to the **application id** only.
- `canReplace()` allows a new application only over rejected statuses, so `interview` already blocks reapplying with no change needed.

## Goals / Non-Goals

**Goals:**
- Two decision rounds on one application row, with neither round's record overwriting the other.
- Reuse the existing letter, status card and decision form patterns instead of building a parallel flow.

**Non-Goals:**
- Knowing whether the founder actually booked (no Calendly API or webhooks).
- Reminders or nudges to book.
- Changing or deleting Airtable records after round 2, including after a fraud rejection in round 2.
- Moving existing `approved` applications back into an interview.

## Decisions

### 1. New `interview` status on the same row, with round-2 columns
`application_status` gains `interview`. The existing decision columns stay as the **first-pass** record. New nullable columns hold round 2: `final_decided_at`, `final_decided_by_user_id`, `final_note_enc` and `final_justification_enc`. These are encrypted with their own bindings (`column: "final_note_enc"` and so on) so a round-1 ciphertext can't be swapped into round 2.

Check changes:
- `applications_rejection_needs_note` becomes `status NOT IN (cut, malformed) OR note_enc IS NOT NULL OR final_note_enc IS NOT NULL`. The service still enforces that the round that cuts writes the note.
- New `applications_final_decision_recorded`: `(final_decided_at IS NULL) = (final_decided_by_user_id IS NULL)`, and `final_decided_at IS NULL OR status IN ('approved','rejected_cut','rejected_fraud')`.
- `applications_decision_recorded` is unchanged: `interview` is decided, so it has first-pass columns.

*Alternative considered:* a separate `interviews` table. It's cleaner in theory, but every reader (view, admin detail, letter) would then join for what is always exactly zero or one extra decision. Columns keep `toView` simple.

*Alternative considered:* overwriting the decision columns in round 2. Rejected because it loses the first-pass justification that Airtable already received and breaks the audit trail.

### 2. One `decide()` entry point; the round comes from the current status
`Decision` gains `select`. Allowed decisions by round:
- From `submitted`: `approve` (now → `interview`), `reject_cut`, `reject_malformed`, `reject_fraud`.
- From `interview`: `select` (→ `approved`), `reject_cut`, `reject_fraud`.

Anything else returns a new error, `wrong_round`. The update's `WHERE` pins the expected current status (`submitted` or `interview`) plus `superseded_by_id IS NULL`, so concurrent double-decides still fail as `already_decided`. Round 1 writes the existing columns. Round 2 writes the `final_*` columns. `DECISION_RULES` gets a per-round entry for `select`: note optional, justification required (internal, never synced).

The form posts the same action. The admin page renders `DecisionForm` with `round={1|2}` and the matching options.

### 3. Team lifecycle
`onDecision(tx, teamId, status)` accepts `interview` and keeps the team locked (no release, no reopen). The round-2 final statuses release the team as today.

### 4. Airtable syncs at `interview`
`SYNCED_STATUSES = ["interview", "approved", "rejected_cut"]`. The `airtable_record_id IS NULL` guard already prevents re-syncing when the status later changes. `approved` stays in the list so legacy approvals that never synced still get picked up. The justification sent is always the first-pass one.

### 5. View exposes the latest round
`ApplicationView` gets `round2: boolean`, and `toView()` exposes the latest round's `note` and `decidedAt`. The letter, status card and dates keep reading `app.note` and `app.decidedAt` unchanged. The admin detail reads both rounds explicitly.

### 6. Letters and the decision-seen cookie
`letterOutcome()` returns `"interview" | "admitted" | "rejected" | null`. `letterBody` and `LETTER_CLOSING` in `src/content/portal.ts` get an `interview` entry. The cookie value changes from `<app id>` to `<app id>:<status>`, so reading the interview letter doesn't count as reading the round-2 outcome on the same application. Old cookies (bare id) simply won't match, which means a one-time re-reveal of an already-seen decision. That's harmless.

### 7. Booking link
`INTERVIEW_BOOKING_URL` is a constant in `src/content/portal.ts`. A pure helper, `interviewBookingUrl({ name, email, applicationId })`, builds the URL with `URLSearchParams` and omits empty values. It's rendered only when `viewer === "founder"` (status card) and `!partner` (letter page), as an external link with `target="_blank" rel="noopener noreferrer"`. The founder's name and email come from the signed-in user's PII, which the founder is viewing anyway.

### 8. Funnel
`funnel_step` gains `interviewed`, recorded on round-2 decisions with meta `{ decision: <final status> }` and dedupe key `interviewed:<id>`. The round-1 event stays `decided`, with `decision: "interview"` on approvals. The funnel page adds an `interviewed` row and its outcome split.

### 9. Labels
- `APPLICANT_LABEL.interview` = "Interview"
- `ADMIN_LABEL.interview` = "Interview"
- The admin filter's `STATUSES` includes `interview`.
- The round-1 approve hint becomes "invites them to a second-round interview. synced to airtable."

## Risks / Trade-offs

- [Fraud found at interview leaves an Airtable record] → The admin page shows a notice on round-2 fraud rejections that have an Airtable record ("remove the record by hand"). Automating that is out of scope.
- [Invited founders who never book sit in `interview` forever] → It's visible through the admin "Interview" filter. The admin can cut them, with a note, at any time.
- [Postgres `ALTER TYPE ... ADD VALUE` can't be used in the same transaction that references the new value] → The migration adds enum values in their own statements, before any check constraint references `interview`. Split the migration if drizzle-kit bundles them.
- [Existing e2e journeys assume approve means "you're in"] → Update them to approve, then select. Add one journey covering invite → book link → select.

## Migration Plan

1. Generate `drizzle/0008_second_round_interview.sql`: add the enum values, add the `final_*` columns, replace `applications_rejection_needs_note`, and add `applications_final_decision_recorded`.
2. Deploy. Existing rows are valid unchanged: `approved` rows have null `final_*` columns.
3. Rollback: there's no data to undo until someone is invited. Rows already in `interview` would need deciding (or manually setting back to `submitted` with the decision columns cleared) before the enum value could be dropped. In practice, roll forward.
