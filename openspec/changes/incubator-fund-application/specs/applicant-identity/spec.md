# Spec Delta

## Purpose

Establishes who an applicant is through Hack Club Auth and, for project-based applications, links their Hackatime account to list the projects they're eligible to submit.

## ADDED Requirements

### Requirement: Hack Club sign-in
The system SHALL require applicants to sign in with Hack Club Auth before they can view the application form, their status page, or any personal data.

#### Scenario: Unauthenticated visitor opens the form
- **WHEN** a visitor who is not signed in opens the application form
- **THEN** the system sends them to sign in with Hack Club and, once they succeed, returns them to the form

#### Scenario: First sign-in creates an account
- **WHEN** a person signs in with Hack Club for the first time
- **THEN** the system creates an applicant account linked to their Hack Club identity

#### Scenario: Returning applicant
- **WHEN** a person who already has an account signs in again with the same Hack Club identity
- **THEN** the system signs them into their existing account and does not create a duplicate

### Requirement: Hackatime connection for project applications
The system SHALL require an applicant to connect their Hackatime account through OAuth before submitting a project-path application. It SHALL NOT require Hackatime for financial-aid applications.

#### Scenario: Project path without Hackatime
- **WHEN** a signed-in applicant who hasn't connected Hackatime chooses the project path
- **THEN** the system asks them to connect Hackatime before they can pick a project

#### Scenario: Aid path without Hackatime
- **WHEN** a signed-in applicant who hasn't connected Hackatime checks "Request financial aid"
- **THEN** the system lets them fill in and submit the aid application without connecting Hackatime

#### Scenario: Hackatime authorization denied
- **WHEN** the applicant cancels or denies the Hackatime authorization
- **THEN** the system returns them to the form with Hackatime still unconnected and an explanation that the project path needs it

### Requirement: Eligible project listing
The system SHALL list only the connected applicant's Hackatime projects with at least 2 hours of logged time, and SHALL show each project's total logged time.

#### Scenario: Projects under 2 hours are hidden
- **WHEN** the applicant's Hackatime account has projects with 1h 59m and 5h 10m logged
- **THEN** only the 5h 10m project appears as a choice

#### Scenario: No eligible projects
- **WHEN** none of the applicant's Hackatime projects reach 2 hours
- **THEN** the system says no projects are eligible yet and mentions that the financial-aid path is available to people new to Hack Club

#### Scenario: Hackatime unavailable
- **WHEN** the Hackatime API fails or times out while projects are loading
- **THEN** the system shows an error with a retry option and does not let the applicant submit a project-path application with an unverified project

### Requirement: Hackatime credentials not retained
The system SHALL NOT keep Hackatime access tokens after it has fetched the applicant's project list for the current session.

#### Scenario: Token discarded
- **WHEN** the system has fetched an applicant's Hackatime projects
- **THEN** no Hackatime access or refresh token for that applicant remains stored in the database
