# Spec Delta

## MODIFIED Requirements

### Requirement: Fee and aid unaffected by team size
The project-path application fee SHALL be 2 hours™ for each person on the team as locked at submit, counting the founder and every partner. The founder's selected project SHALL pay the whole fee, and partners SHALL NOT pay hours. On the aid path, no hours SHALL be charged and only the founder's aid attempt SHALL be used up.

#### Scenario: Solo project application
- **WHEN** a founder with no partners submits on the project path
- **THEN** the fee is 2 hours, credited against the founder's selected project

#### Scenario: Project application with partners
- **WHEN** a founder with 3 partners submits on the project path
- **THEN** the fee is 8 hours, credited only against the founder's selected project, and no partner is charged any hours

#### Scenario: Aid application with partners
- **WHEN** a founder with 2 partners submits on the aid path
- **THEN** no hours are charged, the founder's aid attempt is used up, and each partner can still request aid on a later application of their own

#### Scenario: Team grows before submit
- **WHEN** a partner joins after the founder opened the form, and the founder submits without reviewing the team
- **THEN** the system refuses the submission as a stale team, and after the founder reviews it the fee shown is the one for the new team size
