# Spec Delta

## Purpose

The second-round interview stage between a first-pass approval and final selection: how an invited team learns about it, how the founder books it, and what each round-2 outcome means for the applicant.

## ADDED Requirements

### Requirement: Interview invitation letter
When an application is invited to interview, the applicant portal SHALL show "Decision ready" until the viewer opens the letter, like any other decision. The letter SHALL tell the team they made it to the second round, SHALL NOT say they are admitted, and SHALL include the reviewer's optional note.

#### Scenario: Invite revealed through the letter
- **WHEN** a founder whose application was invited to interview opens their portal for the first time since the invite
- **THEN** they see "Decision ready" and, after opening the letter, a letter that invites them to a second-round interview

#### Scenario: Invite letter is not an admission
- **WHEN** an applicant reads an interview invitation letter
- **THEN** it doesn't say they are in FELLOWS FUND™

#### Scenario: Note on the invite
- **WHEN** the reviewer added a note to the first-pass approval
- **THEN** the interview letter shows it as "A note from the team"

### Requirement: Founder books the interview
Only the founder SHALL be offered the interview booking link, both on the interview letter and on their status card after reading it. The link SHALL open `https://calendly.com/sebastianhernandez-hackclub/2nd-round-hack-club-fellows` in a new tab.

#### Scenario: Founder sees the booking button
- **WHEN** a founder has read their interview letter and returns to their portal
- **THEN** their status card shows the interview status with a "Book your interview" button

#### Scenario: Partner doesn't get the link
- **WHEN** a partner on an application invited to interview views the letter or their portal
- **THEN** they are told the founder will book the interview for the team, and no booking link is shown

### Requirement: Prefilled booking link
The booking link SHALL be prefilled with the founder's name and email, when known, and SHALL carry the application id so a booking can be matched to its application. Values SHALL be URL-encoded, and a missing name or email SHALL be left out rather than sent empty.

#### Scenario: Prefilled link
- **WHEN** a founder named "Ada Lovelace" with email "ada@example.com" opens the booking link
- **THEN** the URL includes `name=Ada%20Lovelace`, `email=ada%40example.com` and `utm_content=<application id>`

#### Scenario: Founder without an email
- **WHEN** the founder's email is unknown
- **THEN** the link has no `email` parameter and still opens Calendly

### Requirement: Interview outcome reveal
After the round-2 decision, the portal SHALL show "Decision ready" again, even if the viewer already read the interview letter. Opening it SHALL show the admission letter for Select, or the rejection letter (with the option to apply again) for Cut.

#### Scenario: Selected after interview
- **WHEN** an application is selected after interview and the founder, who already read the interview letter, opens their portal
- **THEN** they see "Decision ready", and opening it shows the admission letter

#### Scenario: Cut after interview
- **WHEN** an application is cut after interview and the founder opens the letter
- **THEN** they see the rejection letter with the round-2 note and can start a new application

### Requirement: Interview status in the portal
While an application is in the interview stage, the applicant SHALL see the "Interview" status, SHALL NOT be able to delete or replace the application, and the team SHALL stay locked.

#### Scenario: Can't reapply during interview
- **WHEN** a founder whose application is in the interview stage visits the application form
- **THEN** they can't submit a new application

#### Scenario: Team stays locked
- **WHEN** an application is invited to interview
- **THEN** its members can't leave the team or join another team until the round-2 decision
