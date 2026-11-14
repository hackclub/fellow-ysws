# Spec Delta

## MODIFIED Requirements

### Requirement: One live application per user
The system SHALL allow each user at most one live application. An application stops being live only when it's deleted while pending or when it has been marked "Needs changes" and then replaced by a resubmission. A user who is tied up as a partner on another team SHALL NOT submit an application of their own.

#### Scenario: Second submission blocked
- **WHEN** a user who has an application under review, accepted, or not accepted tries to submit another
- **THEN** the system refuses and sends them to their status page

#### Scenario: Submission is final
- **WHEN** an applicant has submitted an application
- **THEN** the system offers no way to edit its contents

#### Scenario: Partner on another team blocked
- **WHEN** a user who is a partner on an open team, or on a team whose application is under review or marked "Needs changes", tries to submit an application
- **THEN** the system refuses and sends them to that team's status page
