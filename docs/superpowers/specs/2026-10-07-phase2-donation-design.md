# Phase 2 — Donation: Design Spec

Status: Approved (brainstorming) — ready for implementation planning.
Scope: `docs/ROADMAP.md` Phase 2 (Donation). Follows Phase 1 (Identity, merged
to `master`).

## Context

KOLU needed its payment provider decision resolved before Phase 2 could
start. The user compared Xendit, Midtrans, and a friend's gateway ("Kipay")
and chose **Xendit** — Kipay was ruled out because its webhook signature
verification isn't publicly documented yet, a hard requirement per
`docs/SECURITY.md`. This spec covers the first real money-moving feature:
a public donation page, payment creation via Xendit, webhook-driven
donation completion, idempotency, and donation history.

## Decisions made during brainstorming (to be logged in docs/DECISIONS.md)

- **Payment provider: Xendit**, using the current-generation **Payment
  Session API** (`mode: PAYMENT_LINK`, `session_type: PAY`) rather than the
  legacy Invoice API, which Xendit's own docs signal is being superseded.
- **Guest donations allowed.** No KOLU account required to donate — matches
  `Donation.supporterId`'s existing nullable design and `docs/API.md`'s
  donation request shape. Logged-in supporters who donate while signed in
  still get `supporterId` populated.
- **Currency: IDR only**, hardcoded. No currency picker in the UI.
- **No minimum donation amount** beyond "a positive integer."
- **Donation page is its own route**: `/[username]/donate`, separate from
  the read-only public profile page (`/[username]`) from Phase 1.
- **Donation history is private.** `GET /api/streamers/:username/donations`
  requires the streamer's own session — no public donation feed in this
  phase.
- **Disabled donations show a message, not a 404.** If
  `StreamerProfile.donationEnabled` is `false`, `/[username]/donate` renders
  "Donations not available" rather than treating the page as nonexistent.
- **One combined endpoint for the form.** `POST /api/donations` does
  everything — validates, creates `Donation`+`Payment`, creates the Xendit
  Payment Session, returns the checkout URL. `POST /api/payments/create`
  from `docs/API.md` is deferred until a "retry an expired payment" flow
  exists, which is out of scope now.
- **Post-payment page is generic, no polling.** `/donations/[id]/thanks`
  shows a static "thanks, confirming your payment" message. No client-side
  polling loop against donation status in this phase.

## Architecture

A `XenditAdapter` (in `src/lib/payments/xendit/`) implements the existing
`PaymentProviderAdapter` interface from Phase 0
(`src/lib/payments/types.ts`), wrapping the official `xendit-node` SDK.
`createPayment()` creates a Xendit Payment Session and returns its hosted
`payment_link_url` as `redirectUrl`. `verifyWebhookSignature()` compares the
`x-callback-token` request header against `XENDIT_WEBHOOK_TOKEN` (env secret)
using a constant-time comparison — this is Xendit's documented verification
mechanism for Payment Session webhooks (a static shared secret, not an HMAC
signature, despite HMAC being used by a different/older Xendit product).

`src/features/donations/` holds the domain logic: a Zod schema for donation
input, and a `createDonation()` orchestration function mirroring
`src/features/auth/register.ts`'s pattern from Phase 1 — validate, then one
Prisma transaction creates `Donation` + `Payment` (both `PENDING`), then the
adapter call happens, then the transaction's results are updated with the
provider reference. If the adapter call fails, the whole operation is rolled
back — no orphaned `PENDING` rows from a failed Xendit call.

The webhook handler (`src/app/api/webhooks/payment/route.ts`) follows
`docs/API.md`'s documented procedure exactly: verify signature → identify
event → check idempotency (via `Payment.status`, not a separate event-log
table — mirrors the existing unique-constraint idempotency pattern used by
`XPTransaction` in Phase 0's schema) → update `Payment` → update `Donation`
→ **explicit no-op hook points**, clearly commented, for XP award (Phase 4),
media queue (Phase 5), and realtime event dispatch (Phase 3) — none of
those phases are built yet, so these steps do nothing except mark where
future phases plug in.

## Flows

**Donation creation** (`POST /api/donations`)
Body: `{ streamerUsername, amount, displayName, message?, anonymous? }`.
Look up the streamer by username (404 if missing). If
`StreamerProfile.donationEnabled` is `false`, return a `409`-style
"donations not available" error (not 404 — the streamer's existence is
already public via their profile page, so this isn't a privacy-enumeration
case). Zod validates: `amount` positive integer, `displayName` 1-60 chars,
`message` optional max 500 chars, `anonymous` optional boolean. One
transaction creates `Donation` (`PENDING`) and `Payment` (`PENDING`,
`provider: "XENDIT"`). If the caller has a session, `Donation.supporterId`
is set to `session.user.id`; otherwise it stays `null` (guest). The adapter
then creates the Xendit Payment Session with `reference_id: payment.id`,
`success_return_url: {NEXT_PUBLIC_APP_URL}/donations/{donationId}/thanks`.
`Payment.providerReference` and `rawReferenceMetadata` are updated with the
session response. Returns `{ redirectUrl }`.

**Donate page** (`/[username]/donate`)
Public, no login required. Shows "Donations not available" if
`donationEnabled` is `false`. Otherwise a form (amount, display name,
message, anonymous checkbox) that POSTs to `/api/donations` and navigates
the browser to the returned `redirectUrl`.

**Return page** (`/donations/[id]/thanks`)
Generic confirmation message, no polling. The donation ID (an unguessable
`cuid`) is the page's only access control — reasonable for a guest-checkout
receipt, since it reveals nothing beyond what the supporter themselves just
submitted.

**Webhook** (`POST /api/webhooks/payment`)
Per `docs/API.md`'s procedure: read raw body → verify `x-callback-token` →
identify event → look up `Payment` by `providerReference` → if
`Payment.status` is already `PAID`/`FAILED`/terminal, return `200` with no
further action (idempotent replay) → otherwise update `Payment.status` and
the linked `Donation.status`/`completedAt` → no-op hook points for XP
(Phase 4), media queue (Phase 5), realtime dispatch (Phase 3).

**Donation history**
`GET /api/me/donations` — `requireSession`, returns donations where
`supporterId == session.user.id`.
`GET /api/streamers/:username/donations` — `requireSession` +
`requireRole("STREAMER")` + `requireOwnership`, private to that streamer.

## Data model changes

None required — `Donation`, `Payment`, `DonationStatus`, `PaymentStatus`
already exist from Phase 0's schema and match this flow exactly. No new
Prisma migration needed for this phase.

## Error handling

- All routes return `{ error: { code, message } }`.
- Invalid input → `400`.
- Unknown streamer username → `404`.
- `donationEnabled: false` → `409`-style `DONATIONS_DISABLED` (not 404).
- Xendit API failure during payment creation → the whole transaction rolls
  back (no orphaned `PENDING` Donation/Payment rows) → `502`-style error
  returned to the supporter so they can retry.
- Webhook signature failure → `401`, logged server-side, never silently
  accepted.
- Webhook idempotency: a replayed webhook for an already-terminal `Payment`
  is a safe no-op `200` — never double-updates `Donation` state or
  (once it exists) double-awards XP.

## Testing

Vitest unit tests for:
- Donation input Zod schema (valid/invalid cases).
- `XenditAdapter`'s request-shape construction (mocked `xendit-node`
  client) — not live sandbox calls.
- Webhook token verification (valid/invalid/missing `x-callback-token`).
- Webhook idempotency (processing the same event twice has no additional
  effect on `Payment`/`Donation`).
- `createDonation()`'s transaction logic: `donationEnabled` gate, guest vs
  logged-in `supporterId` handling, rollback on adapter failure.

No automated test exercises Xendit's real sandbox API — that happens via
manual verification once sandbox keys are available, the same pattern used
for Phase 1's curl-based end-to-end checks.

## Explicitly out of scope for this phase

XP awarding (Phase 4), media attachment to donations (Phase 5), OBS/realtime
alerts (Phase 3), public donation feeds, per-streamer minimum donation
amounts, a "retry payment" flow / `POST /api/payments/create`, refunds,
payouts, any payment provider other than Xendit, any currency other than
IDR.
