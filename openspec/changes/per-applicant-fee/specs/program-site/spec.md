# Spec Delta

## MODIFIED Requirements

### Requirement: Landing page content
The public landing page SHALL show a strip of fellow photos, the headline "We back teenage hackers like you.", a "Why Fellows?" list, an "Apply to Fellows Fund™" call to action, a three-step "How it works" section, and a FAQ.

#### Scenario: Visitor opens the landing page
- **WHEN** any visitor, signed in or not, opens the site root
- **THEN** all landing sections are shown, and the call to action leads to the apply page

#### Scenario: How it works steps
- **WHEN** the visitor views "How it works"
- **THEN** three steps are shown in order: applying (a 1-minute pitch or project plus 2 hours™ per person on the team, paid by the founder), weeks 1–9 building online with the cohort, and week 10 in San Francisco pitching investors

#### Scenario: Fee FAQ
- **WHEN** the visitor opens the FAQ entry about the fee
- **THEN** it explains that the fee is 2 hours per person on the team, taken from the founder's project, and that partners don't pay hours

### Requirement: Numbered apply steps
The apply form SHALL present its fields as numbered sections in a fixed order, and the sections shown SHALL match the chosen path (project or financial aid). Both paths SHALL include a numbered "Team" section, before the fee or acknowledgements, where the founder manages partners.

#### Scenario: Project path steps
- **WHEN** the applicant is on the project path
- **THEN** numbered sections cover choosing the Hackatime project, the project links and description, the team, and paying the application fee™ of 2 hours per person on the team

#### Scenario: Aid path steps
- **WHEN** the applicant checks "Request financial aid"
- **THEN** the project sections are replaced by numbered sections for the 1-minute video, the aid reason, the team, and the acknowledgements

#### Scenario: Team section contents
- **WHEN** the founder views the Team section
- **THEN** it shows the current members, the invite link with copy and replace actions, a remove action for each partner, a note that each person adds 2 hours to the fee and that only the founder pays it, and how many of the 3 partner spots are left

### Requirement: Submit button lists what is missing
The submit button SHALL stay disabled while required fields or acknowledgements are incomplete, and a line below it SHALL list what's still missing in plain words.

#### Scenario: Incomplete form
- **WHEN** the applicant hasn't picked a project or entered a code URL
- **THEN** the submit button is disabled and the line reads "still missing:" followed by those items

#### Scenario: Complete form
- **WHEN** every required field and acknowledgement is filled in
- **THEN** the button is enabled and the "still missing" line is gone

#### Scenario: Project-path button label
- **WHEN** the applicant is on the project path with a team of 3
- **THEN** the submit button reads "Pay 6 hours & submit", and it reads "Pay 2 hours & submit" for a solo applicant

## ADDED Requirements

### Requirement: Fee shown on the invite page
The invite (join) page SHALL tell a prospective partner that they don't pay hours and that joining adds 2 hours to the founder's fee.

#### Scenario: Partner opens an invite link
- **WHEN** a signed-in user opens a valid invite link for an open team
- **THEN** the page says partners don't pay hours and that each person on the team adds 2 hours to the fee the founder pays

### Requirement: Docs explain the per-person fee
The public docs page SHALL describe the fee as 2 hours per person on the team, paid only from the founder's project, with a worked example for a team, and its page description SHALL not describe the fee as a flat 2 hours.

#### Scenario: Reader opens the fee section
- **WHEN** a visitor opens the fee section of the docs
- **THEN** it states 2 hours per person, that only the founder pays, that the project needs at least the full fee logged, and shows an example such as a team of 3 paying 6 hours from a 7-hour project
