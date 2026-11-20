# Tasks

## 1. Data model

- [x] 1.1 In `src/db/schema.ts`, add `interview` to `application_status` and `interviewed` to `funnel_step`. Add `final_decided_at`, `final_decided_by_user_id`, `final_note_enc` and `final_justification_enc` to `applications`. Update `applications_rejection_needs_note` to accept either note column, and add `applications_final_decision_recorded` (design §1). Add `interview` to `ApplicationStatus`, `APPLICANT_LABEL` and `ADMIN_LABEL` in `src/lib/applications/shared.ts`. Verify `npm run typecheck` passes.
- [x] 1.2 Generate `drizzle/0008_second_round_interview.sql`, with the enum `ADD VALUE`s before any constraint that references them. Verify it applies cleanly to a database with existing `approved` and `rejected_cut` rows, and that `drizzle-kit check` reports the snapshot in sync.

## 2. Review decisions (server)

- [x] 2.1 In `src/lib/applications/service.ts`, add `finalNoteBinding` and `finalJustificationBinding`. Extend `toView` so `note` and `decidedAt` reflect the latest round and `round2` is set (design §5). Verify with an integration test that an application selected after interview shows the round-2 note and date, and that a legacy approved row is unchanged.
- [x] 2.2 Rework `decide()` in `src/lib/admin/service.ts`. Round 1 `approve` now goes to `interview`. Add `select`. Pick the round from the current status, pin it in the `WHERE`, write the `final_*` columns in round 2, and return `wrong_round` for disallowed pairs. Update `DECISION_RULES`, `STATUS_FOR` and the filter `STATUSES`. Map `wrong_round` in `src/app/admin/actions.ts`. Verify in `admin.int.test.ts`:
  - approve → interview
  - select → approved
  - cut after interview requires a note, and the round-1 columns stay intact
  - malformed in round 2 is refused
  - select on a `submitted` or legacy `approved` application is refused
  - a double round-2 decide returns `already_decided`
  - fraud in round 2 bans the chosen member
- [x] 2.3 In `src/lib/teams/service.ts`, make `onDecision` accept `interview` and keep the team locked. Verify in `lifecycle.int.test.ts` that members can't leave or join another team while in interview, and are released after select or cut.
- [x] 2.4 Extend `getApplicationDetail` with the round-2 decider, date, note and justification. Verify with an integration test that both rounds come back for a selected-after-interview application.
- [x] 2.5 In `src/lib/funnel.ts` and `src/lib/admin/funnel.ts`, record `interviewed` (meta `decision`, dedupe `interviewed:<id>`) on round-2 decisions, and add the `interviewed` step and its outcome split to the funnel report. Verify with `funnel.int.test.ts`: invite then select counts one `decided` as `interview` and one `interviewed` as `approved`.

## 3. Airtable sync

- [x] 3.1 In `src/lib/airtable/sync.ts`, set `SYNCED_STATUSES` to `["interview", "approved", "rejected_cut"]` and update the doc comment. Verify in `sync.int.test.ts` that an interview application syncs, that selecting or cutting it afterwards creates no new records, and that partner records on "each pays" sync at interview.

## 4. Applicant portal

- [x] 4.1 In `src/content/portal.ts`, add `INTERVIEW_BOOKING_URL`, the `interview` letter body and closing, and a pure `interviewBookingUrl({ name, email, applicationId })` that omits empty values. Verify with unit tests: encoded name and email, `utm_content` set, missing email omitted.
- [x] 4.2 In `src/lib/applications/portal.ts`, make `letterOutcome` return `interview`, and key the decision-seen cookie as `<id>:<status>` (also in `MarkDecisionSeen`). Verify with a test that a cookie set while in `interview` doesn't count as seen after select.
- [x] 4.3 On `/submissions/decision`, render the interview letter, plus a "Book your interview" button (new tab, prefilled from the signed-in founder) for founders, or "your founder will book the interview" for partners. Verify by running the app as a founder and as a partner on an invited application.
- [x] 4.4 In `StatusCard`, after the interview letter is read, show the interview status: a "Book your interview" button and "Reread your letter" for the founder, and the founder-books copy with no link for partners. Hide the delete button. Verify in `StatusCard.test.tsx`: founder sees the prefilled link, partner sees no link, an unseen interview shows "Decision ready".
- [x] 4.5 In `src/content/docs.tsx`, add an "Interview" status entry and change "Accepted" to mean selected after the interview. Verify by opening `/docs`.

## 5. Admin UI

- [x] 5.1 Give `DecisionForm` a `round` prop. Round 1 keeps its four options, with the approve hint changed to "invites them to a second-round interview. synced to airtable." Round 2 offers Select, Cut and Fraud, with justification hints marked internal and not synced. Verify with a component test that round 2 has no "Needs changes" option.
- [x] 5.2 On the admin application page:
  - render the form for `submitted` (round 1) and `interview` (round 2)
  - show both rounds' audit, notes and justifications
  - include `interview` in the `syncs` check
  - show a "remove the Airtable record by hand" notice on round-2 fraud rejections that have a record

  Verify by running the app through invite → select and invite → fraud.
- [x] 5.3 Add `interview` to the admin list filter and the funnel page's outcome split. Verify by filtering the list to "Interview" in the running app.

## 6. End-to-end

- [x] 6.1 Update `e2e/journeys.spec.ts`, `e2e/admin.spec.ts`, `e2e/teams.spec.ts` and `e2e/helpers.ts` so admission is approve then select. Add a journey: approve → founder reads the interview letter and sees a Calendly link with `utm_content` → partner sees no link → select → founder sees "Decision ready", then the admission letter. Verify `npm run test:e2e` passes.
- [x] 6.2 Run the full unit and integration suites (`npm test`) and `npm run typecheck`. Verify everything passes.
