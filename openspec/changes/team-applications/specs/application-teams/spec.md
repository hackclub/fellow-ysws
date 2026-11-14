# Spec Delta

## Purpose

Lets a founder put up to three partners on their fund application through an invite link, and controls when that team can change and what its members can do while they're on it.

## ADDED Requirements

### Requirement: Founder forms a team
A signed-in user who could submit an application SHALL be able to form a team from the apply form and become its founder. Forming a team SHALL give the founder an invite link. A user SHALL found at most one team at a time.

#### Scenario: Form a team
- **WHEN** an eligible applicant chooses to add partners on the apply form
- **THEN** the system creates a team with them as founder and shows an invite link they can copy

#### Scenario: Ineligible user can't form a team
- **WHEN** a user who already has a live application, or is a partner on another team, tries to form a team
- **THEN** the system refuses

### Requirement: Team size limit
A team SHALL have at most 4 members: the founder plus up to 3 partners.

#### Scenario: Fourth partner refused
- **WHEN** a team already has a founder and 3 partners and someone opens its invite link
- **THEN** the system refuses to add them and says the team is full

#### Scenario: Simultaneous joins
- **WHEN** a team has 2 partners and two people try to join through the link at the same moment
- **THEN** exactly one of them joins and the other is told the team is full

### Requirement: Joining through the invite link
Opening a valid invite link SHALL ask the visitor to sign in with Hack Club if they aren't signed in, then show the founder's name and ask them to confirm before adding them as a partner. Partners SHALL NOT need to connect Hackatime.

#### Scenario: Join a team
- **WHEN** an eligible user opens a valid invite link, signs in with Hack Club and confirms
- **THEN** they become a partner on that team without connecting Hackatime

#### Scenario: User with their own application
- **WHEN** a user who has a live application of their own, in any status, opens a valid invite link
- **THEN** the system refuses to add them and sends them to their status page

#### Scenario: Founder of another open team
- **WHEN** a user who founded a different open team opens a valid invite link
- **THEN** the system refuses and tells them to dissolve their own team first

#### Scenario: Founder opens their own link
- **WHEN** the founder opens their own invite link
- **THEN** the system tells them they're already the founder and adds nothing

### Requirement: Invite link validity
An invite link SHALL work only while its team is open and SHALL stop working when it is replaced. The page for a link that doesn't work SHALL say why: replaced, team full, or team already applied.

#### Scenario: Replaced link
- **WHEN** someone opens an invite link that the founder has since replaced
- **THEN** the system refuses to add them and says the link is no longer valid

#### Scenario: Team already applied
- **WHEN** someone opens the invite link of a team whose application is under review, accepted or not accepted
- **THEN** the system refuses to add them and says the team has already applied

### Requirement: Founder replaces the invite link
While the team is open, the founder SHALL be able to replace the invite link, and the previous link SHALL stop working immediately.

#### Scenario: Replace the link
- **WHEN** the founder replaces the invite link
- **THEN** a new link is shown and the previous one no longer works

### Requirement: Founder kicks partners
While the team is open, the founder SHALL be able to remove any partner. Removing a partner SHALL also replace the invite link. The founder SHALL NOT be able to remove themselves.

#### Scenario: Kick a partner
- **WHEN** the founder removes a partner from an open team
- **THEN** that user is no longer on the team, the invite link is replaced, and the removed user can't rejoin with the old link

#### Scenario: Kick after submission
- **WHEN** the founder tries to remove a partner while the application is under review, accepted or not accepted
- **THEN** the system refuses, even if the request bypasses the user interface

### Requirement: Partners leave
While the team is open, a partner SHALL be able to leave the team themselves.

#### Scenario: Leave an open team
- **WHEN** a partner leaves an open team
- **THEN** they're no longer on it and the founder's team list no longer shows them

#### Scenario: Leave a locked team
- **WHEN** a partner tries to leave while the application is under review
- **THEN** the system refuses

### Requirement: Team locks at submission
Submitting the application SHALL lock the team. The submitted application SHALL list the members the founder saw on the form, and the system SHALL refuse the submission if the team changed after the founder loaded the form.

#### Scenario: Submit with a team
- **WHEN** the founder submits with 2 partners on the team
- **THEN** the application lists the founder and both partners and the team is locked

#### Scenario: Team changed before submit
- **WHEN** a partner leaves after the founder loaded the form and before they press submit
- **THEN** the system refuses the submission and shows the founder the current team to review

#### Scenario: Submit alone
- **WHEN** a founder who never formed a team, or whose partners all left, submits
- **THEN** the application is submitted with the founder as its only member

### Requirement: Team reopens on "Needs changes"
When an application is marked "Needs changes", its team SHALL reopen: joining, kicking, leaving and replacing the link work again. Resubmitting SHALL lock the team again with its members at that moment.

#### Scenario: Fix the team after "Needs changes"
- **WHEN** an application is marked "Needs changes" and the founder kicks one partner and invites a new one
- **THEN** both changes succeed, and the resubmitted application lists the new team

### Requirement: Partners are tied to one team
A partner on an open team, or on a team whose application is under review or marked "Needs changes", SHALL NOT submit their own application, form a team, or join another team.

#### Scenario: Partner tries to apply alone
- **WHEN** a partner on a team whose application is under review opens the apply form
- **THEN** the system refuses and links them to the team's status page

#### Scenario: Partner tries to join a second team
- **WHEN** a partner on an open team opens another team's invite link
- **THEN** the system refuses and tells them they're already on a team

### Requirement: Partners are released
A partner SHALL be released, and free to apply, form a team or join another team, when the team's application is accepted or not accepted, when they leave or are kicked, or when the team is dissolved.

#### Scenario: Released after a decision
- **WHEN** a team's application is marked "Not accepted"
- **THEN** each partner on it can start their own application

#### Scenario: Released after being kicked
- **WHEN** a partner is kicked from an open team
- **THEN** they can start their own application right away

### Requirement: Dissolving a team
The founder SHALL be able to dissolve an open team that has no submitted application. Deleting a pending application SHALL also dissolve its team. Dissolving SHALL release every partner and stop the invite link.

#### Scenario: Delete a pending team application
- **WHEN** the founder deletes their application that's under review
- **THEN** the team is dissolved, every partner is released, and the invite link stops working

### Requirement: Fee and aid unaffected by team size
The application fee SHALL stay 2 hours™ paid by the founder whatever the team size, and partners SHALL NOT pay hours. On the aid path, only the founder's aid attempt SHALL be used up.

#### Scenario: Project application with partners
- **WHEN** a founder with 3 partners submits on the project path
- **THEN** only the founder's selected project is credited, with 2 hours

#### Scenario: Aid application with partners
- **WHEN** a founder with 2 partners submits on the aid path
- **THEN** the founder's aid attempt is used up and each partner can still request aid on a later application of their own

### Requirement: Partner view of the application
A partner SHALL see the team's application status page with the applicant-facing status label, the reviewer note when there is one, and the team members. Partners SHALL NOT edit, submit, delete or resubmit the application.

#### Scenario: Partner sees "Needs changes"
- **WHEN** a partner opens the status page of an application marked "Needs changes"
- **THEN** they see the label, the reviewer note and the team, and no resubmit or delete action
