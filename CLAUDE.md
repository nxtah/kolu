# KOLU — Claude Code Instructions v0.2

## Mission
Build KOLU according to `/docs`.

## Mandatory reading
Before architectural or feature changes, read the relevant files in `/docs`, especially PRD, ARCHITECTURE, DATABASE, API, PAYMENT, SECURITY, DESIGN_SYSTEM, and MEDIA_DONATION.

## Rules
1. Do not invent important business logic.
2. Ask before changing money, permissions, privacy, or data-integrity behavior when requirements are ambiguous.
3. Use strict TypeScript.
4. Avoid `any` unless justified.
5. Keep MVP as a modular monolith.
6. Do not introduce microservices without explicit approval.
7. Do not add dependencies without justification.
8. Never expose secrets to the client.
9. Never trust client-side authorization.
10. Validate all external input.
11. Never use floating point for money.
12. Payment webhooks must be signature-verified and idempotent.
13. Financial changes must be auditable.
14. XP awards must be idempotent.
15. Do not modify unrelated code.
16. Write tests for payment, authorization, XP, webhook, and media validation logic.
17. Prefer small, reversible changes.
18. Update docs when architecture materially changes.
19. Never allow arbitrary user-supplied HTML/JavaScript into OBS overlays.
20. Never fetch arbitrary URLs from the server when processing media submissions.
21. Use provider adapters for YouTube/TikTok and future media providers.
22. Do not download or re-host third-party videos merely to bypass provider playback restrictions.
23. Provider playback failure must not invalidate an otherwise successful donation.

## Workflow
1. Read relevant docs.
2. Inspect existing implementation.
3. State a short implementation plan.
4. Implement the smallest complete change.
5. Run tests/typecheck/lint.
6. Review security/authorization.
7. Review media/provider policy if media behavior changed.
8. Report changed files and verification.

## MVP boundary
Do not implement full social feed, complex recommendations, native apps, microservices, marketplace, public API, advanced AI recommendations, full streaming-platform integrations, complex battles, crypto/NFT functionality, or arbitrary video hosting unless explicitly requested.

Media Donation MVP+ is limited to the providers and capabilities explicitly documented in `/docs/MEDIA_DONATION.md`.

## Financial rule
The client is never authoritative for payment status, donation completion, balance, fees, payout eligibility, or payment-derived XP. Verified provider webhooks and server-side database state are authoritative.
