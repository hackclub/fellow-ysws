# Spec Delta

## Purpose

Makes sure applicant PII and application content stay unreadable in the database without the app's keys, while still allowing users to be looked up and the business rules to be enforced.

## ADDED Requirements

### Requirement: Encryption of PII and application content
The system SHALL encrypt the following at the application layer before storing them: applicant PII (name, email, Hack Club identifiers, Slack ID), all application form content, and reviewer notes. Timestamps, statuses, application type and hour counts MAY be stored in plaintext.

#### Scenario: Raw database read
- **WHEN** someone reads the application and user tables directly, without the app's encryption key
- **THEN** no applicant name, email, URL, description, aid reason, video link or reviewer note is readable

#### Scenario: Authorized read
- **WHEN** the applicant views their own application, or an admin views any application
- **THEN** the system decrypts and shows the content

### Requirement: Identifier lookup without plaintext
The system SHALL find users and enforce one-application and one-aid-attempt rules using keyed hashes of Hack Club identifiers, not plaintext identifiers.

#### Scenario: Lookup on sign-in
- **WHEN** a returning user signs in
- **THEN** the system finds their account by the keyed hash of their Hack Club ID

#### Scenario: Aid claim survives deletion
- **WHEN** a user's pending aid application is deleted
- **THEN** a record holding only the keyed hash of their Hack Club ID remains, so their aid attempt stays used up

### Requirement: Key versioning
Every encrypted value SHALL record the version of the key used, so keys can be rotated without losing access to older data.

#### Scenario: Decrypt after rotation
- **WHEN** a new encryption key becomes the active version and an older application is opened
- **THEN** the system decrypts it with the key version it was stored under

### Requirement: Tamper detection
The system SHALL use authenticated encryption and SHALL refuse to show a value whose ciphertext fails authentication.

#### Scenario: Corrupted ciphertext
- **WHEN** a stored ciphertext has been modified
- **THEN** decryption fails and the system reports an error instead of showing altered content
