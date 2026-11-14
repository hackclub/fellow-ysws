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
- The discovery doc also lists a `birthdate` scope and an `address` claim. Set
  `HACKCLUB_AUTH_EXTRA_SCOPES="birthdate address"` only if the app is approved for them:
  an unapproved scope can make sign-in fail for everyone. Test a sign-in after changing it.

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
