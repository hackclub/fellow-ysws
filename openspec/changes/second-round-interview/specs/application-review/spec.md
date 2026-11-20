# Spec Delta

## MODIFIED Requirements

### Requirement: Review decisions
An admin SHALL be able to decide a pending application as Approve, Reject (didn't make the cut), Reject (malformed) or Reject (fraud). Approve SHALL invite the application to a second-round interview rather than admit it. An admin SHALL then decide an application in the interview stage as Select (admitted), Reject (didn't make the cut) or Reject (fraud). The cut and malformed decisions SHALL require a non-empty note to the applicant in either round. A decision SHALL apply to the whole application and every member on it. A fraud decision SHALL reject the whole application and ban exactly one member the admin picks from the application's members, defaulting to the founder.

#### Scenario: Approve invites to interview
- **WHEN** an admin approves a pending application
- **THEN** its status becomes interview and the applicant sees "Interview", not "Accepted"

#### Scenario: Select after interview
- **WHEN** an admin selects an application in the interview stage
- **THEN** its status becomes approved and the applicant sees "Accepted"

#### Scenario: Cut after interview
- **WHEN** an admin cuts an application in the interview stage with a note
- **THEN** its status becomes rejected (didn't make the cut), the applicant sees the note in their rejection letter, and they can apply again

#### Scenario: No "Needs changes" in round two
- **WHEN** an admin submits a malformed decision for an application in the interview stage
- **THEN** the system refuses the decision, even if the request bypasses the user interface

#### Scenario: Reject without a note
- **WHEN** an admin submits the cut or malformed decision with an empty note, in either round
- **THEN** the system refuses the decision, even if the request bypasses the user interface

#### Scenario: Reject as malformed
- **WHEN** an admin rejects an application as malformed with a note
- **THEN** the applicant sees "Needs changes" with the note and can resubmit

#### Scenario: Each round is decided once
- **WHEN** an application has already been decided in a round
- **THEN** the system doesn't allow another decision in that round, and doesn't allow a round-2 decision on an application that isn't in the interview stage

#### Scenario: Existing approvals stay final
- **WHEN** an application was approved before the interview stage existed
- **THEN** it stays approved and offers no round-2 decision

#### Scenario: Fraud bans the chosen partner
- **WHEN** an admin rejects a team application as fraud and picks one partner to ban
- **THEN** the whole application is rejected, that partner is banned from the program, and the founder and other partners are not banned and can apply again

#### Scenario: Fraud after interview
- **WHEN** an admin rejects an application in the interview stage as fraud
- **THEN** the whole application is rejected and the chosen member is banned, exactly as in round one

#### Scenario: Fraud defaults to the founder
- **WHEN** an admin rejects an application as fraud without changing the member to ban
- **THEN** the founder is banned

#### Scenario: Ban target not on the application
- **WHEN** a fraud decision names a user who isn't a member of that application
- **THEN** the system refuses the decision, even if the request bypasses the user interface

### Requirement: Decision audit
The system SHALL record which admin made each decision and when, separately for each round, along with that round's note and internal justification. A round-2 decision SHALL NOT overwrite the first-pass record.

#### Scenario: Audit visible
- **WHEN** an admin views a decided application
- **THEN** the deciding admin and decision time are shown

#### Scenario: Both rounds visible
- **WHEN** an admin views an application selected or cut after interview
- **THEN** they see who invited it to interview and when, with that note and justification, and who made the round-2 decision and when, with its note and justification

### Requirement: One Airtable record per paying project
The Airtable sync SHALL create one record per paying project on a project-path application that was invited to interview, approved or cut: one for an "I'll pay for everyone" application, and one per member for an "everyone pays for themselves" application. Each record SHALL carry that member's identity, Hackatime account, code URL, playable URL, logged hours and credited hours, and the first-pass justification. The round-2 outcome SHALL NOT change or re-create any record.

#### Scenario: Sync on interview invite
- **WHEN** a project application is invited to interview and the sync runs
- **THEN** its Airtable records are created, before any round-2 decision

#### Scenario: Round-2 decision doesn't resync
- **WHEN** an application that already has Airtable records is selected or cut after interview
- **THEN** the sync creates no new records for it and changes none

#### Scenario: Sync an everyone-pays application
- **WHEN** an "everyone pays for themselves" application with 3 members is invited to interview and synced
- **THEN** three Airtable records are created, each with its own member's details and 2h credited

#### Scenario: Partial sync failure
- **WHEN** Airtable accepts some of an application's records and the sync fails before the rest
- **THEN** the next sync creates only the missing records, without duplicating the ones already created

#### Scenario: Sync a founder-pays application
- **WHEN** an "I'll pay for everyone" application with 3 members is invited to interview and synced
- **THEN** one Airtable record is created for the founder's project with 6h credited

## ADDED Requirements

### Requirement: Interview stage in the admin list
The admin application list SHALL show applications in the interview stage with an "Interview" label and SHALL let an admin filter to them.

#### Scenario: Filter to interviews
- **WHEN** an admin filters the list by the interview status
- **THEN** only live applications awaiting a round-2 decision are shown

### Requirement: Round-2 outcomes in the funnel
The admin funnel SHALL count round-2 decisions as their own step, split by outcome (selected, cut, fraud), separately from first-pass decisions.

#### Scenario: Invite then select
- **WHEN** an application is invited to interview and later selected
- **THEN** the funnel counts one first-pass decision as "interview" and one round-2 decision as "approved"
