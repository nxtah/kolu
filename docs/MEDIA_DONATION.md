# KOLU — Media Donation Specification

## Purpose

Media Donation lets a supporter attach media content to a donation. The goal is to turn a donation from a financial transaction into a stream interaction.

The product concept is **Media Donation**, not **YouTube Donation**. KOLU must use a provider-agnostic design so additional platforms can be added without changing the donation core.

## Initial providers

### YouTube
- Supported as an initial provider.
- Accept normal YouTube watch URLs and supported short/share URLs.
- Prefer official embed/player behavior.
- Do not download or re-host the video.

### TikTok
- Supported as an initial provider where the current platform/embed capabilities permit the required playback experience.
- Prefer official TikTok embed/player behavior.
- Do not download or re-host the video.

### Future providers
Possible future adapters:
- Twitch clips
- Instagram Reels
- X video posts
- Other providers only after technical, policy, and moderation review.

## Core flow

```text
Supporter
  ↓
Create Donation
  ↓
Paste Media URL
  ↓
Provider Detection
  ↓
URL / Content Validation
  ↓
Metadata Resolution
  ↓
Payment
  ↓
Verified Payment Webhook
  ↓
Donation Completed
  ↓
Media Donation enters moderation / queue
  ↓
Streamer policy check
  ↓
Approved
  ↓
Realtime OBS event
  ↓
Overlay Player
  ↓
Playing → Completed
```

## Important authority rule

A submitted media URL is **not** trusted merely because it was accepted by the browser.

The server must:
1. Parse and normalize the URL.
2. Detect the provider.
3. Validate the provider-specific content identifier.
4. Resolve metadata through an allowed provider mechanism where practical.
5. Apply streamer rules and moderation rules.
6. Only expose safe, structured media data to the overlay.

Never pass arbitrary user-supplied iframe HTML, JavaScript, or embed markup to OBS.

## MediaDonation data

Conceptual fields:

```text
id
 donationId
provider
contentType
sourceUrl
normalizedUrl
contentId
title?
thumbnailUrl?
durationMs?
status
moderationStatus
rejectionReason?
submittedAt
approvedAt?
startedAt?
completedAt?
```

Recommended enums:

```text
provider:
  YOUTUBE
  TIKTOK
  TWITCH
  INSTAGRAM
  X
  OTHER

contentType:
  VIDEO
  CLIP
  REEL

status:
  PENDING
  APPROVED
  PLAYING
  COMPLETED
  REJECTED
  FAILED
  EXPIRED

moderationStatus:
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
```

Only providers actually implemented by KOLU should be accepted. Do not allow arbitrary `OTHER` URLs to become playable media.

## Streamer controls

A streamer must be able to configure:
- Enable/disable Media Donation.
- Enable/disable individual providers.
- Minimum donation amount for media.
- Maximum media duration.
- Maximum number of queued media items.
- Auto-approve or manual approval.
- Cooldown between media items.
- Whether media can autoplay.
- Whether audio is enabled.
- Whether the donation message is shown with the media.
- Whether anonymous media donations are allowed.
- Queue behavior when the stream is busy.

Default behavior should be conservative: streamer control first, then automation.

## Moderation

Media is untrusted user-generated content.

MVP moderation should support:
- Manual approve/reject.
- Blocked provider/content state.
- URL/content validation.
- Queue controls.
- Report/reject reason.
- Per-streamer enable/disable.
- Rate limiting.

Future moderation can add automated content classification, but it must not be required for MVP.

## OBS behavior

The OBS browser source should receive a minimal structured event, for example:

```json
{
  "type": "MEDIA_DONATION",
  "donationId": "don_123",
  "provider": "YOUTUBE",
  "contentId": "abc123",
  "title": "Example video",
  "thumbnailUrl": "https://...",
  "durationMs": 30000,
  "message": "watch this",
  "displayName": "Natah"
}
```

The overlay is responsible for rendering the supported provider using a trusted KOLU implementation. It must not execute arbitrary HTML supplied by the supporter.

## Playback strategy

KOLU should prefer official provider playback/embedding mechanisms.

Do not:
- Download third-party videos without an explicit legal/product basis.
- Re-host third-party videos as if they were KOLU content.
- Circumvent provider playback restrictions.
- Scrape protected endpoints merely to force playback.
- Inject arbitrary external JavaScript into the overlay.

If a provider cannot safely support direct embedded playback, KOLU should degrade gracefully to a preview/link/QR experience rather than bypassing the provider.

## Queue

A media item should normally move through:

```text
PENDING
  ↓
APPROVED
  ↓
PLAYING
  ↓
COMPLETED
```

Alternative terminal states:

```text
PENDING → REJECTED
PENDING → FAILED
PENDING → EXPIRED
APPROVED → FAILED
```

Only one media item should normally occupy the active playback slot for a streamer at a time.

## Anti-spam

At minimum enforce:
- Donation/media creation rate limits.
- Per-supporter cooldown.
- Per-streamer queue limit.
- Maximum media duration.
- Maximum message length.
- Duplicate URL detection where useful.

## Product positioning

KOLU should describe this capability as:

> **Send more than money. Send something into the stream.**

The feature should reinforce KOLU's broader identity: supporter → interaction → recognition → community.
