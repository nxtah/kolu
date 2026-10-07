# KOLU — Database Specification v0.2

PostgreSQL + Prisma.

## MVP entities

### User
`id, email, username, role, status, createdAt, updatedAt`

### Profile
`id, userId, displayName, avatarUrl, bio, publicVisibility, createdAt, updatedAt`

### StreamerProfile
`id, userId, bannerUrl, description, donationEnabled, verificationStatus, createdAt, updatedAt`

### SupporterProfile
`id, userId, xpTotal, level, createdAt, updatedAt`

### Donation
`id, streamerId, supporterId?, amount, currency, displayName, message, anonymous, status, paymentId, createdAt, completedAt?`

Rules:
- amount is integer minor currency unit
- no floating point
- payment/donation states are enums
- provider events must be idempotent

### Payment
`id, provider, providerReference, amount, currency, status, rawReferenceMetadata, createdAt, updatedAt`

### MediaDonation
`id, donationId, provider, contentType, sourceUrl, normalizedUrl, contentId, title?, thumbnailUrl?, durationMs?, status, moderationStatus, rejectionReason?, submittedAt, approvedAt?, startedAt?, completedAt?`

Rules:
- `donationId` is unique if MVP allows at most one media attachment per donation.
- If multiple media items per donation are required later, remove that constraint and add an explicit ordering field.
- Store the original URL only as necessary; normalize and validate before playback.
- Never store arbitrary iframe HTML or executable markup.
- Do not treat third-party video files as KOLU-owned assets.

Recommended enums:

```text
MediaProvider:
  YOUTUBE
  TIKTOK
  TWITCH
  INSTAGRAM
  X

MediaContentType:
  VIDEO
  CLIP
  REEL

MediaStatus:
  PENDING
  APPROVED
  PLAYING
  COMPLETED
  REJECTED
  FAILED
  EXPIRED

MediaModerationStatus:
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
```

### MediaPolicy / Streamer media settings

The exact table can be combined with `AlertSetting` or kept separate. It should support at minimum:

`streamerId, enabled, youtubeEnabled, tiktokEnabled, minAmount, maxDurationMs, maxQueueSize, autoApprove, cooldownMs, autoplay, audioEnabled, updatedAt`

### MediaQueueItem

Optional if queue state is stored directly on `MediaDonation`. If a separate queue is used, support:

`id, streamerId, mediaDonationId, position, status, createdAt, startedAt?, completedAt?`

Do not duplicate state unnecessarily.

### XPTransaction
`id, userId, amount, sourceType, sourceId, createdAt`

### Overlay
`id, streamerId, secureTokenHash, enabled, createdAt, updatedAt`

### AlertSetting
`id, streamerId, enabled, durationMs, minAmount, showAmount, showMessage, ttsEnabled, soundUrl, animationConfig, updatedAt`

### Follow
`id, followerId, streamerId, createdAt`

### Notification
`id, userId, type, title, body, readAt?, createdAt`

### Report
`id, reporterId, targetType, targetId, reason, status, reviewedBy?, reviewedAt?, createdAt`

### AdminAction
`id, adminId, action, targetType, targetId, metadata, createdAt`

## Future entities
Badge, UserBadge, Achievement, Community, CommunityMember, Goal, GoalContribution, Event, Battle, Payout, Refund, Fee, StreamerPlatform.

Do not create future tables unless needed.

## Financial integrity
Never delete or silently rewrite financial history. Use auditable corrective records.
