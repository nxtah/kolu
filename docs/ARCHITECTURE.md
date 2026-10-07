# KOLU — Technical Architecture v0.2

## Goal

Use a modular monolith for MVP. Keep the donation core independent from provider-specific media integrations.

```text
Browser
  ↓
Next.js
  ├─ Auth
  ├─ Server/API
  ├─ Business logic
  ├─ PostgreSQL
  ├─ Payment provider
  ├─ Media provider adapters
  └─ Realtime → OBS Browser Source
```

## Initial stack
- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Authentication: select Better Auth or Auth.js before implementation
- Payment: evaluate Xendit or Midtrans
- Realtime: select WebSocket, SSE, or managed realtime based on simplicity
- Object storage for KOLU-owned assets such as avatars; do not use it to re-host third-party videos

## Domain modules

```text
lib/
  auth/
  db/
  payments/
  donations/
  media/
    providers/
      youtube/
      tiktok/
    validation/
    moderation/
    queue/
  realtime/
  xp/
  notifications/
  security/
```

## Media adapter architecture

The donation system must not contain provider-specific parsing logic.

Conceptual interface:

```ts
interface MediaProviderAdapter {
  provider: MediaProvider;
  canHandle(url: URL): boolean;
  parse(url: URL): ParsedMediaReference | null;
  resolveMetadata(reference: ParsedMediaReference): Promise<MediaMetadata | null>;
  getPlaybackDescriptor(reference: ParsedMediaReference): PlaybackDescriptor;
}
```

The exact interface can change during implementation, but the separation must remain.

## Provider flow

```text
Submitted URL
  ↓
Media Service
  ↓
Provider Detection
  ↓
Provider Adapter
  ↓
Parse / Normalize
  ↓
Metadata Resolution
  ↓
Policy + Streamer Settings
  ↓
MediaDonation
```

## OBS flow

```text
Verified Payment
  ↓
Donation Service
  ↓
Media Queue
  ↓
Moderation / Auto-approval
  ↓
Realtime Event
  ↓
OBS Browser Source
  ↓
KOLU Overlay
  ↓
Provider-specific player/preview
```

The OBS event contains structured data only. Never send arbitrary HTML or executable user content.

## Playback abstraction

A provider should return a safe playback descriptor rather than raw HTML.

Example concept:

```text
{
  provider: YOUTUBE,
  contentId: abc123,
  mode: EMBED
}
```

or, when direct playback is not safely available:

```text
{
  provider: TIKTOK,
  contentId: abc123,
  mode: PREVIEW
}
```

The overlay chooses a trusted renderer based on this descriptor.

## Rules
- No microservices for MVP.
- External providers are adapters.
- Provider failure must not break donation completion.
- Media processing must be asynchronous where appropriate.
- Server-side authorization is mandatory.
- Third-party media must not be downloaded/re-hosted merely to bypass playback limitations.
