# Spec Delta

## MODIFIED Requirements

### Requirement: Project-path disclosures
The project-path form SHALL present the fee as 2 hours per person on the team ("we don't take money, we take time") and SHALL let the founder choose whether they pay for everyone or everyone pays for themselves. Before the applicant submits, it SHALL show the current fee mode, team size and what each project pays, and SHALL say that the program credits only the fee from each paying project, that the remaining hours can be reshipped to another program, and that the project doesn't have to be their startup.

#### Scenario: Disclosures shown
- **WHEN** the applicant views the project-path form
- **THEN** the per-person fee framing, the fee mode choice, what each project pays and all the statements are visible before the submit button

#### Scenario: Fee follows the team on the form
- **WHEN** the founder's team on the form changes from 1 person to 3 in "I'll pay for everyone"
- **THEN** the fee shown changes from 2 hours to 6 hours from the founder's project

#### Scenario: Fee in everyone-pays mode
- **WHEN** the founder has 2 partners and chooses "everyone pays for themselves"
- **THEN** the form says the founder's project pays 2 hours and lists each partner as paying 2 hours from their own project, marked ready or not ready

### Requirement: Credited hours recorded
The system SHALL record, at submission, each paying project's total logged hours as reported by Hackatime and its credited hours. In "I'll pay for everyone", the founder's project SHALL be credited 2 hours times the number of people on the team as locked at submit, and the system SHALL reject a submission whose selected project has less logged time than that. In "everyone pays for themselves", the founder's project and each partner's project SHALL each be credited 2 hours. Applications submitted before these rules SHALL keep their recorded hours.

#### Scenario: Snapshot at submit
- **WHEN** a founder with 2 partners submits in "I'll pay for everyone" with a project showing 14h 30m logged
- **THEN** the application stores 14h 30m as the snapshot and 6h as credited, and later changes on Hackatime don't change either value

#### Scenario: Project below the team's fee
- **WHEN** a founder with 3 partners submits in "I'll pay for everyone" with a project showing 7h 10m logged
- **THEN** the system rejects the submission and says the project needs 8 hours for a team of 4

#### Scenario: Everyone pays
- **WHEN** a founder with a 2h 30m project and 2 ready partners submits in "everyone pays for themselves"
- **THEN** the founder's project is recorded with a 2h 30m snapshot and 2h credited, and each partner's project is recorded with its own saved snapshot and 2h credited

#### Scenario: Earlier applications unchanged
- **WHEN** an application submitted under an earlier fee rule is viewed after this change
- **THEN** it still shows the hours credited when it was submitted

### Requirement: One live application per user
The system SHALL allow each user at most one live application. An application stops being live only when it's deleted while pending, or when it has been marked "Needs changes", "didn't make the cut", or rejected for fraud without banning its founder, and is then replaced by a new submission. A user who is tied up as a partner on another team SHALL NOT submit an application of their own.

#### Scenario: Second submission blocked
- **WHEN** a user who has an application under review, accepted, or not accepted tries to submit another
- **THEN** the system refuses and sends them to their status page

#### Scenario: Submission is final
- **WHEN** an applicant has submitted an application
- **THEN** the system offers no way to edit its contents

#### Scenario: Partner on another team blocked
- **WHEN** a user who is a partner on an open team, or on a team whose application is under review or marked "Needs changes", tries to submit an application
- **THEN** the system refuses and sends them to that team's status page

#### Scenario: Founder not at fault after a partner's fraud
- **WHEN** a founder's application was rejected for fraud and a partner, not the founder, was banned
- **THEN** the founder's status page says the application wasn't accepted and offers a new application, and the founder can form a team, join one, and submit a new application that replaces the old one

#### Scenario: Banned founder stays blocked
- **WHEN** a founder's application was rejected for fraud and the founder was banned
- **THEN** the founder can't submit, form a team or join one, and the status page says they can't apply again
