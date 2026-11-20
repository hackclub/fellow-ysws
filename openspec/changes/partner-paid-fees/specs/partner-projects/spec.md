# Spec Delta

## Purpose

Lets each partner on an "everyone pays for themselves" team pay their own 2 hours™ with a shipped project of their own, which is reviewed and recorded alongside the founder's.

## ADDED Requirements

### Requirement: Partner adds their own project
When the team's fee mode is "everyone pays for themselves", a partner SHALL add, from their own signed-in session, a project with: one of their own Hackatime projects with at least 2 hours logged, a code URL, a playable or demo URL, a description, and how they heard about the program. The partner SHALL NOT be asked for a video. The code URL and playable URL SHALL be validated the same way as the founder's.

#### Scenario: Partner saves a project
- **WHEN** a partner on an "everyone pays" team picks a 3h 02m Hackatime project and fills in a GitHub code URL, a demo URL and a description
- **THEN** the project is saved, and the partner is shown as ready on the founder's form

#### Scenario: No video asked of partners
- **WHEN** a partner opens their project form
- **THEN** there is no video field

#### Scenario: Project under 2 hours
- **WHEN** a partner's Hackatime projects all have less than 2 hours logged
- **THEN** no project can be picked, and the partner is told they need a project with 2 hours or more, or that the founder can choose to pay for the team

#### Scenario: Founder pays mode
- **WHEN** the team's fee mode is "I'll pay for everyone"
- **THEN** the partner isn't asked for a project and is told the founder is covering their hours

### Requirement: Partner project hours recorded on save
When a partner saves their project, the system SHALL record the project's logged time and the partner's Hackatime account as reported by Hackatime at that moment. The system SHALL NOT need the partner to be online when the founder submits.

#### Scenario: Founder submits later
- **WHEN** a partner saved a project showing 3h 02m, and the founder submits the next day while the partner is offline
- **THEN** the application records 3h 02m as that partner's snapshot

#### Scenario: Hackatime unavailable on save
- **WHEN** Hackatime fails or times out while a partner saves their project
- **THEN** the project isn't saved, the partner sees an error with a retry option, and they stay not ready

### Requirement: Partner edits their project
A partner SHALL be able to edit or replace their saved project while the team is open, including after "Needs changes". Every save SHALL take a fresh hours snapshot and SHALL count as a team change for the founder's form.

#### Scenario: Edit after "Needs changes"
- **WHEN** an application is marked "Needs changes" with a note about a partner's broken demo link, and that partner updates the URL
- **THEN** the change is saved and the founder's next submit uses the updated project

#### Scenario: Edit while the founder's form is open
- **WHEN** a partner edits their project after the founder loaded the form
- **THEN** the founder's submit is refused as a changed team, and after reviewing it shows the updated project

#### Scenario: Locked team
- **WHEN** the application is pending review
- **THEN** the partner can see their submitted project but can't edit it

### Requirement: Partner projects frozen at submit
On an "everyone pays" submission, the system SHALL store each partner's project, logged-time snapshot, Hackatime account and 2 hours credited on the application as they were at submit. Later edits by the partner SHALL NOT change a submitted application.

#### Scenario: Submitted copy is fixed
- **WHEN** a partner's project is submitted with a 3h 02m snapshot, and the application is later marked "Needs changes" and the partner edits their project
- **THEN** the earlier application still shows the project and snapshot as submitted

### Requirement: Partner sees their own submitted project
A partner on an "everyone pays" application SHALL see their own submitted project (Hackatime project, links, logged and credited hours) on the team's status page.

#### Scenario: Partner opens the status page
- **WHEN** a partner opens the status page of a pending "everyone pays" application
- **THEN** they see the status label, the team, and their own project with 2h credited
