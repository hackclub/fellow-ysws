# Hackatime integration

Source: github.com/hackclub/hackatime (Doorkeeper), checked 2026-11-11.

## OAuth 2 (not OIDC)
- Register: https://hackatime.hackclub.com/oauth/applications → New Application.
  Redirect URI `${APP_URL}/auth/hackatime/callback`, scopes `profile read`, Confidential ✓.
- Authorize: `GET https://hackatime.hackclub.com/oauth/authorize`
  (`client_id`, `redirect_uri`, `response_type=code`, `scope=profile read`, `state`, PKCE S256 supported)
- Token: `POST https://hackatime.hackclub.com/oauth/token`
- Revoke: `POST https://hackatime.hackclub.com/oauth/revoke` (standard Doorkeeper)
- Tokens are long-lived (16 years) and reused across grants. We keep ours only in a
  30-minute encrypted cookie and revoke nothing (revoking would also kill other apps' reuse).

## Endpoints (Bearer token)
| Endpoint | Scope | Shape |
|---|---|---|
| `GET /api/v1/authenticated/me` | `profile` | `{ id, emails[], slack_id, github_username, trust_factor }` |
| `GET /api/v1/authenticated/projects` | `read` | `{ projects: [{ name, total_seconds, most_recent_heartbeat, languages, archived }] }` |

- `/projects` defaults to all-time totals; `include_archived=true` adds archived projects.
- Restricted users get `401 {"error":"Unauthorized"}`.
- Fallback if OAuth is unavailable: `GET /api/v1/users/my/projects/details` with a personal API key.

## Status
- [ ] Verified end-to-end with a registered app (task 1.1) — needs a real client id/secret.
