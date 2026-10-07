# KOLU — API Contract v0.2

## Principles
- Validate input.
- Authenticate protected routes.
- Authorize every resource.
- Never expose secrets.
- Never trust client-side payment state.
- Return consistent JSON errors.
- Never return arbitrary user-supplied HTML to the overlay.

## Core routes
```text
GET  /api/streamers/:username
GET  /api/users/:username
PATCH /api/me/profile

POST /api/donations
GET  /api/me/donations
GET  /api/streamers/:username/donations
GET  /api/donations/:id

POST /api/payments/create
GET  /api/payments/:id
POST /api/webhooks/payment

POST /api/media/validate
GET  /api/media/:id
POST /api/media/:id/approve
POST /api/media/:id/reject
POST /api/media/:id/complete

GET  /api/streamers/:username/media-settings
PATCH /api/streamers/:username/media-settings
GET  /api/streamers/:username/media-queue

GET  /api/me/xp
GET  /api/me/xp/history

GET  /api/overlay/:token/events
POST /api/overlay/:id/test

GET  /api/admin/users
GET  /api/admin/transactions
GET  /api/admin/reports
PATCH /api/admin/reports/:id
```

## Donation creation

Request example:

```json
{
  "streamerUsername": "example",
  "amount": 100000,
  "currency": "IDR",
  "displayName": "Supporter",
  "message": "Semangat!",
  "anonymous": false,
  "media": {
    "url": "https://www.youtube.com/watch?v=abc123"
  }
}
```

A media URL is optional.

Creating a payment does not mean the donation is completed.

## Media validation

`POST /api/media/validate` should return structured information only.

Example:

```json
{
  "provider": "YOUTUBE",
  "contentType": "VIDEO",
  "contentId": "abc123",
  "title": "Example video",
  "thumbnailUrl": "https://...",
  "durationMs": 30000,
  "playbackMode": "EMBED"
}
```

For TikTok, `playbackMode` may be `EMBED` or `PREVIEW` depending on the supported implementation and provider constraints.

Never return arbitrary iframe markup generated from the submitted URL.

## Media moderation

Streamer approval/rejection must verify ownership of the streamer and media item.

```text
POST /api/media/:id/approve
POST /api/media/:id/reject
```

Approval should only succeed if:
- Donation is completed.
- Media is valid.
- Streamer allows the provider.
- Media passes current policy.
- Queue limits are respected.

## Webhook

1. Read raw payload as required.
2. Verify provider signature.
3. Identify event.
4. Check idempotency.
5. Update payment.
6. Update donation.
7. Award XP once.
8. Enqueue media if attached.
9. Trigger realtime donation/media event only when state is eligible.

## Error format
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Human-readable message"
  }
}
```
