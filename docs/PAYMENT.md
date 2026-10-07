# KOLU — Payment Specification

## Authority
The verified payment-provider webhook is authoritative, not the frontend redirect.

```text
Provider
 ↓
Verified Webhook
 ↓
Idempotency
 ↓
Payment State
 ↓
Donation State
 ↓
XP / Alert / Balance Effects
```

## Candidate providers
- Xendit
- Midtrans

Select after comparing fees, payment methods, webhook reliability, payout support, API quality, and Indonesian requirements.

## States
Payment: `PENDING, PAID, FAILED, EXPIRED, REFUNDED, DISPUTED`
Donation: `PENDING, COMPLETED, FAILED, EXPIRED, REFUNDED, DISPUTED`

## Money
Use integer amounts. Example: `100000` = Rp100.000. Never use floating point for financial calculations.

## Idempotency
Duplicate provider events must never duplicate:
- donations
- XP
- balance
- alerts

## Fees
Conceptually:
`gross donation - provider fee - KOLU fee = streamer net`
Exact fee is configurable and must be finalized later.

## Refund
Never delete completed donations. Use auditable refund/reversal records and define XP reversal policy before automation.

## Security
Verify webhook signature, validate payload, reject invalid signatures, store provider event identifiers, prevent replay/duplicate processing.
