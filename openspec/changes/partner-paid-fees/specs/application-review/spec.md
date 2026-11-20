# Spec Delta

## MODIFIED Requirements

### Requirement: Application detail view
The admin area SHALL show an application's full decrypted content, including the aid reason and video link for aid applications, and the Hackatime project, logged-hours snapshot, credited hours, code URL and playable URL for project applications. It SHALL also list the application's team members as submitted, marking which one is the founder, and SHALL show the team's fee mode. In "everyone pays for themselves", it SHALL show each partner's submitted project with its Hackatime project, logged-hours snapshot, credited hours, code URL, playable URL, description and Telescreen link.

#### Scenario: View aid application
- **WHEN** an admin opens an aid application
- **THEN** they see the applicant's aid reason, video link, "how did you hear" answer and acknowledgement record

#### Scenario: View replaced application history
- **WHEN** an admin opens an application that replaced an earlier "Needs changes" application
- **THEN** they can see the earlier application and its note

#### Scenario: View team
- **WHEN** an admin opens an application submitted with a founder and 2 partners
- **THEN** they see all three members' names, with the founder marked

#### Scenario: Team history across resubmission
- **WHEN** an admin opens a resubmitted application whose team changed after "Needs changes"
- **THEN** the earlier application still shows the team it was submitted with

#### Scenario: View everyone-pays application
- **WHEN** an admin opens an "everyone pays for themselves" application with a founder and 2 partners
- **THEN** they see three projects, one per member, each with its code URL, playable URL, logged hours, 2h credited and a Telescreen link for that member's Hackatime account

### Requirement: Review decisions
An admin SHALL be able to decide a pending application as Approve, Reject (didn't make the cut), Reject (malformed) or Reject (fraud). Both the cut and malformed decisions SHALL require a non-empty note to the applicant. A decision SHALL apply to the whole application and every member on it. A fraud decision SHALL reject the whole application and ban exactly one member the admin picks from the application's members, defaulting to the founder.

#### Scenario: Approve
- **WHEN** an admin approves a pending application
- **THEN** its status becomes approved and the applicant sees "Accepted"

#### Scenario: Reject without a note
- **WHEN** an admin submits the cut or malformed decision with an empty note
- **THEN** the system refuses the decision, even if the request bypasses the user interface

#### Scenario: Reject as malformed
- **WHEN** an admin rejects an application as malformed with a note
- **THEN** the applicant sees "Needs changes" with the note and can resubmit

#### Scenario: Decisions are final
- **WHEN** an application has already been decided
- **THEN** the system doesn't allow another decision on it

#### Scenario: Fraud bans the chosen partner
- **WHEN** an admin rejects a team application as fraud and picks one partner to ban
- **THEN** the whole application is rejected, that partner is banned from the program, and the founder and other partners are not banned and can apply again

#### Scenario: Fraud defaults to the founder
- **WHEN** an admin rejects an application as fraud without changing the member to ban
- **THEN** the founder is banned

#### Scenario: Ban target not on the application
- **WHEN** a fraud decision names a user who isn't a member of that application
- **THEN** the system refuses the decision, even if the request bypasses the user interface

## ADDED Requirements

### Requirement: One Airtable record per paying project
The Airtable sync SHALL create one record per paying project on an approved or cut project-path application: one for an "I'll pay for everyone" application, and one per member for an "everyone pays for themselves" application. Each record SHALL carry that member's identity, Hackatime account, code URL, playable URL, logged hours and credited hours, and the application's decision.

#### Scenario: Sync an everyone-pays application
- **WHEN** an approved "everyone pays for themselves" application with 3 members is synced
- **THEN** three Airtable records are created, each with its own member's details and 2h credited

#### Scenario: Partial sync failure
- **WHEN** Airtable accepts some of an application's records and the sync fails before the rest
- **THEN** the next sync creates only the missing records, without duplicating the ones already created

#### Scenario: Sync a founder-pays application
- **WHEN** an approved "I'll pay for everyone" application with 3 members is synced
- **THEN** one Airtable record is created for the founder's project with 6h credited
