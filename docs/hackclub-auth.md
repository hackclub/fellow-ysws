# Hack Club Auth integration

Source: github.com/hackclub/auth + live discovery doc, checked 2026-11-11.

## OIDC
- Discovery: https://auth.hackclub.com/.well-known/openid-configuration
- Authorize `https://auth.hackclub.com/oauth/authorize`, token `/oauth/token`,
  userinfo `/oauth/userinfo`, JWKS `/oauth/discovery/keys` (RS256).
- Register: https://auth.hackclub.com/developer/apps. Redirect URI
  `${APP_URL}/auth/hackclub/callback`.
- Community apps may request: `openid profile email name slack_id verification_status`.
  We request `openid profile email slack_id`, plus anything in `HACKCLUB_AUTH_EXTRA_SCOPES`.
- `birthdate` and `address` are HQ-official-only scopes (`OAuthScope::HQ_OFFICIAL_SCOPES` in
  hackclub/auth, checked 2026-11-21); community apps can't request them. The Airtable sync needs
  addresses, so production must run as an HQ-official app with
  `HACKCLUB_AUTH_EXTRA_SCOPES="birthdate address"`. An unapproved scope can make sign-in fail for
  everyone, so test a sign-in after changing it.
- The `address` claim is the user's primary address in standard OIDC shape
  (`street_address` with lines joined by `\n`, `locality`, `region`, `postal_code`, `country`),
  or absent if they have none.

## Claims we use
| Claim | Scope | Stored as |
|---|---|---|
| `sub` (e.g. `ident!abc123`) | `openid` | HMAC lookup hash + encrypted PII; admin allowlist matches this |
| `name` | `profile` | encrypted PII |
| `email` | `email` | encrypted PII |
| `slack_id` | `slack_id` | encrypted PII |
| `given_name`, `family_name` | `profile` (if sent) | encrypted PII |
| `birthdate`, `address` | extra scopes | encrypted PII; refreshed at each sign-in |

We read claims from the userinfo endpoint with the access token, then discard the token.

## Status
- [ ] Verified end-to-end with a registered app (task 1.2) — needs a real client id/secret.
