# KOLU — User Flows v0.2

## Streamer onboarding
```mermaid
flowchart TD
A[Register] --> B[Choose Streamer]
B --> C[Create Profile]
C --> D[Connect Payment]
D --> E[Create Donation Page]
E --> F[Configure Alert]
F --> G[Configure Media Donation]
G --> H[Get OBS URL]
H --> I[Test Alert]
I --> J[Ready]
```

## Basic donation
```mermaid
flowchart TD
A[Streamer Profile] --> B[Donation Page]
B --> C[Enter Amount/Message]
C --> D[Create Payment]
D --> E[Payment Provider]
E --> F[Verified Webhook]
F --> G[Complete Donation]
G --> H[XP]
G --> I[Realtime Alert]
I --> J[OBS]
H --> K[Profile Update]
```

## Media donation
```mermaid
flowchart TD
A[Donation Page] --> B[Enter Amount/Message]
B --> C[Paste YouTube/TikTok URL]
C --> D[Detect Provider]
D --> E[Validate + Resolve Metadata]
E --> F[Create Payment]
F --> G[Verified Webhook]
G --> H[Complete Donation]
H --> I[Media Queue]
I --> J{Auto Approve?}
J -->|Yes| K[Approved]
J -->|No| L[Streamer Reviews]
L -->|Reject| M[Rejected]
L -->|Approve| K
K --> N[Realtime OBS Media Event]
N --> O[Play/Preview]
O --> P[Completed]
H --> Q[Supporter XP/Profile]
```

## Media rejection

A media item can be rejected without deleting the financial donation record.

```text
Donation = COMPLETED
Media = REJECTED
XP = still valid for completed donation unless product policy explicitly says otherwise
```

The product must define any refund policy separately. Rejected media does not automatically imply a payment refund.

## Failed payment

Payment failure/expiration → donation remains non-completed → no payment-derived XP → no completed-donation alert → no media queue item becomes playable.

## Duplicate webhook

Verify signature → check event/reference → if already processed, return success with no side effects; otherwise process once.

## Privacy

Supporters can control public profile, donation history, supported-streamer list, total support, and anonymous donation behavior.

Media source URLs should not be exposed publicly beyond what is required for the donation/stream interaction.
