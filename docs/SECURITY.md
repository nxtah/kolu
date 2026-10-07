# KOLU — Security Requirements v0.2

## Authentication
- Secure password hashing via chosen auth system.
- Secure sessions/cookies.
- Expiring password-reset tokens.
- Rate limits on auth actions.

## Authorization
Every protected action verifies:
`Authentication + Role + Ownership + Permission`

Never trust client-provided role, user ID, streamer ID, or hidden UI controls.

## Input validation
Validate body, query, params, headers, webhook payloads, and media URLs.

## Media URL security
- Allowlist supported providers.
- Normalize URLs before provider detection.
- Reject unsupported schemes such as `javascript:` and unexpected protocols.
- Do not fetch arbitrary user-provided URLs from the server.
- Provider metadata requests must go through provider-specific adapters.
- Do not follow arbitrary redirects without controls.
- Do not pass raw URL-derived HTML into the browser source.

## Media content safety
Media is untrusted user-generated content.

- Apply streamer/provider policy before playback.
- Enforce maximum duration.
- Enforce queue and rate limits.
- Support manual rejection.
- Do not download/re-host third-party videos to bypass provider restrictions.
- Do not execute arbitrary scripts supplied by a provider URL.

## Payment
- Verify signatures.
- Idempotency.
- Server-side secrets.
- Audit state changes.

## Overlay
Use high-entropy tokens, token rotation/revocation, and minimal payloads. Never expose session/admin tokens.

The overlay must receive structured events, not arbitrary HTML.

## Rate limits
At minimum:
- login
- registration
- password reset
- donation creation
- message submission
- media validation
- media submission
- media approval/rejection
- webhooks
- admin endpoints

## XSS
Supporter messages, media metadata, titles, and thumbnails are untrusted. Escape/render safely and never inject raw user HTML.

## SSRF
Media URL submission can become an SSRF risk if the backend fetches arbitrary URLs. Provider adapters must reject unknown hosts and only request known provider endpoints.

## Secrets
Never commit database credentials, auth secrets, payment secrets, webhook secrets, or storage secrets.

## Privacy
Minimize personal data and provide controls for public supporter information.

## Logging
Do not log passwords, secrets, full sensitive tokens, or unnecessary personal data. Avoid logging full media URLs when they may contain unnecessary tracking parameters.
