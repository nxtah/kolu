# KOLU — Development Roadmap v0.2

## Phase 0 — Foundation
- [x] Repository
- [x] Next.js/TypeScript/Tailwind
- [x] PostgreSQL/Prisma
- [x] Auth selection (Better Auth — decided and implemented in Phase 1)
- [ ] Payment provider selection (Xendit vs Midtrans — still open, see docs/PAYMENT.md)
- [ ] Realtime strategy (WebSocket vs SSE vs managed — still open, see docs/ARCHITECTURE.md)
- [x] CI/typecheck/lint (tsc/eslint/vitest scripts; no GitHub Actions workflow yet)
- [x] Environment setup
- [x] Provider adapter pattern

## Phase 1 — Identity
- [x] Auth (Better Auth, email+password, required verification, password reset)
- [x] Roles (SUPPORTER/STREAMER enforced at registration; ADMIN unreachable via public API)
- [x] Profile (displayName/bio/publicVisibility, editable via /me)
- [x] Streamer profile (StreamerProfile created at registration; bannerUrl/description/donationEnabled editable via /me)
- [x] Supporter profile (SupporterProfile created at registration; XP/level fields deferred to Phase 4)
- [x] Authorization (requireSession/requireRole/requireOwnership, verified server-side)

## Phase 2 — Donation
- [ ] Donation page
- [ ] Payment creation
- [ ] Webhook
- [ ] Idempotency
- [ ] Transaction states
- [ ] Donation history

## Phase 3 — OBS
- [ ] Overlay
- [ ] Secure token
- [ ] Realtime transport
- [ ] Donation event
- [ ] Alert rendering
- [ ] Test alert
- [ ] Basic settings

## Phase 4 — Supporter progression
- [ ] XP ledger
- [ ] Level calculation
- [ ] XP history
- [ ] Public supporter profile

## Phase 5 — Media Donation MVP+
- [ ] MediaDonation data model
- [ ] Provider adapter interface
- [ ] YouTube adapter
- [ ] TikTok adapter
- [ ] URL normalization/validation
- [ ] Metadata resolution
- [ ] Streamer media settings
- [ ] Minimum donation rule
- [ ] Maximum duration rule
- [ ] Queue limit
- [ ] Manual moderation
- [ ] Auto-approval option
- [ ] OBS media event
- [ ] Trusted provider playback/preview
- [ ] Playback state tracking
- [ ] Media rate limiting
- [ ] Media security review

## Phase 6 — Beta
- [ ] Admin tools
- [ ] Reports
- [ ] Security review
- [ ] Payment edge cases
- [ ] Monitoring
- [ ] Alpha/beta streamers
- [ ] Media provider reliability testing

## Phase 7+
- [ ] Badges
- [ ] Achievements
- [ ] Follow
- [ ] Community
- [ ] Goals
- [ ] Leaderboards
- [ ] Notifications
- [ ] Events
- [ ] Battles
- [ ] Discovery
- [ ] Twitch clips
- [ ] Instagram Reels
- [ ] X video posts
- [ ] Integrations
- [ ] API/SDK
- [ ] Marketplace
