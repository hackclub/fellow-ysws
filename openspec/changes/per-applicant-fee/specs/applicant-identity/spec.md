# Spec Delta

## MODIFIED Requirements

### Requirement: Eligible project listing
The system SHALL list only the connected applicant's Hackatime projects with at least 2 hours of logged time, and SHALL show each project's total logged time. A listed project with less logged time than the current team's fee SHALL be shown but not selectable, with a note giving the hours needed and the team size.

#### Scenario: Projects under 2 hours are hidden
- **WHEN** the applicant's Hackatime account has projects with 1h 59m and 5h 10m logged
- **THEN** only the 5h 10m project appears as a choice

#### Scenario: Project below the team's fee
- **WHEN** a founder with 2 partners has projects with 14h 20m and 4h 30m logged
- **THEN** both are listed, the 14h 20m project can be selected, and the 4h 30m project can't be selected and reads "needs 6h for a team of 3"

#### Scenario: Selected project falls below the fee
- **WHEN** the founder has selected a 4h 30m project and their team on the form grows to 3 people
- **THEN** the project is no longer selected, it shows the "needs 6h for a team of 3" note, and the submit button lists a project as still missing

#### Scenario: No project covers the team's fee
- **WHEN** the founder has projects with 2h or more but none reaches the current team's fee
- **THEN** the projects are listed but not selectable, and the system says none of them cover the fee yet and suggests building more or removing a partner

#### Scenario: No eligible projects
- **WHEN** none of the applicant's Hackatime projects reach 2 hours
- **THEN** the system says no projects are eligible yet and mentions that the financial-aid path is available to people new to Hack Club

#### Scenario: Hackatime unavailable
- **WHEN** the Hackatime API fails or times out while projects are loading
- **THEN** the system shows an error with a retry option and does not let the applicant submit a project-path application with an unverified project
