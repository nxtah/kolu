# KOLU — Design System v0.2

## Brand
KOLU

## Colors
- Electric Lime: `#C8FF00`
- Dark: `#0B0B0B`
- Light: `#F5F5F0`

## Personality
Modern, energetic, social, premium, creator-focused, slightly futuristic.

Avoid generic fintech styling, excessive neon, childish gamer styling, clutter, and decorative gradients without purpose.

## Usage
Electric Lime is an accent for:
- primary CTA
- active states
- XP
- levels
- key metrics
- success states
- donation energy
- media queue activity
- brand accents

Do not make every component lime.

## Typography
Candidate: Inter, Geist, or Plus Jakarta Sans. Choose one and standardize.

## Core components
Button, Input, Select, Modal, Card, Badge, Avatar, Progress, XP indicator, Level indicator, Donation card, Streamer card, Supporter card, Notification, Alert preview, Media preview, Media queue item, Provider badge, Dashboard metric.

## Donation page
The donation composer should make the media feature discoverable without making it mandatory.

Suggested hierarchy:
1. Amount
2. Display name / anonymous
3. Message
4. Optional “Send media” attachment
5. Media preview + validation state
6. Payment CTA

## Media UI states

### Valid media
Show:
- provider
- thumbnail/preview when available
- title when available
- duration when available
- remove/change action

### Invalid media
Show a clear reason and allow the supporter to replace the URL.

### Pending moderation
Explain that the streamer may need to approve the media before it appears.

### Playing
Streamer dashboard should show the active media item and queue position.

## OBS alert priority
For a basic donation:
1. Supporter identity
2. Amount
3. Message
4. KOLU branding

For a media donation:
1. Media/content moment
2. Supporter identity
3. Amount
4. Message
5. KOLU branding

Media should feel like a stream interaction, not an advertisement for KOLU.

## Responsive
Public pages: mobile-first.
Dashboard: desktop-priority but usable on smaller screens.
