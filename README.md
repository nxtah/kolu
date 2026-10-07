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

This repository currently contains the **Phase 0 (Foundation)** bootstrap
only, per [`docs/ROADMAP.md`](./docs/ROADMAP.md): project scaffold, database
setup, project structure, and a media-provider abstraction skeleton. No
product features (auth flows, real payments, real media provider
integration, OBS, etc.) are implemented yet — see
[`docs/DECISIONS.md`](./docs/DECISIONS.md) for what was decided and deferred
during bootstrap.

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- **Database**: PostgreSQL 16, via Prisma 7 (driver adapter: `@prisma/adapter-pg`)
- **Validation**: Zod
- **Tests**: Vitest
- **Architecture**: modular monolith (no microservices) — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

Auth, payment provider, and realtime transport are intentionally **not yet
chosen** — see the open items in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
and the deferral decisions in [`docs/DECISIONS.md`](./docs/DECISIONS.md).

## Setup

Requires Node.js 22 LTS, Docker, and Docker Compose.

```bash
npm install
cp .env.example .env   # adjust if needed; defaults work out of the box
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
│   ├── auth/            # Placeholder session contract (no library chosen yet)
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
