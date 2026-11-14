# Spec Delta

## Purpose

Shows admins how visitors move from first page visit through sign-in and submission to a decision, without third-party analytics or storing visitor IP addresses.

## ADDED Requirements

### Requirement: Funnel event recording
The system SHALL record first-party funnel events for these steps: page visit, Hack Club sign-in, Hackatime connected, form started, application submitted (marked project or aid), and application decided (marked with the decision).

#### Scenario: Anonymous visit
- **WHEN** a visitor without an account loads a public page
- **THEN** the system records a visit event tied to an anonymous session identifier

#### Scenario: Session linked on sign-in
- **WHEN** an anonymous visitor signs in
- **THEN** their earlier and later events are attributed to the same person for funnel counting

### Requirement: Funnel privacy
Funnel events SHALL NOT store IP addresses, and SHALL NOT be sent to third-party analytics services.

#### Scenario: No IP stored
- **WHEN** any funnel event is recorded
- **THEN** the stored event contains no IP address

### Requirement: Admin funnel view
The admin area SHALL show, for a selectable date range, the number of unique people at each funnel step and the conversion rate between neighboring steps, with submissions split into project and aid and decisions split by outcome.

#### Scenario: Funnel for a date range
- **WHEN** an admin selects a date range
- **THEN** the funnel shows unique counts per step within that range and the step-to-step conversion percentages

#### Scenario: Non-admin
- **WHEN** a non-admin requests funnel data
- **THEN** the system refuses access
