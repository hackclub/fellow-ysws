# Spec Delta

## MODIFIED Requirements

### Requirement: Application detail view
The admin area SHALL show an application's full decrypted content, including the aid reason and video link for aid applications, and the Hackatime project, logged-hours snapshot, credited hours, code URL and playable URL for project applications. It SHALL also list the application's team members as submitted, marking which one is the founder.

#### Scenario: View aid application
- **WHEN** an admin opens an aid application
- **THEN** they see the applicant's aid reason, video link, "how did you hear" answer and acknowledgement record

#### Scenario: View replaced application history
- **WHEN** an admin opens an application that replaced an earlier "Needs changes" application
- **THEN** they can see the earlier application and its note

#### Scenario: View team
- **WHEN** an admin opens an application submitted with a founder and 2 partners
- **THEN** they see all three members' names, with the founder marked

#### Scenario: Team history across resubmission
- **WHEN** an admin opens a resubmitted application whose team changed after "Needs changes"
- **THEN** the earlier application still shows the team it was submitted with
