# Spec Delta

## MODIFIED Requirements

### Requirement: Numbered apply steps
The apply form SHALL present its fields as numbered sections in a fixed order, and the sections shown SHALL match the chosen path (project or financial aid). Both paths SHALL include a numbered "Team" section, before the fee or acknowledgements, where the founder manages partners.

#### Scenario: Project path steps
- **WHEN** the applicant is on the project path
- **THEN** numbered sections cover choosing the Hackatime project, the project links and description, the team, and paying the 2-hour application fee™

#### Scenario: Aid path steps
- **WHEN** the applicant checks "Request financial aid"
- **THEN** the project sections are replaced by numbered sections for the 1-minute video, the aid reason, the team, and the acknowledgements

#### Scenario: Team section contents
- **WHEN** the founder views the Team section
- **THEN** it shows the current members, the invite link with copy and replace actions, a remove action for each partner, a note that partners don't pay hours, and how many of the 3 partner spots are left
