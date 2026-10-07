# KOLU

KOLU is a creator-support platform where donations are one part of a larger
relationship between streamers and supporters — combining financial support,
public supporter identity, progression (XP/levels), and realtime stream
interaction. A flagship feature is **Media Donation**: attaching content from
a supported platform (initially YouTube and TikTok) to a donation.

Full product and architecture documentation lives in [`docs/`](./docs), with
project-wide working rules in [`CLAUDE.md`](./CLAUDE.md). Read those before
making architectural or product changes.

## Status

This repository contains **Phase 0 (Foundation)** and **Phase 1 (Identity)**,
per [`docs/ROADMAP.md`](./docs/ROADMAP.md): project scaffold, database setup,
project structure, a media-provider abstraction skeleton, and real
registration/login/email-verification/password-reset flows. Real payments,
real media provider integration, OBS, and realtime are not implemented yet —
see [`docs/DECISIONS.md`](./docs/DECISIONS.md) for what was decided and
deferred so far.

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- **Database**: PostgreSQL 16, via Prisma 7 (driver adapter: `@prisma/adapter-pg`)
- **Validation**: Zod
- **Tests**: Vitest
- **Architecture**: modular monolith (no microservices) — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

Auth (Better Auth, see below) is implemented as of Phase 1. Payment provider
and realtime transport are intentionally **not yet chosen** — see the open
items in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and the deferral
decisions in [`docs/DECISIONS.md`](./docs/DECISIONS.md).

## Identity (Phase 1)

Registration, login, email verification, and password reset are implemented
via [Better Auth](https://better-auth.com) (email+password only) with
[Resend](https://resend.com) for email delivery. If `RESEND_API_KEY` is
unset, emails are logged to the server console instead of sent — see
`src/lib/email/resend.ts`.

## Setup

Requires Node.js 22 LTS, Docker, and Docker Compose.

```bash
npm install
cp .env.example .env   # then set BETTER_AUTH_SECRET (openssl rand -base64 32) and RESEND_API_KEY
docker compose up -d   # starts Postgres on localhost:5433
npx prisma migrate dev
npm run dev             # http://localhost:3000
```

## Scripts

| Command                  | Purpose                                      |
| ------------------------ | --------------------------------------------- |
| `npm run dev`             | Start the Next.js dev server                  |
| `npm run build`           | Production build                              |
| `npm run start`           | Start the production build                    |
| `npm run lint`            | ESLint                                        |
| `npm run typecheck`       | `tsc --noEmit`                                |
| `npm run test`            | Vitest (run once)                             |
| `npm run db:up`           | `docker compose up -d` (starts Postgres)      |
| `npm run db:down`         | `docker compose down`                         |
| `npm run prisma:generate` | Regenerate the Prisma client                  |
| `npm run prisma:migrate`  | `prisma migrate dev`                          |

## Project structure

```
src/
├── app/                 # Next.js App Router
├── components/          # Shared UI components
├── features/            # Feature modules (auth, donations, media-donations)
├── lib/
│   ├── auth/            # Better Auth server/client instances, session helpers
│   ├── db/              # Prisma client singleton
│   ├── payments/        # Provider-agnostic payment boundary (no SDK yet)
│   ├── media/
│   │   ├── providers/   # MediaProviderAdapter + YouTube/TikTok adapters
│   │   └── validation/  # Zod schemas for media URL input
│   ├── realtime/        # Provider-agnostic realtime boundary (no transport yet)
│   └── security/        # SSRF-safe URL validation
├── server/              # API route handler logic
└── types/                # Shared TypeScript types
```

Folders are only created when something justifies them — see
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and
[`docs/DECISIONS.md`](./docs/DECISIONS.md) for the reasoning behind what
exists (and what's deliberately missing) at this stage.
