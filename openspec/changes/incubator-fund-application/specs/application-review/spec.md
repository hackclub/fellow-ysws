# Spec Delta

## Purpose

Lets designated admins review submitted fund applications and record final decisions, each with the note the applicant will see.

## ADDED Requirements

### Requirement: Admin access by allowlist
The system SHALL grant admin access only to signed-in users whose Hack Club user ID appears in the admin allowlist set by environment configuration.

#### Scenario: Allowlisted admin
- **WHEN** a signed-in user whose Hack Club ID is in the allowlist opens the admin area
- **THEN** the system shows the admin area

#### Scenario: Non-admin
- **WHEN** a signed-in user who isn't on the allowlist opens any admin page or calls any admin action
- **THEN** the system refuses access and shows no application data

#### Scenario: Allowlist changes
- **WHEN** a Hack Club ID is removed from the allowlist and the app restarts with the new configuration
- **THEN** that user no longer has admin access

### Requirement: Application review list
The admin area SHALL list applications with their type (project or aid), internal status, and submission time, and SHALL let admins filter by type and status.

#### Scenario: Filter pending aid applications
- **WHEN** an admin filters for aid applications that are pending
- **THEN** only pending financial-aid applications are listed

### Requirement: Application detail view
The admin area SHALL show an application's full decrypted content, including the aid reason and video link for aid applications, and the Hackatime project, logged-hours snapshot, credited hours, code URL and playable URL for project applications.

#### Scenario: View aid application
- **WHEN** an admin opens an aid application
- **THEN** they see the applicant's aid reason, video link, "how did you hear" answer and acknowledgement record

#### Scenario: View replaced application history
- **WHEN** an admin opens an application that replaced an earlier "Needs changes" application
- **THEN** they can see the earlier application and its note

### Requirement: Review decisions
An admin SHALL be able to decide a pending application as Approve, Reject (didn't make the cut), or Reject (malformed). Both reject decisions SHALL require a non-empty note to the applicant.

#### Scenario: Approve
- **WHEN** an admin approves a pending application
- **THEN** its status becomes approved and the applicant sees "Accepted"

#### Scenario: Reject without a note
- **WHEN** an admin submits either reject decision with an empty note
- **THEN** the system refuses the decision, even if the request bypasses the user interface

#### Scenario: Reject as malformed
- **WHEN** an admin rejects an application as malformed with a note
- **THEN** the applicant sees "Needs changes" with the note and can resubmit

#### Scenario: Decisions are final
- **WHEN** an application has already been decided
- **THEN** the system doesn't allow another decision on it

### Requirement: Decision audit
The system SHALL record which admin made each decision and when.

#### Scenario: Audit visible
- **WHEN** an admin views a decided application
- **THEN** the deciding admin and decision time are shown
