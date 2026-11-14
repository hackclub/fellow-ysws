# Spec Delta

## Purpose

The public face of Hack Club Fellows Fund™: a landing page that explains the program and leads to the application, plus the site-wide navigation and the step-by-step layout of the apply form.

## ADDED Requirements

### Requirement: Landing page content
The public landing page SHALL show a strip of fellow photos, the headline "We back teenage hackers like you.", a "Why Fellows?" list, an "Apply to Fellows Fund™" call to action, a three-step "How it works" section, and a FAQ.

#### Scenario: Visitor opens the landing page
- **WHEN** any visitor, signed in or not, opens the site root
- **THEN** all landing sections are shown, and the call to action leads to the apply page

#### Scenario: How it works steps
- **WHEN** the visitor views "How it works"
- **THEN** three steps are shown in order: applying (a 1-minute pitch or project plus 2 hours™), weeks 1–9 building online with the cohort, and week 10 in San Francisco pitching investors

### Requirement: FAQ accordion
Each FAQ entry SHALL be collapsed by default and SHALL expand and collapse when activated by mouse or keyboard.

#### Scenario: Open an entry
- **WHEN** the visitor activates a collapsed FAQ entry
- **THEN** its answer is shown and its control changes from "Open" to "Close"

#### Scenario: Keyboard access
- **WHEN** a keyboard user focuses a FAQ entry and presses Enter or Space
- **THEN** the entry toggles and its expanded state is announced to assistive technology

### Requirement: Site navigation
Every page SHALL show the site name "Hack Club Fellows Fund™" linking to the landing page, and nav links for APPLY, SUBMISSIONS (the applicant status page) and FAQ. The REVIEW link SHALL appear only for admins.

#### Scenario: Non-admin navigation
- **WHEN** a visitor or non-admin applicant views any page
- **THEN** the nav shows APPLY, SUBMISSIONS and FAQ, and no REVIEW link

#### Scenario: Admin navigation
- **WHEN** an allowlisted admin views any page
- **THEN** the nav also shows a REVIEW link to the admin area

#### Scenario: Current page
- **WHEN** the user is on the apply page
- **THEN** the APPLY nav link is marked as the current page

### Requirement: Numbered apply steps
The apply form SHALL present its fields as numbered sections in a fixed order, and the sections shown SHALL match the chosen path (project or financial aid).

#### Scenario: Project path steps
- **WHEN** the applicant is on the project path
- **THEN** numbered sections cover choosing the Hackatime project, the project links and description, and paying the 2-hour application fee™

#### Scenario: Aid path steps
- **WHEN** the applicant checks "Request financial aid"
- **THEN** the project sections are replaced by numbered sections for the 1-minute video, the aid reason, and the acknowledgements

### Requirement: Submit button lists what is missing
The submit button SHALL stay disabled while required fields or acknowledgements are incomplete, and a line below it SHALL list what's still missing in plain words.

#### Scenario: Incomplete form
- **WHEN** the applicant hasn't picked a project or entered a code URL
- **THEN** the submit button is disabled and the line reads "still missing:" followed by those items

#### Scenario: Complete form
- **WHEN** every required field and acknowledgement is filled in
- **THEN** the button is enabled and the "still missing" line is gone

#### Scenario: Project-path button label
- **WHEN** the applicant is on the project path
- **THEN** the submit button reads "Pay 2 hours & submit"
