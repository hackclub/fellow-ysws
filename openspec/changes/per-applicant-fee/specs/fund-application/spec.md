# Spec Delta

## MODIFIED Requirements

### Requirement: Project-path disclosures
The project-path form SHALL present the fee as 2 hours per person on the team ("we don't take money, we take time"). Before the applicant submits, it SHALL show the current total fee and team size, and SHALL say that only the founder's project pays, that the program credits only the fee from that project, that the remaining hours can be reshipped to another program, and that the project doesn't have to be their startup.

#### Scenario: Disclosures shown
- **WHEN** the applicant views the project-path form
- **THEN** the per-person fee framing, the current total fee and all the statements are visible before the submit button

#### Scenario: Fee follows the team on the form
- **WHEN** the founder's team on the form changes from 1 person to 3
- **THEN** the fee shown changes from 2 hours to 6 hours

### Requirement: Credited hours recorded
The system SHALL record, at submission, the selected project's total logged hours as reported by Hackatime, and SHALL record the credited hours as the application's fee: 2 hours times the number of people on the team as locked at submit. The system SHALL reject a project-path submission whose selected project has less logged time than that fee. Applications submitted before this rule SHALL keep their recorded 2 hours.

#### Scenario: Snapshot at submit
- **WHEN** a founder with 2 partners submits with a project showing 14h 30m logged
- **THEN** the application stores 14h 30m as the snapshot and 6h as credited, and later changes on Hackatime don't change either value

#### Scenario: Project below the team's fee
- **WHEN** a founder with 3 partners submits with a project showing 7h 10m logged
- **THEN** the system rejects the submission and says the project needs 8 hours for a team of 4

#### Scenario: Earlier applications unchanged
- **WHEN** an application submitted under the flat 2-hour fee is viewed after this change
- **THEN** it still shows 2h credited
