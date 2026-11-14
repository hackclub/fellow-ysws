# Spec Delta

## Purpose

Lets a signed-in applicant submit one application to the incubator's fund, either backed by a Hackatime project or as a one-time financial-aid request with a video. They can then track, delete or (when asked) resubmit it.

## ADDED Requirements

### Requirement: Project-path application fields
A project-path application SHALL require a selected eligible Hackatime project, a GitHub repository code URL, a playable URL, a description, and how the applicant heard about the program.

#### Scenario: Complete project application
- **WHEN** the applicant selects an eligible project and gives a valid `https://github.com/<owner>/<repo>` code URL, an `http(s)` playable URL, a non-empty description and a "how did you hear" answer
- **THEN** the system accepts the submission

#### Scenario: Non-GitHub code URL
- **WHEN** the code URL is not a GitHub repository URL
- **THEN** the system rejects the submission and says the code URL must be a GitHub repository

#### Scenario: Missing field
- **WHEN** any required project-path field is empty
- **THEN** the system rejects the submission and points out the missing field

### Requirement: Project-path disclosures
The project-path form SHALL present the 2 hours as the application fee ("we don't take money, we take time") and SHALL tell applicants, before they submit, that the program credits only 2 hours of the selected project's time, that the remaining hours can be reshipped to another program, and that the project doesn't have to be their startup.

#### Scenario: Disclosures shown
- **WHEN** the applicant views the project-path form
- **THEN** the application-fee framing and all three statements are visible before the submit button

### Requirement: Credited hours recorded
The system SHALL record, at submission, the selected project's total logged hours as reported by Hackatime, and SHALL record the credited hours as 2.

#### Scenario: Snapshot at submit
- **WHEN** an applicant submits with a project showing 14h 30m logged
- **THEN** the application stores 14h 30m as the snapshot and 2h as credited, and later changes on Hackatime don't change either value

#### Scenario: Project not owned or ineligible
- **WHEN** a submission names a project that isn't in the applicant's current eligible Hackatime project list
- **THEN** the system rejects the submission

### Requirement: Financial-aid application fields
Checking "Request financial aid" SHALL switch the form to the aid path, which requires an unlisted YouTube video link, a written reason for requesting aid, and how the applicant heard about the program, and asks for no project fields.

#### Scenario: Complete aid application
- **WHEN** the applicant checks financial aid and gives a YouTube link that resolves to a video, a non-empty aid reason and a "how did you hear" answer, plus all required acknowledgements
- **THEN** the system accepts the submission without any project, code URL or playable URL

#### Scenario: Non-YouTube or unresolvable link
- **WHEN** the video link isn't a YouTube URL or doesn't resolve to a video
- **THEN** the system rejects the submission and asks for a YouTube link set to unlisted

### Requirement: Financial-aid acknowledgements
The aid path SHALL require the applicant to check separate acknowledgements that: aid is meant for people entirely new to Hack Club with an ambitious idea, not for people who simply don't want to pay; aid can be requested only once; and the video is a roughly 1-minute introduction to the team and, at a high level, what the startup is about.

#### Scenario: Acknowledgement missing
- **WHEN** an aid applicant submits with any acknowledgement unchecked
- **THEN** the system rejects the submission and highlights the unchecked acknowledgement

### Requirement: One live application per user
The system SHALL allow each user at most one live application. An application stops being live only when it's deleted while pending, or when it has been marked "Needs changes" or "didn't make the cut" and then replaced by a new submission.

#### Scenario: Second submission blocked
- **WHEN** a user who has an application under review or accepted tries to submit another
- **THEN** the system refuses and sends them to their status page

#### Scenario: Reapply after a cut
- **WHEN** an applicant whose application didn't make the cut has opened their decision letter and returns to their status page
- **THEN** the system prompts them to apply again, and a new submission replaces the cut application as their live application (financial aid stays once only, so a cut aid applicant reapplies with a project)

#### Scenario: Submission is final
- **WHEN** an applicant has submitted an application
- **THEN** the system offers no way to edit its contents

### Requirement: Pending-only deletion
An applicant SHALL be able to delete their application only while it's pending review. Deleting it SHALL permanently remove its content.

#### Scenario: Delete pending application
- **WHEN** an applicant deletes their application that's under review
- **THEN** the application and its content are removed and the applicant can submit a new one

#### Scenario: Delete decided application
- **WHEN** an applicant tries to delete an application that has been accepted, not accepted, or marked "Needs changes"
- **THEN** the system refuses, even if the request bypasses the user interface

### Requirement: One financial-aid attempt per user
Submitting a financial-aid application SHALL use up the user's single aid attempt permanently. Deleting the application SHALL NOT restore it. The only exception: resubmitting after a "Needs changes" decision on an aid application may use the aid path again.

#### Scenario: Aid after deleting a pending aid application
- **WHEN** a user deletes their pending aid application and starts a new application
- **THEN** the financial-aid option is unavailable and only the project path can be submitted

#### Scenario: Aid after a rejected aid application
- **WHEN** a user's aid application was marked "Not accepted"
- **THEN** the user can't submit any new application

#### Scenario: Aid resubmission after "Needs changes"
- **WHEN** a user's aid application was marked "Needs changes" and they resubmit
- **THEN** the system lets them use the aid path again

#### Scenario: Aid option explains the limit
- **WHEN** a user whose aid attempt is used up views the form
- **THEN** the aid checkbox is disabled with an explanation that aid can be requested only once

### Requirement: Resubmission after "Needs changes"
When an application is marked "Needs changes", the applicant SHALL be able to submit a new application, which replaces the old one as their live application.

#### Scenario: Resubmit
- **WHEN** an applicant whose application shows "Needs changes" submits a new valid application
- **THEN** the new application becomes their live application under review, and the old one stays in the history for admins

### Requirement: Applicant status page
The system SHALL give each applicant a status page showing their submitted application, an applicant-facing status label, and any reviewer note.

#### Scenario: Status labels
- **WHEN** the applicant views their status page
- **THEN** the label reads "Under review" for a pending application, "Accepted" when approved, "Not accepted" when rejected for not making the cut, and "Needs changes" when rejected as malformed

#### Scenario: Reviewer note visible
- **WHEN** the application is "Not accepted" or "Needs changes"
- **THEN** the status page shows the reviewer's note

#### Scenario: Actions by status
- **WHEN** the status is "Under review"
- **THEN** a delete action is available. When it is "Needs changes", a resubmit action is available, and in every other status neither is
