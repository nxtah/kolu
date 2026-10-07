# Phase 1 — Identity: Design Spec

Status: Approved (brainstorming) — ready for implementation planning.
Scope: `docs/ROADMAP.md` Phase 1 (Identity). Follows the Phase 0 bootstrap
committed in `2a2dc88`.

## Context

Phase 0 deliberately deferred the auth provider choice and left
`src/lib/auth/types.ts` as a throwing placeholder. This spec resolves that
decision and designs the first real feature phase: registration, login,
email verification, password reset, role-specific profile creation, and the
authorization boundary every later phase (donations, OBS, media donation)
will depend on.

## Decisions made during brainstorming (to be logged in docs/DECISIONS.md)

- **Auth provider: Better Auth.** TypeScript-first, lets us keep `User` as
  the source of truth for `role`/`username` instead of adopting Auth.js's
  own account-table shape.
- **Role model: unchanged.** `User.role` stays a single enum
  (`SUPPORTER | STREAMER | ADMIN`) — one role per account, matching
  `USER_FLOWS.md`'s distinct "Choose Streamer" onboarding branch. Dual-role
  (a streamer who also supports others) is explicitly out of scope; revisit
  later if needed.
- **Sign-in method: email + password only.** No OAuth in this phase.
- **Email verification: required** before role-gated actions (donating,
  publishing a streamer page). Enforced server-side.
- **Email delivery: Resend.** New dependency, new `RESEND_API_KEY` env var.
- **UI scope: minimal functional pages**, styled with the existing design
  tokens from Phase 0 (dark background, Geist, Electric Lime accents) — not
  a full polish/responsive pass.

## Architecture

Better Auth mounts at `/api/auth/*` via its Next.js route handler, backed by
its own Prisma adapter tables (`Session`, `Account`, `Verification`) added to
`prisma/schema.prisma` alongside the existing models. `User.id` is the shared
key between Better Auth's tables and our own `Profile`/`StreamerProfile`/
`SupporterProfile`. Resend sends verification and password-reset emails.
`src/lib/auth/` replaces its current placeholder with:

- `getCurrentSession()` — reads the real Better Auth session (server-side
  only).
- `requireSession()` — throws/redirects if there's no session.
- `requireRole(role)` — throws if the session's role doesn't match.
- Ownership-check helpers used by any route that mutates a specific user's
  data (e.g. `PATCH /api/me/profile` must not trust a client-supplied
  `userId`).

No client code is ever trusted for `userId`, `role`, or verification status
— every check happens server-side against the session and database, per
`docs/SECURITY.md` and `docs/CLAUDE.md` rule 9.

## Flows

**Registration** (`/register`)
Email, password, username, role choice (Supporter or Streamer) → Zod
validation (password strength, username format, valid email) → Better Auth
creates the account → a single DB transaction creates `Profile` plus either
`StreamerProfile` or `SupporterProfile` based on the chosen role → Resend
sends a verification email → user is shown a "check your email" screen.
Duplicate email/username returns `409 CONFLICT` with the standard
`{ error: { code, message } }` shape, not a raw constraint error.

**Email verification** (`/verify-email`)
Consumes Better Auth's verification token, marks the account verified.
Unverified accounts can still log in, but are blocked server-side from
role-gated actions. A "resend verification email" action exists for when
Resend delivery fails or the user lost the first email.

**Login** (`/login`)
Email + password → Better Auth session cookie.

**Password reset** (`/forgot-password` → `/reset-password`)
Better Auth's built-in reset-token flow, emailed via Resend.

**Profile**
- `PATCH /api/me/profile` — edit display name, avatar URL, bio, public
  visibility. Requires session; a user can only ever edit their own profile.
- `GET /api/users/:username` / `GET /api/streamers/:username` — public
  read, respecting `Profile.publicVisibility` (per `API.md`).
- `/[username]` — minimal public profile page (read-only).
- `/me` — minimal profile edit page (own profile only).

Streamer onboarding in this phase stops at profile creation — "Connect
Payment" and "Create Donation Page" from `USER_FLOWS.md` are Phase 2+ and
out of scope here.

## Data model changes

Add Better Auth's required tables to `prisma/schema.prisma` (exact shape
determined by Better Auth's Prisma adapter generator — not hand-written).
No changes to the existing `User`/`Profile`/`StreamerProfile`/
`SupporterProfile` models beyond what Phase 0 already created. A new Prisma
migration captures this addition.

## Error handling

- All API routes return `{ error: { code, message } }` (per `API.md`).
- Zod validates every input boundary before it reaches Better Auth or
  Prisma.
- Duplicate email/username → `409 CONFLICT`.
- No session / wrong role / not the resource owner → `401`/`403`
  consistently — never leak whether a resource exists to an unauthorized
  caller.
- Resend failure does not block account creation; the account exists but
  stays unverified, with a resend action available.

## Testing

Vitest unit tests for:
- Registration/profile Zod schemas (valid and invalid cases).
- Username normalization/uniqueness logic.
- `requireRole` / ownership-check helpers (mocked session).
- The role → profile-creation transaction logic (e.g. choosing STREAMER
  creates a `StreamerProfile`, not a `SupporterProfile`).

Not covered in this phase: Better Auth's internals, actual Resend delivery,
or end-to-end browser tests (consistent with the testing scope established
in Phase 0 bootstrap).

## Explicitly out of scope for this phase

OAuth/social login, dual-role accounts, payment connection, donation pages,
OBS overlay, admin moderation tools, full responsive/polished UI.
