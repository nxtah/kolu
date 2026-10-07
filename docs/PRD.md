# KOLU — PRD Reference v0.2

KOLU is a creator-support platform where donations are only one part of the relationship between streamers and supporters. KOLU combines financial support, supporter identity, recognition, progression, and realtime stream interaction.

## Product thesis

Traditional donation tools mostly answer:

> "How can a viewer send money to a streamer?"

KOLU should answer:

> "How can a supporter become part of the streamer's world?"

The product should move from **transaction → interaction → identity → community**.

## Core differentiator

Every supporter can build a public identity around how they support creators:
- Supporter profile
- Donation/support history, subject to privacy settings
- Streamers supported
- XP and levels
- Future badges/achievements
- Recognition and social status

A second major differentiator is **Media Donation**.

A supporter can attach supported media content to a donation, allowing the donation to become an interactive stream moment rather than only an alert containing text.

## MVP

### Identity
- Authentication
- User/profile system
- Streamer profile
- Supporter profile
- Public/private visibility controls
- Streamer/supporter roles

### Donation
- Public streamer donation page
- Amount and message
- Anonymous donation option
- Payment integration
- Verified payment webhooks
- Donation history
- Payment/donation state handling

### OBS
- Secure browser-source overlay
- Realtime donation alerts
- Test alert
- Basic alert customization

### Supporter progression
- XP ledger
- Level calculation
- Public supporter profile
- Support history visibility controls

### Media Donation — MVP+
Media Donation should be implemented as an extension of the donation system after the core payment and OBS path is stable.

Initial providers:
- YouTube
- TikTok

The implementation must be provider-agnostic so future providers can be added through adapters.

Core capabilities:
- Paste supported media URL during donation
- Detect provider
- Validate content
- Resolve safe metadata when available
- Store media attached to donation
- Streamer enable/disable controls
- Provider enable/disable controls
- Minimum donation amount
- Maximum duration
- Queue
- Manual moderation/approval
- OBS playback/preview event
- Playback status tracking
- Anti-spam/rate limits

Important: KOLU should use official/allowed embed or playback mechanisms. It must not download and re-host third-party videos merely to force playback.

### Moderation/admin
- Basic user moderation
- Report/review flow
- Donation/media rejection
- Admin action log

## MVP proof

Basic donation:

```text
Supporter
→ Payment
→ Verified Donation
→ Streamer
→ Realtime OBS Alert
→ Supporter XP/Profile
```

Media donation:

```text
Supporter
→ Donation + YouTube/TikTok URL
→ Provider Validation
→ Payment
→ Verified Webhook
→ Media Queue/Moderation
→ Streamer Approval
→ Realtime OBS Media Event
→ Stream Interaction
→ Supporter XP/Profile
```

## Product principles

1. Supporter identity matters.
2. Donations should create interaction, not only transactions.
3. Streamers control their stream experience.
4. Financial state is server-authoritative.
5. User-generated content is untrusted.
6. Provider integrations must be replaceable.
7. MVP stays simple enough for a solo developer.
8. Every feature should strengthen streamer ↔ supporter connection.

## Out of scope for MVP

- Full social feed
- Complex recommendations
- Native mobile apps
- Microservices
- Marketplace
- Public API/SDK
- Advanced AI moderation
- Complex battles
- Crypto/NFT
- Arbitrary video upload hosting
- Download/re-host pipeline for third-party videos
- Full streaming-platform integrations
