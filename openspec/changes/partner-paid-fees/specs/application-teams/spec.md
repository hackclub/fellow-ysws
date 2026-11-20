# Spec Delta

## MODIFIED Requirements

### Requirement: Fee and aid unaffected by team size
On the project path, the founder SHALL choose a fee mode for the team: "I'll pay for everyone" or "everyone pays for themselves". In "I'll pay for everyone", the fee SHALL be 2 hours™ for each person on the team as locked at submit, paid from the founder's selected project alone, and partners SHALL NOT pay hours. In "everyone pays for themselves", each person SHALL pay 2 hours from their own project: the founder's selected project SHALL be credited 2 hours, and each partner's own project SHALL be credited 2 hours. On the aid path, the fee mode SHALL NOT apply, no hours SHALL be charged and only the founder's aid attempt SHALL be used up.

#### Scenario: Solo project application
- **WHEN** a founder with no partners submits on the project path
- **THEN** the fee is 2 hours, credited against the founder's selected project, in either mode

#### Scenario: Project application with partners, founder pays
- **WHEN** a founder with 3 partners submits on the project path in "I'll pay for everyone"
- **THEN** the fee is 8 hours, credited only against the founder's selected project, and no partner is charged any hours

#### Scenario: Project application with partners, everyone pays
- **WHEN** a founder with 2 partners submits on the project path in "everyone pays for themselves"
- **THEN** the founder's project is credited 2 hours and each partner's own project is credited 2 hours

#### Scenario: Aid application with partners
- **WHEN** a founder with 2 partners submits on the aid path
- **THEN** no hours are charged, the founder's aid attempt is used up, and each partner can still request aid on a later application of their own

#### Scenario: Team grows before submit
- **WHEN** a partner joins after the founder opened the form, and the founder submits without reviewing the team
- **THEN** the system refuses the submission as a stale team, and after the founder reviews it the fee shown is the one for the new team

#### Scenario: Default mode
- **WHEN** a founder forms a team and hasn't chosen a mode
- **THEN** the mode is "I'll pay for everyone"

### Requirement: Team locks at submission
Submitting the application SHALL lock the team. The submitted application SHALL list the members the founder saw on the form, and the system SHALL refuse the submission if the team, its fee mode, or any partner's project changed after the founder loaded the form. In "everyone pays for themselves", the system SHALL refuse the submission while any partner hasn't saved a project, or if two members' projects come from the same Hackatime account.

#### Scenario: Submit with a team
- **WHEN** the founder submits with 2 partners on the team
- **THEN** the application lists the founder and both partners and the team is locked

#### Scenario: Team changed before submit
- **WHEN** a partner leaves after the founder loaded the form and before they press submit
- **THEN** the system refuses the submission and shows the founder the current team to review

#### Scenario: Submit alone
- **WHEN** a founder who never formed a team, or whose partners all left, submits
- **THEN** the application is submitted with the founder as its only member

#### Scenario: Partner not ready
- **WHEN** a founder in "everyone pays for themselves" has a partner who hasn't saved a project
- **THEN** the submit button is disabled, the "still missing" line names that partner's project, and the server refuses the submission even if the request bypasses the interface

#### Scenario: Shared Hackatime account
- **WHEN** a founder in "everyone pays for themselves" submits and two members' projects came from the same Hackatime account
- **THEN** the system refuses the submission and says each person needs their own Hackatime account

#### Scenario: Shared code repository
- **WHEN** members in "everyone pays for themselves" use different Hackatime accounts but the same code URL
- **THEN** the submission is accepted

### Requirement: Partner view of the application
A partner SHALL see the team's application status page with the applicant-facing status label, the reviewer note when there is one, the team members, the team's fee mode, and, in "everyone pays for themselves", their own project. Partners SHALL NOT edit, submit, delete or resubmit the application. In "everyone pays for themselves", a partner SHALL be able to edit their own project while the team is open.

#### Scenario: Partner sees "Needs changes"
- **WHEN** a partner opens the status page of an application marked "Needs changes"
- **THEN** they see the label, the reviewer note and the team, no resubmit or delete action, and, in "everyone pays for themselves", an action to edit their own project

## ADDED Requirements

### Requirement: Founder chooses the fee mode
The founder SHALL be able to switch the team's fee mode while the team is open. Switching SHALL count as a team change. Partners' saved projects SHALL be kept when the mode switches to "I'll pay for everyone", and SHALL be ignored at submit in that mode.

#### Scenario: Switch to founder pays
- **WHEN** a partner has saved a project and the founder switches to "I'll pay for everyone"
- **THEN** the fee becomes 2 hours per person from the founder's project, the partner's project is kept but not submitted, and switching back shows the partner ready again

#### Scenario: Switch while locked
- **WHEN** the team's application is pending review
- **THEN** the founder can't change the fee mode

#### Scenario: Partners see the mode
- **WHEN** the founder switches to "everyone pays for themselves"
- **THEN** each partner's portal says they need to add their own project
