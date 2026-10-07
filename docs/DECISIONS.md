# KOLU — Decisions

## 2026-10-04 — MVP architecture
Decision: modular monolith.
Reason: solo development, fast iteration, low operational complexity.

## 2026-10-04 — Brand
Decision: KOLU with Electric Lime `#C8FF00`.
Reason: distinctive creator/community energy without copying common blue/purple SaaS aesthetics.

## 2026-10-07 — Media Donation is provider-agnostic
### Context
The initial idea was to let supporters attach a YouTube video to a donation. The product can become more differentiated if supporters can send content from multiple platforms.

### Decision
Define the feature as **Media Donation**. Start with YouTube and TikTok, using provider adapters so future providers can be added independently.

### Alternatives
- YouTube-only media donation
- Arbitrary URL/video support
- KOLU-hosted video uploads

### Reason
A provider-agnostic model strengthens KOLU's product concept while keeping the implementation controlled. Arbitrary URLs and third-party video re-hosting create unnecessary security, moderation, policy, copyright, storage, and bandwidth problems.

### Consequences
- Add MediaDonation and provider abstractions.
- Add streamer media controls and moderation.
- Treat official/allowed provider playback as the preferred strategy.
- If a provider cannot safely support direct playback, use preview/link/QR fallback rather than bypassing restrictions.

## 2026-10-07 — Bootstrap: auth deferred to Phase 1
### Context
docs/ARCHITECTURE.md left the choice between Better Auth and Auth.js open ("select before implementation"). Phase 0 (Foundation) needs to scaffold the project without locking in a library the team hasn't evaluated.

### Decision
Defer the auth library choice entirely. Bootstrap only creates a typed placeholder session contract (`src/lib/auth/types.ts`) — no library installed, no real session/auth flow implemented. The actual choice happens in Phase 1 (Identity, see docs/ROADMAP.md).

### Alternatives
- Pick Better Auth now
- Pick Auth.js (NextAuth v5) now

### Reason
Locking in an auth library during foundation work risks committing to the wrong choice before Phase 1's actual requirements (session needs, provider list, role/ownership checks) are worked out. A placeholder contract lets other modules (donations, media) be written against a stable shape without blocking on this decision.

### Consequences
- `src/lib/auth/` contains only `Session` and a `getCurrentSession()` stub that throws until implemented.
- No `AUTH_SECRET` or session cookie handling exists yet.
- Phase 1 must revisit this decision before any protected route is built.

## 2026-10-07 — Bootstrap: Geist typography
### Context
docs/DESIGN_SYSTEM.md left typography as an open candidate list (Inter, Geist, or Plus Jakarta Sans).

### Decision
Use Geist (via `next/font/google`, already bundled by `create-next-app` for Next.js 16).

### Alternatives
- Inter
- Plus Jakarta Sans

### Reason
Geist pairs naturally with Next.js (same origin, zero extra setup), and its geometric character fits the "premium, slightly futuristic" brand direction better than Inter, which reads as a generic SaaS default — one of the explicit anti-patterns in docs/DESIGN_SYSTEM.md.

### Consequences
- `--font-sans` / `--font-geist-sans` CSS variables are wired in `src/app/globals.css` and `src/app/layout.tsx`.

## 2026-10-07 — Bootstrap: dark-first, dual-theme-ready
### Context
docs/DESIGN_SYSTEM.md defines both a dark token (`#0B0B0B`) and a light token (`#F5F5F0`) but specifies no switching mechanism.

### Decision
Default to dark mode. Both tokens are wired as CSS variables (`:root` for dark, `:root[data-theme="light"]` override for light) so a theme toggle can be added later without touching component code. No toggle UI is built in this phase.

### Alternatives
- Dark-only (skip light tokens entirely)
- Build a full theme-toggle mechanism now (e.g. next-themes)

### Reason
Dark-first matches the "energetic/premium/stream-culture" brand feel described in docs/DESIGN_SYSTEM.md. Wiring both tokens now avoids a rework later, without the extra toggle-UI work a foundation phase doesn't need.

### Consequences
- `src/app/layout.tsx` sets `data-theme="dark"` explicitly on `<html>`.
- Switching to light mode today only requires changing that attribute — no CSS changes needed.

## 2026-10-07 — Bootstrap: schema gap-fills
### Context
docs/DATABASE.md specifies most entities and enums verbatim, but leaves a few concrete values unstated: `User.role`'s possible values, and the exact `Donation`/`Payment` status enums (it says "payment/donation states are enums" without listing them in that file). The streamer media-settings table ("MediaPolicy") is explicitly left open as either its own model or merged into `AlertSetting`.

### Decision
- `UserRole`: `SUPPORTER | STREAMER | ADMIN` — the three roles implied throughout PRD.md and USER_FLOWS.md.
- `DonationStatus` / `PaymentStatus`: taken verbatim from docs/PAYMENT.md's state machines (`PENDING, PAID/COMPLETED, FAILED, EXPIRED, REFUNDED, DISPUTED`).
- `MediaPolicy` kept as its own Prisma model, separate from `AlertSetting`.

### Reason
These are minimal, low-risk inferences needed to make the schema concrete — none of them affect money, permissions, or donation-state semantics beyond what docs/PAYMENT.md already specifies. Keeping `MediaPolicy` separate avoids overloading `AlertSetting` (donation-alert config) with unrelated media-queue/provider config, and keeps each independently extensible.

### Consequences
- If this is wrong, `prisma/schema.prisma` is a single migration deep (`20261007081423_init`) and easy to adjust before any real data exists.

## 2026-10-07 — Phase 1: Better Auth adopted
### Context
Bootstrap (Phase 0) deferred the auth provider choice. Phase 1 (Identity) needed a real implementation.

### Decision
Adopt Better Auth, email+password only, with required email verification (Resend for delivery) and password reset. `User.role` stays a single enum; registration lets the user choose SUPPORTER or STREAMER (never ADMIN) — enforced by disabling client input on the `role` field entirely and elevating it server-side inside the same transaction that creates the role-specific profile.

### Alternatives
- Auth.js (NextAuth v5) — would have required adopting its own account-table shape instead of extending our existing User model.

### Reason
Better Auth's additionalFields let `User.role`/`username` stay the source of truth on our own table, and its `input: false` option gives a clean, library-level way to prevent role escalation through the public signup API — rather than relying only on application-layer validation.

### Consequences
- `prisma/schema.prisma` gained `Session`/`Account`/`Verification` models and `User.name`/`emailVerified`/`image` fields.
- New env vars: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.
- OAuth/social login remains unimplemented — email+password only for now.

## 2026-10-07 — Phase 1: unverified accounts cannot log in at all
### Context
docs/superpowers/specs/2026-10-07-phase1-identity-design.md (around line 67-70) said unverified accounts "can still log in, but are blocked server-side from role-gated actions." The actual implementation in `src/lib/auth/server.ts` sets `emailAndPassword.requireEmailVerification: true`, which makes Better Auth reject sign-in entirely for unverified accounts — the opposite of what the spec described.

### Decision
Keep the stricter Better Auth behavior (`requireEmailVerification: true`) and correct the spec record instead of changing the implementation. Unverified accounts cannot log in at all; they must verify their email first. `src/app/login/page.tsx` now shows a link to `/resend-verification` alongside any sign-in error so a blocked user has a path forward.

### Alternatives
- Set `requireEmailVerification: false` and add role-gated-action checks to match the original spec text.

### Reason
This phase has no role-gated actions to gate, so building that enforcement path only to match stale spec wording isn't worth the complexity. The simpler, stricter behavior is intentional, not a bug.

### Consequences
- The login page must always offer a way to request a new verification link, since a generic auth error could mean either a wrong password or an unverified email.
- docs/superpowers/specs/2026-10-07-phase1-identity-design.md's wording around login/verification is superseded by this entry.

## Template

```md
## YYYY-MM-DD — Decision title
### Context
### Decision
### Alternatives
### Reason
### Consequences
```
