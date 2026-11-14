# Airtable sync (YSWS Project Submission)

Admins press **Sync to Airtable** on `/admin`. It creates one record per finished project review
that hasn't been synced yet. Code: `src/lib/airtable/sync.ts` (what syncs) and
`src/lib/airtable/fields.ts` (field mapping).

## What syncs
| Decision | Synced? | Applicant sees |
|---|---|---|
| Approve (justification required) | yes | admission letter |
| Reject — didn't make the cut (note + justification required) | yes | rejection letter, can reapply |
| Needs changes (note required) | no | "Needs changes", can resubmit |
| Reject — fraud (justification required) | no, and the applicant is banned | "Not accepted", can't apply again |

Financial aid applications never sync. Each application syncs once (`applications.airtable_record_id`).
"Automation - Submit to Unified YSWS" is never ticked: a human ticks it in Airtable.

## Settings
- `AIRTABLE_PAT`: personal access token with `data.records:write` on the base.
- `AIRTABLE_APP_NAME`: the base id (`app…`).
- `AIRTABLE_TABLE_NAME`: the table id (`tbl…`).
- `AIRTABLE_API_URL`: defaults to `https://api.airtable.com`; tests point it at fakes.

## Field mapping (by field name, as in the YSWS template)
| Airtable field | From |
|---|---|
| Code URL, Playable URL, Description, How did you hear about this? | the application form |
| First Name, Last Name | Hack Club Auth `given_name`/`family_name`, else the full name split on the first space |
| Email | Hack Club Auth |
| GitHub Username | owner of the GitHub code URL |
| Address fields, Birthday | Hack Club Auth `address`/`birthdate` claims, if the app is allowed those scopes (see hackclub-auth.md) |
| Optional - Override Hours Spent | logged Hackatime hours at submission, capped at 2 |
| Optional - Override Hours Spent Justification | Hackatime id, project, logged hours, the cap, and the reviewer's justification (the table's Unified Justification formula uses this field alone when it's set) |
| Justification - Hackatime Project Name(s) + Date Range(s) | project name, all time through the submission date |
| Justification - Submitter Hackatime ID | Hackatime id at submission (else from the latest connection) |
| Justification - Additional Justification | the reviewer's justification |

Not filled: Screenshot, the "What are we doing well? / How can we improve?" survey fields, and the
other justification and automation fields.
