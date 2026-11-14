# Proposal

## Why

Hack Club Fellows Fund™ (the incubator) needs one place where Hack Clubbers apply. Applicants either back their application with a project they've already logged on Hackatime, or, if they're brand new to Hack Club with an ambitious idea, request financial aid with a short video instead. Today there's no app for this. The project starts from scratch (Next.js + TypeScript + Postgres).

## What Changes

- New Next.js (TypeScript) web app backed by Postgres, styled to match the Fellows Fund mockups (condensed editorial serif, slate and burnt-orange palette, flat bordered panels).
- A public landing page: fellow photo strip, the "We back teenage hackers like *you*." hero, why Fellows, a three-step "How it works", and a FAQ accordion. Site nav: APPLY, SUBMISSIONS, FAQ, plus REVIEW for admins only.
- Sign-in with Hack Club Auth for every applicant. Project-path applicants also connect Hackatime via OAuth.
- An application form with two mutually exclusive paths:
  - **Project path**: pick a Hackatime project with at least 2 hours logged (projects under 2h are hidden), then provide a GitHub code URL, a playable URL, a description and how they heard about us. The page explains that the program credits only 2 hours, that the rest can be reshipped to another program, and that the project doesn't have to be their startup.
  - **Financial aid path** (checkbox): no project. Provide an unlisted YouTube link to a 1-minute video introducing the team and the startup at a high level, a written reason for requesting aid, and how they heard about us. Applicants must confirm that aid is for people entirely new to Hack Club with an ambitious idea (not for avoiding payment), that aid can be requested only once, and what the video must contain.
- Submissions are final. Each user has at most one live application, which they can delete only while it is pending. Requesting aid uses up the user's one aid attempt permanently, even if they delete the application.
- An applicant status page showing applicant-friendly status labels and any reviewer note.
- An admin area, limited to Hack Club user IDs listed in an environment variable, for reviewing applications and deciding: **Approve**, **Reject (didn't make the cut)** (note required), or **Reject (malformed)** (note required, shown to applicant as "Needs changes", and the applicant can resubmit).
- An admin funnel: page visits, sign-ins, Hackatime connections, form starts, submissions (split by project and aid), and decisions.
- PII and application content encrypted at the application layer before being stored in Postgres. Timestamps and other operational metadata stay in plaintext.

## Capabilities

### New Capabilities
- `program-site`: The public landing page, site navigation, and the step-by-step layout of the apply form with its "still missing" submit state.
- `applicant-identity`: Signing in with Hack Club Auth, connecting Hackatime, and listing eligible Hackatime projects.
- `fund-application`: The application form (project and aid paths), required acknowledgements, validation, the one-application and one-aid-attempt rules, deletion, resubmission after "Needs changes", and the applicant status page.
- `application-review`: Admin access control, reviewing applications, and approve/reject decisions with required notes.
- `applicant-funnel`: Recording funnel events and showing the admin conversion funnel.
- `data-protection`: Encrypting PII and application content at rest, and how users are looked up without storing raw identifiers.

### Modified Capabilities
None. This is a new project.

## Impact

- New codebase: Next.js app, Postgres schema and migrations, environment configuration.
- External dependencies: Hack Club Auth (OIDC/OAuth), Hackatime OAuth and its projects API, YouTube oEmbed (to check video links).
- Secrets: OAuth client credentials, an encryption key (versioned), an HMAC key for lookups, and the admin ID allowlist.
- Hosting and Postgres provisioning are needed before launch.
- Content needed: fellow photos for the landing strip and the FAQ answers.
