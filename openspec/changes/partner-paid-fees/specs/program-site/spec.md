# Spec Delta

## MODIFIED Requirements

### Requirement: Numbered apply steps
The apply form SHALL present its fields as numbered sections in a fixed order, and the sections shown SHALL match the chosen path (project or financial aid). Both paths SHALL include a numbered "Team" section, before the fee or acknowledgements, where the founder manages partners. On the project path, the Team section SHALL include the fee mode choice and each partner's project status.

#### Scenario: Project path steps
- **WHEN** the applicant is on the project path
- **THEN** numbered sections cover choosing the Hackatime project, the project links and description, the team with its fee mode, and paying the application fee™ of 2 hours per person on the team

#### Scenario: Aid path steps
- **WHEN** the applicant checks "Request financial aid"
- **THEN** the project sections are replaced by numbered sections for the 1-minute video, the aid reason, the team, and the acknowledgements, and no fee mode choice is shown

#### Scenario: Team section contents
- **WHEN** the founder views the Team section on the project path
- **THEN** it shows the current members, the invite link with copy and replace actions, a remove action for each partner, the fee mode choice ("I'll pay for everyone" / "everyone pays for themselves"), how many of the 3 partner spots are left, and in "everyone pays for themselves" whether each partner's project is ready

#### Scenario: Submit button label
- **WHEN** the applicant is on the project path with a team of 3
- **THEN** the submit button reads "Pay 6 hours & submit" in "I'll pay for everyone" and "Pay 2 hours & submit" in "everyone pays for themselves"

### Requirement: Fee shown on the invite page
The invite (join) page SHALL tell a prospective partner the team's current fee mode and what it means for them: in "I'll pay for everyone", that they don't pay hours and that joining adds 2 hours to the founder's fee; in "everyone pays for themselves", that they'll need to add a shipped project of their own with at least 2 hours on Hackatime, but no video. It SHALL say the founder can change the mode before submitting.

#### Scenario: Invite to a founder-pays team
- **WHEN** a signed-in user opens a valid invite link for an open team in "I'll pay for everyone"
- **THEN** the page says partners don't pay hours and that each person on the team adds 2 hours to the fee the founder pays

#### Scenario: Invite to an everyone-pays team
- **WHEN** a signed-in user opens a valid invite link for an open team in "everyone pays for themselves"
- **THEN** the page says they'll need their own shipped project with 2 hours or more on Hackatime, a code URL and a demo link, and no video

### Requirement: Docs explain the per-person fee
The public docs page SHALL describe the fee as 2 hours per person on the team, explain both fee modes with a worked example for each, and say that in "everyone pays for themselves" each partner needs a shipped project of their own on their own Hackatime account. Its page description SHALL not describe the fee as a flat 2 hours.

#### Scenario: Reader opens the fee section
- **WHEN** a visitor opens the fee section of the docs
- **THEN** it states 2 hours per person, shows a team of 3 paying 6 hours from the founder's 7-hour project, and shows the same team paying 2 hours each from three separate projects
