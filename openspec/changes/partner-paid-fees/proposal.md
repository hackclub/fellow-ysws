# Proposal

## Why

The founder now pays 2 hours™ for every person on the team from one project. That works when a newcomer joins an experienced builder, but it penalizes a team of builders: everyone has shipped, yet only the founder's hours count and the founder needs up to 8h on a single project. Founders should be able to choose: cover the whole team themselves, or have each teammate pay their own 2 hours from a project they shipped. Each paying project should be reviewed and recorded on its own, so it reaches the YSWS Airtable as its own shipped project.

## What Changes

- On the project path, the founder picks a **fee mode** for the team: **"I'll pay for everyone"** (today's behavior: N × 2h from the founder's project) or **"Everyone pays for themselves"** (2h from each person's own project).
- In "everyone pays" mode, each partner adds a **full shipped project**: their own Hackatime project with at least 2h logged, a code URL, a playable/demo URL and a description. Partners don't record a video. The pitch video and the startup description stay the founder's.
- A partner saves their project **in their own session**, because only they hold their Hackatime token. The system records that project's logged time and the partner's Hackatime account id when they save it. The founder can't submit until every partner has saved a project.
- Every person on an "everyone pays" team must use a **different Hackatime account**. Members may share the same code repository.
- The mode applies to the project path only. Aid applications are unchanged.
- Switching modes or editing a partner project counts as a team change, so the existing "your team changed" check catches stale forms. Saved partner projects are kept when the founder switches to "I'll pay for everyone" and ignored at submit.
- At submit, each partner's project is frozen onto the application along with its logged-time snapshot and 2h credited. "Needs changes" reopens the team, and partners can then edit their projects before the founder resubmits.
- **Admin review** shows every paying member's project, code URL, demo URL, logged and credited hours, and Telescreen link on the application. The team still gets one decision.
- **BREAKING (rule)**: A **fraud** rejection rejects the whole application and bans **one member the admin picks** (defaulting to the founder). Today it always bans the founder. A founder who wasn't the one banned can start a new application that replaces the rejected one; the other members are released as today.
- **Airtable sync** creates one record per paying member's project, not one per application.
- Copy updates: apply page (mode choice, partner readiness, fee and button), join page, partner portal, landing FAQ, docs.

## Capabilities

### New Capabilities
- `partner-projects`: how a partner adds, edits and readies their own shipped project in "everyone pays" mode, and how it's frozen on the application.

### Modified Capabilities
- `application-teams`: "Fee and aid unaffected by team size" gains the fee-mode choice; "Team locks at submission" also requires every partner to be ready in "everyone pays" mode and every member to use a distinct Hackatime account; "Partner view of the application" shows the partner's own project.
- `fund-application`: "Project-path disclosures" and "Credited hours recorded" depend on the fee mode.
- `application-review`: "Application detail view" lists each member's project; "Review decisions" adds fraud with a chosen member to ban; adds per-member Airtable records.
- `program-site`: "Numbered apply steps" and the submit button reflect the mode; the invite page explains both modes.

## Impact

- **Data**: new columns on `team_members` (partner project draft, snapshot, Hackatime id, saved-at) and `application_members` (frozen content, snapshot, credited seconds, Hackatime id, Airtable record id); new `teams.fee_mode` and `applications.fee_mode`; new migration `0006`. The existing `applications_hours_match_kind` constraint already accepts a founder credited 2h on an "everyone pays" row.
- **Server**: `src/lib/teams/service.ts` (mode, partner project save, `teamForSubmit`, `lockForApplication`), `src/lib/applications/service.ts::submitApplication`, `src/lib/admin/service.ts::decide` and the detail read, `src/lib/airtable/sync.ts`.
- **UI**: `ApplyForm.tsx`, `TeamSection.tsx`, `ProjectPicker.tsx` (reused for partners), a partner project form on the partner portal (`src/app/submissions/`), `DecisionForm.tsx`, `ApplicationDetails.tsx`, `TelescreenLink.tsx`, `src/app/join/[token]/page.tsx`.
- **Copy**: `src/content/landing.tsx`, `src/content/docs.tsx`.
- **Dependency**: the modified capabilities exist only as deltas in the unarchived `incubator-fund-application`, `team-applications` and `per-applicant-fee` changes. Archive those first so `openspec/specs/` holds the base requirements this change modifies.
