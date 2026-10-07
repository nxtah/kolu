# Phase 1 (Identity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement KOLU Phase 1 (Identity) — registration, login, required email verification, password reset, role-specific profile creation, and a server-side authorization boundary — per the approved spec at `docs/superpowers/specs/2026-10-07-phase1-identity-design.md`.

**Architecture:** Better Auth (email+password only) mounted at `/api/auth/[...all]`, backed by a Prisma adapter sharing our existing Postgres database. Better Auth's `Session`/`Account`/`Verification` tables are added to `prisma/schema.prisma`; our existing `User` model is extended with the core fields Better Auth requires (`name`, `emailVerified`, `image`) plus `username`/`role` registered as additional fields (`role` is server-owned — never settable via the public auth API). Resend sends verification/reset emails. Our own `/api/register` route orchestrates: call Better Auth's signup, then in one Prisma transaction elevate the role (if STREAMER) and create the matching `Profile` + `StreamerProfile`/`SupporterProfile`. `src/lib/auth/session.ts` provides `requireSession`/`requireRole`/`requireOwnership`, used by every protected route — never trusting a client-supplied `userId`/`role`.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), Prisma 7 + `@prisma/adapter-pg`, Better Auth, Resend, Zod, Vitest. Builds on the Phase 0 bootstrap (commit `2a2dc88`).

## Global Constraints

- Never trust a client-supplied `userId`, `role`, or verification status — every authorization check happens server-side (`docs/SECURITY.md`, `docs/CLAUDE.md` rule 9).
- All API routes return errors as `{ error: { code, message } }` (`docs/API.md`).
- Money/role/permission ambiguity requires asking before implementing — already resolved for this phase in the spec; do not introduce new ambiguous behavior without flagging it.
- No floating point for money — not touched in this phase, but keep in mind for any future amount field.
- `User.role` stays a single enum (`SUPPORTER | STREAMER | ADMIN`) — no dual-role support in this phase.
- Email+password only — no OAuth/social login in this phase.
- Secrets never committed — new env vars (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`) go in `.env.example` as empty/placeholder values only.
- When installing `better-auth` and `resend`, check `npm view <pkg> dist-tags` before trusting npm's `latest` tag — Phase 0 found Prisma's `latest` tag pointing at a release candidate. Pin to the newest non-prerelease version if `latest` is a prerelease.

---

### Task 1: Dependencies and environment variables

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`

**Interfaces:**
- Produces: `env.BETTER_AUTH_SECRET: string`, `env.RESEND_API_KEY: string | undefined`, `env.EMAIL_FROM: string` — consumed by Task 3 and Task 4.

- [ ] **Step 1: Check npm dist-tags before installing**

Run: `npm view better-auth dist-tags && npm view resend dist-tags`
Expected: Note the `latest` version for each. If `latest` looks like a prerelease (contains `-rc`, `-beta`, `-alpha`), identify the newest stable version instead (same approach as Phase 0's Prisma pin) and install that exact version in Step 2.

- [ ] **Step 2: Install dependencies**

Run: `npm install better-auth resend`

(If Step 1 found a prerelease `latest`, instead run `npm install better-auth@<stable-version> resend@<stable-version>`.)

- [ ] **Step 3: Add new env vars to `.env.example`**

Add to the `LOCAL DEVELOPMENT VARIABLES` section (after `NEXT_PUBLIC_APP_URL`):

```bash
# Better Auth session/token signing secret. Generate your own with:
#   openssl rand -base64 32
BETTER_AUTH_SECRET=

# Resend API key for sending verification/password-reset emails. Get one at
# https://resend.com — the free tier's onboarding@resend.dev sender works
# for local dev without verifying a domain. If left empty, emails are only
# logged to the server console (see src/lib/email/resend.ts).
RESEND_API_KEY=

# "From" address used for all outgoing emails. onboarding@resend.dev works
# without domain verification for local dev.
EMAIL_FROM="KOLU <onboarding@resend.dev>"
```

- [ ] **Step 4: Regenerate local `.env` from the example**

Run: `cp .env.example .env` then edit `.env` to set a real `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and your own Resend test API key (or leave `RESEND_API_KEY` empty to use console-logging fallback).

- [ ] **Step 5: Extend the env schema**

Edit `src/lib/env.ts` — add to `envSchema`:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1),
});
```

- [ ] **Step 6: Add test cases for the new required/optional vars**

Replace the full contents of `src/lib/env.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

const BASE_VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(32),
  EMAIL_FROM: "KOLU <test@example.com>",
};

describe("loadEnv", () => {
  it("accepts a valid environment", () => {
    const env = loadEnv({ ...BASE_VALID_ENV, NODE_ENV: "test" });
    expect(env.DATABASE_URL).toBe(BASE_VALID_ENV.DATABASE_URL);
  });

  it("defaults NODE_ENV to development when unset", () => {
    const env = loadEnv(BASE_VALID_ENV);
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = BASE_VALID_ENV;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when NEXT_PUBLIC_APP_URL is not a valid URL", () => {
    expect(() => loadEnv({ ...BASE_VALID_ENV, NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
  });

  it("throws when BETTER_AUTH_SECRET is too short", () => {
    expect(() => loadEnv({ ...BASE_VALID_ENV, BETTER_AUTH_SECRET: "too-short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("accepts a valid environment without RESEND_API_KEY", () => {
    const env = loadEnv(BASE_VALID_ENV);
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("throws when EMAIL_FROM is missing", () => {
    const { EMAIL_FROM, ...rest } = BASE_VALID_ENV;
    expect(() => loadEnv(rest)).toThrow(/EMAIL_FROM/);
  });
});
```

(This replaces Phase 0's four original test cases — same assertions, rewritten against a shared `BASE_VALID_ENV` fixture so adding future required vars doesn't require touching every test — plus three new cases for `BETTER_AUTH_SECRET`/`RESEND_API_KEY`/`EMAIL_FROM`.)

- [ ] **Step 7: Update the Vitest env fixture**

Edit `vitest.config.mts` — add to `test.env`:

```ts
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5433/test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      EMAIL_FROM: "KOLU <test@example.com>",
    },
```

- [ ] **Step 8: Run the env tests**

Run: `npm run test -- src/lib/env.test.ts`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/env.ts src/lib/env.test.ts vitest.config.mts
git commit -m "Add better-auth and resend dependencies, extend env schema"
```

---

### Task 2: Prisma schema — Better Auth tables + User fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_better_auth_tables/migration.sql` (generated, not hand-written)

**Interfaces:**
- Produces: `User.name: string`, `User.emailVerified: boolean`, `User.image: string | null`, `User.role` now has `@default(SUPPORTER)`, plus `Session`/`Account`/`Verification` Prisma models — consumed by Task 4 (Better Auth config) and Task 6 (registration transaction).

- [ ] **Step 1: Extend the `User` model**

In `prisma/schema.prisma`, replace the `User` model with:

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  username  String     @unique
  // Core fields required by Better Auth's user schema.
  name      String
  emailVerified Boolean @default(false)
  image     String?
  role      UserRole   @default(SUPPORTER)
  status    UserStatus @default(ACTIVE)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  profile          Profile?
  streamerProfile  StreamerProfile?
  supporterProfile SupporterProfile?
  donationsMade    Donation[]         @relation("SupporterDonations")
  xpTransactions   XPTransaction[]
  follows          Follow[]           @relation("FollowerFollows")
  notifications    Notification[]
  reportsFiled     Report[]           @relation("ReporterReports")
  reportsReviewed  Report[]           @relation("ReviewerReports")
  adminActions     AdminAction[]
  sessions         Session[]
  accounts         Account[]

  @@map("users")
}
```

(Only change from Phase 0: added `name`, `emailVerified`, `image`, `role` now has `@default(SUPPORTER)` instead of being required with no default, and two new relations `sessions`/`accounts`.)

- [ ] **Step 2: Add Better Auth's `Session`, `Account`, `Verification` models**

Add these new models anywhere after the `User` model (e.g. right after `SupporterProfile`), keeping this repo's plural `@@map` convention:

```prisma
// ---------------------------------------------------------------------------
// Better Auth (session/account/verification tables)
// ---------------------------------------------------------------------------

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("accounts")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verifications")
}
```

- [ ] **Step 3: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_better_auth_tables`
Expected: a new folder under `prisma/migrations/` is created and applied without errors; output ends with "Your database is now in sync with your schema."

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (existing code referencing `User` still compiles since only new optional/defaulted fields were added).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add Better Auth session/account/verification tables to schema"
```

---

### Task 3: Email sending module (Resend)

**Files:**
- Create: `src/lib/email/resend.ts`
- Create: `src/lib/email/templates.ts`
- Create: `src/lib/email/templates.test.ts`

**Interfaces:**
- Consumes: `env.RESEND_API_KEY`, `env.EMAIL_FROM` from `@/lib/env` (Task 1).
- Produces: `sendVerificationEmail(to: string, url: string): Promise<void>`, `sendPasswordResetEmail(to: string, url: string): Promise<void>` — consumed by Task 4 (Better Auth config).

- [ ] **Step 1: Write the Resend client wrapper**

Create `src/lib/email/resend.ts`:

```ts
import { Resend } from "resend";

import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Sends an email via Resend if RESEND_API_KEY is configured; otherwise logs
 * it to the console. Never throws — email delivery failures must not block
 * the auth flow that triggered them (docs/superpowers/specs/2026-10-07-phase1-identity-design.md).
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`[email:dev-fallback] to=${to} subject="${subject}"\n${html}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    });
    if (error) {
      console.error("[email] Resend returned an error", error);
    }
  } catch (err) {
    console.error("[email] Failed to send email", err);
  }
}
```

- [ ] **Step 2: Write the failing test for the email templates**

Create `src/lib/email/templates.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("./resend", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "./resend";
import { sendPasswordResetEmail, sendVerificationEmail } from "./templates";

describe("sendVerificationEmail", () => {
  it("sends an email containing the verification URL", async () => {
    await sendVerificationEmail("user@example.com", "https://kolu.test/verify?token=abc");

    expect(sendEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining("Verify"),
      expect.stringContaining("https://kolu.test/verify?token=abc"),
    );
  });
});

describe("sendPasswordResetEmail", () => {
  it("sends an email containing the reset URL", async () => {
    await sendPasswordResetEmail("user@example.com", "https://kolu.test/reset-password/abc");

    expect(sendEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining("Reset"),
      expect.stringContaining("https://kolu.test/reset-password/abc"),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/lib/email/templates.test.ts`
Expected: FAIL — `templates.ts` does not exist yet.

- [ ] **Step 4: Write the templates**

Create `src/lib/email/templates.ts`:

```ts
import { sendEmail } from "./resend";

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await sendEmail(
    to,
    "Verify your KOLU email",
    `<p>Welcome to KOLU. Click the link below to verify your email address:</p>
     <p><a href="${url}">${url}</a></p>
     <p>If you didn't create a KOLU account, you can ignore this email.</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await sendEmail(
    to,
    "Reset your KOLU password",
    `<p>We received a request to reset your KOLU password. Click the link below to choose a new one:</p>
     <p><a href="${url}">${url}</a></p>
     <p>If you didn't request this, you can ignore this email.</p>`,
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/lib/email/templates.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/email
git commit -m "Add Resend email sending module with dev console fallback"
```

---

### Task 4: Better Auth server + client instances, route handler

**Files:**
- Create: `src/lib/auth/server.ts`
- Create: `src/lib/auth/client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Delete: `src/lib/auth/types.ts` (Phase 0 placeholder, superseded)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/client` (Phase 0), `env` from `@/lib/env`, `sendVerificationEmail`/`sendPasswordResetEmail` from `@/lib/email/templates` (Task 3).
- Produces: `auth` (Better Auth server instance), `type AuthSession = typeof auth.$Infer.Session` — consumed by Task 5 (session helpers) and Task 6 (registration). `authClient` — consumed by Task 9 (login UI) and Task 11 (password reset UI).

- [ ] **Step 1: Remove the Phase 0 placeholder**

Run: `rm src/lib/auth/types.ts`

- [ ] **Step 2: Write the Better Auth server instance**

Create `src/lib/auth/server.ts`:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/db/client";
import { env } from "@/lib/env";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/templates";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      // Chosen by the user at registration, written directly by our own
      // /api/register route (Task 6) — never trust this if it were settable
      // through Better Auth's public signUp API.
      username: {
        type: "string",
        required: true,
        input: true,
      },
      // Server-owned: input is disabled so the public signUp API can never
      // set a role (e.g. ADMIN) directly. Defaults every new account to
      // SUPPORTER; our own /api/register route (Task 6) elevates it to
      // STREAMER inside a server-controlled transaction when the user
      // chose that at registration (docs/SECURITY.md: never trust
      // client-provided role).
      role: {
        type: ["SUPPORTER", "STREAMER", "ADMIN"],
        required: false,
        defaultValue: "SUPPORTER",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      await sendVerificationEmail(user.email, url);
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
```

- [ ] **Step 3: Write the Better Auth client instance**

Create `src/lib/auth/client.ts`:

```ts
"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
```

- [ ] **Step 4: Mount the Next.js route handler**

Create `src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

export const { POST, GET } = toNextJsHandler(auth);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `role`'s literal-array `type` doesn't satisfy Better Auth's `FieldAttributes` type, check the installed `better-auth` version's type definitions under `node_modules/better-auth/dist/types/*.d.ts` for the exact expected shape and adjust (this mirrors the Phase 0 lesson that fast-moving libraries can diverge from documentation).

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`, then in another terminal:
```bash
curl -s http://localhost:3000/api/auth/ok
```
Expected: Better Auth responds (even a 404 for an unknown sub-path confirms the route handler is mounted and Better Auth is initialized without throwing — a crash here would show a Next.js error page/stack trace instead). Stop the dev server after confirming.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/server.ts src/lib/auth/client.ts src/app/api/auth
git rm src/lib/auth/types.ts
git commit -m "Wire up Better Auth server/client instances and route handler"
```

---

### Task 5: Authorization helpers and API error shape

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/session.test.ts`
- Create: `src/lib/api/errors.ts`
- Create: `src/lib/api/errors.test.ts`

**Interfaces:**
- Consumes: `auth`, `AuthSession` from `@/lib/auth/server` (Task 4).
- Produces: `requireSession(): Promise<AuthSession>`, `requireRole(session: AuthSession, role: "SUPPORTER" | "STREAMER" | "ADMIN"): void`, `requireOwnership(session: AuthSession, ownerUserId: string): void` — consumed by Task 7 (profile routes). `ApiError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `NotFoundError`, `ValidationError`, `toErrorResponse(err: unknown): Response` — consumed by Task 6 and Task 7.

- [ ] **Step 1: Write the failing tests for API errors**

Create `src/lib/api/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  toErrorResponse,
  UnauthorizedError,
  ValidationError,
} from "./errors";

describe("toErrorResponse", () => {
  it("maps UnauthorizedError to 401", async () => {
    const res = toErrorResponse(new UnauthorizedError());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  });

  it("maps ForbiddenError to 403", async () => {
    const res = toErrorResponse(new ForbiddenError());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("maps ConflictError to 409 with a custom message", async () => {
    const res = toErrorResponse(new ConflictError("USERNAME_TAKEN", "That username is taken."));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "USERNAME_TAKEN", message: "That username is taken." } });
  });

  it("maps NotFoundError to 404", async () => {
    const res = toErrorResponse(new NotFoundError());
    expect(res.status).toBe(404);
  });

  it("maps ValidationError to 400", async () => {
    const res = toErrorResponse(new ValidationError("Invalid email."));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Invalid email.");
  });

  it("maps an unknown error to a generic 500", async () => {
    const res = toErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/api/errors.test.ts`
Expected: FAIL — `errors.ts` does not exist yet.

- [ ] **Step 3: Write the error classes and response mapper**

Create `src/lib/api/errors.ts`:

```ts
// Shared API error shape: { error: { code, message } } per docs/API.md.
// Route handlers catch whatever they throw and pass it to toErrorResponse —
// never leak internal error details for unrecognized errors.

export abstract class ApiError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
}

export class UnauthorizedError extends ApiError {
  readonly status = 401;
  readonly code = "UNAUTHORIZED";
  constructor(message = "Authentication required.") {
    super(message);
  }
}

export class ForbiddenError extends ApiError {
  readonly status = 403;
  readonly code = "FORBIDDEN";
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  readonly status = 404;
  readonly code = "NOT_FOUND";
  constructor(message = "Not found.") {
    super(message);
  }
}

export class ConflictError extends ApiError {
  readonly status = 409;
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ValidationError extends ApiError {
  readonly status = 400;
  readonly code = "INVALID_REQUEST";
  constructor(message = "Invalid request.") {
    super(message);
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }

  console.error("[api] Unhandled error", err);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
    { status: 500 },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/api/errors.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing tests for the authorization helpers**

Create `src/lib/auth/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/api/errors";

import { requireOwnership, requireRole } from "./session";
import type { AuthSession } from "./server";

function fakeSession(overrides: Partial<AuthSession["user"]> = {}): AuthSession {
  return {
    session: {
      id: "session_1",
      token: "token_1",
      userId: "user_1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: "user_1",
      email: "user@example.com",
      name: "Test User",
      username: "testuser",
      role: "SUPPORTER",
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    },
  } as AuthSession;
}

describe("requireRole", () => {
  it("does not throw when the role matches", () => {
    expect(() => requireRole(fakeSession({ role: "STREAMER" }), "STREAMER")).not.toThrow();
  });

  it("throws ForbiddenError when the role does not match", () => {
    expect(() => requireRole(fakeSession({ role: "SUPPORTER" }), "STREAMER")).toThrow(
      ForbiddenError,
    );
  });
});

describe("requireOwnership", () => {
  it("does not throw when the session user owns the resource", () => {
    expect(() => requireOwnership(fakeSession({ id: "user_1" }), "user_1")).not.toThrow();
  });

  it("throws ForbiddenError when the session user does not own the resource", () => {
    expect(() => requireOwnership(fakeSession({ id: "user_1" }), "someone_else")).toThrow(
      ForbiddenError,
    );
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/lib/auth/session.test.ts`
Expected: FAIL — `session.ts` does not exist yet.

- [ ] **Step 7: Write the authorization helpers**

Create `src/lib/auth/session.ts`:

```ts
import { headers } from "next/headers";

import { ForbiddenError, UnauthorizedError } from "@/lib/api/errors";

import { auth, type AuthSession } from "./server";

/** Reads the current Better Auth session, or null if there isn't one. */
export async function getCurrentSession(): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: await headers() }) as Promise<AuthSession | null>;
}

/** Throws UnauthorizedError if there's no active session. */
export async function requireSession(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

/** Throws ForbiddenError if the session's role doesn't match. */
export function requireRole(
  session: AuthSession,
  role: "SUPPORTER" | "STREAMER" | "ADMIN",
): void {
  if (session.user.role !== role) {
    throw new ForbiddenError();
  }
}

/** Throws ForbiddenError unless the session user owns the given resource. */
export function requireOwnership(session: AuthSession, ownerUserId: string): void {
  if (session.user.id !== ownerUserId) {
    throw new ForbiddenError();
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/lib/auth/session.test.ts`
Expected: PASS (4 tests). If `AuthSession`'s inferred shape doesn't structurally match the `fakeSession` fixture (e.g. a field renamed), adjust the fixture to match — the inferred type from `better-auth` is the source of truth, not this plan's guess at its shape.

- [ ] **Step 9: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts src/lib/api/errors.ts src/lib/api/errors.test.ts
git commit -m "Add requireSession/requireRole/requireOwnership helpers and API error shape"
```

---

### Task 6: Registration domain logic (schema, role-profile creation, orchestration)

**Files:**
- Create: `src/features/auth/schema.ts`
- Create: `src/features/auth/schema.test.ts`
- Create: `src/features/auth/create-role-profile.ts`
- Create: `src/features/auth/create-role-profile.test.ts`
- Create: `src/features/auth/register.ts`
- Create: `src/features/auth/register.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth/server` (Task 4), `prisma` from `@/lib/db/client` (Phase 0), `ConflictError` from `@/lib/api/errors` (Task 5).
- Produces: `registerSchema` (Zod), `RegisterInput` type, `normalizeUsername(raw: string): string`, `createRoleProfile(tx: Prisma.TransactionClient, userId: string, role: "SUPPORTER" | "STREAMER"): Promise<void>`, `registerUser(input: RegisterInput): Promise<{ userId: string }>` — consumed by Task 7 (`/api/register` route).

- [ ] **Step 1: Write the failing tests for the registration schema**

Create `src/features/auth/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { normalizeUsername, registerSchema } from "./schema";

describe("registerSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "password1234",
    displayName: "Test User",
    username: "Test_User1",
    role: "SUPPORTER" as const,
  };

  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a username with invalid characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "bad username!" });
    expect(result.success).toBe(false);
  });

  it("rejects a username shorter than 3 characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects role values outside SUPPORTER/STREAMER", () => {
    const result = registerSchema.safeParse({ ...valid, role: "ADMIN" });
    expect(result.success).toBe(false);
  });
});

describe("normalizeUsername", () => {
  it("lowercases and trims the username", () => {
    expect(normalizeUsername("  Test_User1  ")).toBe("test_user1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/auth/schema.test.ts`
Expected: FAIL — `schema.ts` does not exist yet.

- [ ] **Step 3: Write the registration schema**

Create `src/features/auth/schema.ts`:

```ts
import { z } from "zod";

// Deliberately excludes ADMIN — registration can only create a SUPPORTER or
// STREAMER account. See src/lib/auth/server.ts for why the role additional
// field itself is also locked down server-side (input: false).
export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(60),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
  role: z.enum(["SUPPORTER", "STREAMER"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/auth/schema.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing tests for role-profile creation**

Create `src/features/auth/create-role-profile.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { createRoleProfile } from "./create-role-profile";

function fakeTx() {
  return {
    profile: { create: vi.fn() },
    streamerProfile: { create: vi.fn() },
    supporterProfile: { create: vi.fn() },
  } as unknown as Prisma.TransactionClient;
}

describe("createRoleProfile", () => {
  it("creates a Profile and a StreamerProfile for role STREAMER", async () => {
    const tx = fakeTx();
    await createRoleProfile(tx, "user_1", "STREAMER", "Test User");

    expect(tx.profile.create).toHaveBeenCalledWith({
      data: { userId: "user_1", displayName: "Test User" },
    });
    expect(tx.streamerProfile.create).toHaveBeenCalledWith({ data: { userId: "user_1" } });
    expect(tx.supporterProfile.create).not.toHaveBeenCalled();
  });

  it("creates a Profile and a SupporterProfile for role SUPPORTER", async () => {
    const tx = fakeTx();
    await createRoleProfile(tx, "user_2", "SUPPORTER", "Another User");

    expect(tx.profile.create).toHaveBeenCalledWith({
      data: { userId: "user_2", displayName: "Another User" },
    });
    expect(tx.supporterProfile.create).toHaveBeenCalledWith({ data: { userId: "user_2" } });
    expect(tx.streamerProfile.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/features/auth/create-role-profile.test.ts`
Expected: FAIL — `create-role-profile.ts` does not exist yet.

- [ ] **Step 7: Write the role-profile creation function**

Create `src/features/auth/create-role-profile.ts`:

```ts
import type { Prisma } from "@prisma/client";

/**
 * Creates the Profile every user gets, plus exactly one of
 * StreamerProfile/SupporterProfile based on role. Must run inside the same
 * transaction as the role update on User (see register.ts) so a crash
 * partway through never leaves a user with no profile or two profiles.
 */
export async function createRoleProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  role: "SUPPORTER" | "STREAMER",
  displayName: string,
): Promise<void> {
  await tx.profile.create({ data: { userId, displayName } });

  if (role === "STREAMER") {
    await tx.streamerProfile.create({ data: { userId } });
  } else {
    await tx.supporterProfile.create({ data: { userId } });
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/features/auth/create-role-profile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Write the failing tests for the registration orchestration**

Create `src/features/auth/register.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: { api: { signUpEmail: vi.fn() } },
}));
vi.mock("@/lib/db/client", () => ({
  prisma: { $transaction: vi.fn() },
}));
vi.mock("./create-role-profile", () => ({
  createRoleProfile: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/client";
import { ConflictError } from "@/lib/api/errors";

import { createRoleProfile } from "./create-role-profile";
import { registerUser } from "./register";

const validInput = {
  email: "user@example.com",
  password: "password1234",
  displayName: "Test User",
  username: "Test_User1",
  role: "SUPPORTER" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerUser", () => {
  it("signs up via Better Auth, then creates the role profile and elevates the role in one transaction", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: "user_1" },
    } as never);

    const tx = { user: { update: vi.fn() } };
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: never) => cb(tx as never));

    const result = await registerUser({ ...validInput, role: "STREAMER" });

    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: "user@example.com",
        password: "password1234",
        name: "Test User",
        username: "test_user1",
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { role: "STREAMER" },
    });
    expect(createRoleProfile).toHaveBeenCalledWith(tx, "user_1", "STREAMER", "Test User");
    expect(result).toEqual({ userId: "user_1" });
  });

  it("does not update the role when registering as SUPPORTER (default is already SUPPORTER)", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: "user_2" },
    } as never);

    const tx = { user: { update: vi.fn() } };
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: never) => cb(tx as never));

    await registerUser(validInput);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(createRoleProfile).toHaveBeenCalledWith(tx, "user_2", "SUPPORTER", "Test User");
  });

  it("throws ConflictError when Better Auth reports the email is already taken", async () => {
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(
      Object.assign(new Error("exists"), {
        body: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
      }),
    );

    await expect(registerUser(validInput)).rejects.toThrow(ConflictError);
  });

  it("throws ConflictError when the transaction hits a unique constraint (e.g. username taken)", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: "user_3" },
    } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("unique constraint"), { code: "P2002" }),
    );

    await expect(registerUser(validInput)).rejects.toThrow(ConflictError);
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npm run test -- src/features/auth/register.test.ts`
Expected: FAIL — `register.ts` does not exist yet.

- [ ] **Step 11: Write the registration orchestration function**

Create `src/features/auth/register.ts`:

```ts
import { auth } from "@/lib/auth/server";
import { ConflictError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";

import { createRoleProfile } from "./create-role-profile";
import { normalizeUsername, type RegisterInput } from "./schema";

interface BetterAuthErrorShape {
  body?: { code?: string };
}

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Creates a new account: Better Auth owns the credential/session tables;
 * role defaults to SUPPORTER there (input disabled, see
 * src/lib/auth/server.ts). This function then, in one transaction, elevates
 * the role to STREAMER if chosen and creates the matching Profile +
 * StreamerProfile/SupporterProfile — so a user is never left half-created.
 */
export async function registerUser(input: RegisterInput): Promise<{ userId: string }> {
  const username = normalizeUsername(input.username);

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.displayName,
        username,
      },
    });
    userId = result.user.id;
  } catch (err) {
    const code = (err as BetterAuthErrorShape).body?.code;
    if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      throw new ConflictError("EMAIL_TAKEN", "That email is already registered.");
    }
    if (isPrismaUniqueConstraintError(err)) {
      throw new ConflictError("USERNAME_TAKEN", "That username is taken.");
    }
    throw err;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (input.role === "STREAMER") {
        await tx.user.update({ where: { id: userId }, data: { role: "STREAMER" } });
      }
      await createRoleProfile(tx, userId, input.role, input.displayName);
    });
  } catch (err) {
    if (isPrismaUniqueConstraintError(err)) {
      throw new ConflictError("USERNAME_TAKEN", "That username is taken.");
    }
    throw err;
  }

  return { userId };
}
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npm run test -- src/features/auth/register.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 13: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors. If `auth.api.signUpEmail`'s real return/error shape differs from what's mocked here (check `node_modules/better-auth/dist/types/*.d.ts` if unsure), adjust `register.ts`'s error-detection logic and the corresponding test fixtures to match — the installed library's actual types are the source of truth.

- [ ] **Step 14: Commit**

```bash
git add src/features/auth
git commit -m "Add registration domain logic: schema, role-profile creation, orchestration"
```

---

### Task 7: API routes — register, profile

**Files:**
- Create: `src/app/api/register/route.ts`
- Create: `src/app/api/me/profile/route.ts`
- Create: `src/app/api/me/profile/route.test.ts`
- Create: `src/app/api/users/[username]/route.ts`
- Create: `src/app/api/streamers/[username]/route.ts`

**Interfaces:**
- Consumes: `registerSchema`, `registerUser` (Task 6); `requireSession`, `requireOwnership` (Task 5); `toErrorResponse`, `ValidationError`, `NotFoundError` (Task 5); `prisma` (Phase 0).

- [ ] **Step 1: Write the registration route**

Create `src/app/api/register/route.ts`:

```ts
import { toErrorResponse, ValidationError } from "@/lib/api/errors";
import { registerSchema } from "@/features/auth/schema";
import { registerUser } from "@/features/auth/register";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const { userId } = await registerUser(parsed.data);
    return Response.json({ userId }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 2: Write the failing test for the profile PATCH route**

Create `src/app/api/me/profile/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: { profile: { update: vi.fn() } },
}));

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

import { PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeRequest(body: unknown) {
  return new Request("http://localhost/api/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/me/profile", () => {
  it("updates the caller's own profile", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user_1" },
    } as never);
    vi.mocked(prisma.profile.update).mockResolvedValue({} as never);

    const res = await PATCH(fakeRequest({ displayName: "New Name" }));

    expect(res.status).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: { displayName: "New Name" },
    });
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(requireSession).mockRejectedValue(
      Object.assign(new Error("Authentication required."), { status: 401, code: "UNAUTHORIZED" }),
    );

    const res = await PATCH(fakeRequest({ displayName: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user_1" } } as never);

    const res = await PATCH(fakeRequest({ displayName: "" }));
    expect(res.status).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/app/api/me/profile/route.test.ts`
Expected: FAIL — `route.ts` does not exist yet.

- [ ] **Step 4: Write the profile PATCH route**

Create `src/app/api/me/profile/route.ts`:

```ts
import { z } from "zod";

import { toErrorResponse, ValidationError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  avatarUrl: z.string().trim().url().max(2048).optional(),
  bio: z.string().trim().max(500).optional(),
  publicVisibility: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    await prisma.profile.update({
      where: { userId: session.user.id },
      data: parsed.data,
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/app/api/me/profile/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the public user profile route**

Create `src/app/api/users/[username]/route.ts`:

```ts
import { NotFoundError, toErrorResponse } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });

    if (!user || !user.profile || !user.profile.publicVisibility) {
      // Treat a private profile the same as a nonexistent one — never leak
      // whether a username exists to an unauthorized caller (docs/SECURITY.md).
      throw new NotFoundError();
    }

    return Response.json({
      username: user.username,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      bio: user.profile.bio,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 7: Write the public streamer profile route**

Create `src/app/api/streamers/[username]/route.ts`:

```ts
import { NotFoundError, toErrorResponse } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true, streamerProfile: true },
    });

    if (
      !user ||
      user.role !== "STREAMER" ||
      !user.streamerProfile ||
      !user.profile ||
      !user.profile.publicVisibility
    ) {
      throw new NotFoundError();
    }

    return Response.json({
      username: user.username,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      bannerUrl: user.streamerProfile.bannerUrl,
      description: user.streamerProfile.description,
      donationEnabled: user.streamerProfile.donationEnabled,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 8: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/register src/app/api/me src/app/api/users src/app/api/streamers
git commit -m "Add register, profile, and public profile API routes"
```

---

### Task 8: UI — Register page

**Files:**
- Create: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `POST /api/register` (Task 7).

- [ ] **Step 1: Write the register page**

Create `src/app/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";

type Role = "SUPPORTER" | "STREAMER";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const body = {
      email: form.get("email"),
      password: form.get("password"),
      displayName: form.get("displayName"),
      username: form.get("username"),
      role: form.get("role") as Role,
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Something went wrong.");
        return;
      }

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-md text-sm text-foreground/70">
          We sent a verification link to your email address. Verify it, then{" "}
          <a href="/login" className="text-brand-accent underline">
            log in
          </a>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold">Create your KOLU account</h1>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            name="displayName"
            type="text"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Username
          <input
            name="username"
            type="text"
            required
            minLength={3}
            pattern="[a-zA-Z0-9_]+"
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>I am a</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="SUPPORTER" defaultChecked />
            Supporter
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="STREAMER" />
            Streamer
          </label>
        </fieldset>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b] disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/register` in a browser, fill the form, submit. Expected: either the "check your email" screen appears (success) or a clear error message appears (e.g. duplicate email/username) — no unhandled exception. Check the server console: if `RESEND_API_KEY` is unset, the verification email's HTML (including its URL) should be logged there (Task 3's dev fallback). Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/app/register
git commit -m "Add registration page"
```

---

### Task 9: UI — Login page

**Files:**
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `authClient` from `@/lib/auth/client` (Task 4).

- [ ] **Step 1: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const { error: signInError } = await authClient.signIn.email({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message ?? "Could not log in.");
      return;
    }

    window.location.href = "/me";
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Log in to KOLU</h1>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b] disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>

        <a href="/forgot-password" className="text-sm text-foreground/70 underline">
          Forgot your password?
        </a>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Register a test account at `/register`, mark it verified directly in the database for now (`UPDATE users SET "emailVerified" = true WHERE email = '...';` via `docker exec -it kolu-postgres-1 psql -U kolu -d kolu_dev` — Task 11 wires up the real verification link), then log in at `/login`. Expected: redirected to `/me` (which doesn't exist until Task 13 — a 404 there is fine for this task; the goal is confirming login itself succeeds and sets a session cookie). Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/app/login
git commit -m "Add login page"
```

---

### Task 10: UI — Forgot password / reset password

**Files:**
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/reset-password/[token]/page.tsx`

**Interfaces:**
- Consumes: `authClient.requestPasswordReset`, `authClient.resetPassword` from `@/lib/auth/client` (Task 4).

- [ ] **Step 1: Write the forgot-password page**

Create `src/app/forgot-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    // Better Auth returns a generic success response whether or not the
    // email exists, to avoid leaking which emails are registered.
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-md text-sm text-foreground/70">
          If that email is registered, we sent a password reset link to it.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Reset your password</h1>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b]"
        >
          Send reset link
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Write the reset-password page**

Create `src/app/reset-password/[token]/page.tsx`:

```tsx
"use client";

import { use, useState } from "react";

import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));

    const { error: resetError } = await authClient.resetPassword({ newPassword, token });

    if (resetError) {
      setError(resetError.message ?? "Could not reset password. The link may have expired.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p className="max-w-md text-sm text-foreground/70">
          You can now{" "}
          <a href="/login" className="text-brand-accent underline">
            log in
          </a>{" "}
          with your new password.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>

        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b]"
        >
          Update password
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, visit `/forgot-password`, submit a registered test email. Check the server console for the logged reset email (Task 3's dev fallback) if `RESEND_API_KEY` is unset — copy the URL it printed. Expected URL shape: `{baseURL}/reset-password/<token>?callbackURL=...` (confirm this matches the `[token]` dynamic route built in Step 2 — if Better Auth's actual URL shape differs, adjust the route path accordingly). Visit that URL, submit a new password. Expected: "Password updated" screen, and logging in at `/login` with the new password succeeds. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/app/forgot-password src/app/reset-password
git commit -m "Add forgot-password and reset-password pages"
```

---

### Task 11: UI — Email verification + resend action

**Files:**
- Create: `src/app/verify-email/success/page.tsx`
- Create: `src/app/resend-verification/page.tsx`

**Interfaces:**
- Consumes: `authClient.sendVerificationEmail` from `@/lib/auth/client` (Task 4).

- [ ] **Step 1: Write the verification success page**

Better Auth's verification link points directly at its own `/api/auth/verify-email` endpoint and redirects to a `callbackURL` on success — set that callback to this page when triggering verification emails.

Create `src/app/verify-email/success/page.tsx`:

```tsx
export default function VerifyEmailSuccessPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Email verified</h1>
      <p className="max-w-md text-sm text-foreground/70">
        Your email is verified. You can now{" "}
        <a href="/login" className="text-brand-accent underline">
          log in
        </a>
        .
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Point the verification email's callback at the success page**

Better Auth's verification link points directly at its own `/api/auth/verify-email` endpoint and redirects to a `callbackURL` on success. `callbackURL` is a body param accepted by `signUpEmail` itself (the same param `authClient.signUp.email` takes per Better Auth's docs) — pass it from `src/features/auth/register.ts`.

Edit `src/features/auth/register.ts` — add `callbackURL` to the `signUpEmail` call:

```ts
const result = await auth.api.signUpEmail({
  body: {
    email: input.email,
    password: input.password,
    name: input.displayName,
    username,
    callbackURL: "/verify-email/success",
  },
});
```

Update the corresponding assertion in `src/features/auth/register.test.ts` (both `signUpEmail` call-shape checks from Task 6 Step 9) to include `callbackURL: "/verify-email/success"` in the expected body, then re-run `npm run test -- src/features/auth/register.test.ts` to confirm it still passes.

The end result: clicking the verification link in the emailed URL lands the browser on `/verify-email/success`.

- [ ] **Step 3: Write the resend-verification page**

Create `src/app/resend-verification/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email/success" });
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-md text-sm text-foreground/70">
          If that email is registered and not yet verified, we sent a new verification link.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Resend verification email</h1>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b]"
        >
          Resend email
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, register a new test account at `/register`, check the server console for the logged verification URL (Task 3's dev fallback), visit it. Expected: browser lands on `/verify-email/success`, and the user's `emailVerified` column is now `true` (verify via `docker exec -it kolu-postgres-1 psql -U kolu -d kolu_dev -c "SELECT email, \"emailVerified\" FROM users;"`). Then log in at `/login` — expected to succeed now that the account is verified. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/app/verify-email src/app/resend-verification src/lib/auth/server.ts src/features/auth/register.ts
git commit -m "Wire up email verification success page and resend action"
```

---

### Task 12: UI — Profile pages (/me, /[username])

**Files:**
- Create: `src/app/me/page.tsx`
- Create: `src/app/[username]/page.tsx`

**Interfaces:**
- Consumes: `requireSession` from `@/lib/auth/session` (Task 5), `prisma` (Phase 0), `PATCH /api/me/profile` (Task 7).

- [ ] **Step 1: Write the own-profile edit page (server component + client form)**

Create `src/app/me/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

import { ProfileForm } from "./profile-form";

export default async function MePage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) {
    // Should never happen — every user gets a Profile at registration
    // (src/features/auth/create-role-profile.ts).
    throw new Error("Profile not found for authenticated user");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <ProfileForm
          initialDisplayName={profile.displayName}
          initialBio={profile.bio ?? ""}
          initialPublicVisibility={profile.publicVisibility}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the client-side form component**

Create `src/app/me/profile-form.tsx`:

```tsx
"use client";

import { useState } from "react";

export function ProfileForm({
  initialDisplayName,
  initialBio,
  initialPublicVisibility,
}: {
  initialDisplayName: string;
  initialBio: string;
  initialPublicVisibility: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const form = new FormData(event.currentTarget);
    const body = {
      displayName: String(form.get("displayName")),
      bio: String(form.get("bio")),
      publicVisibility: form.get("publicVisibility") === "on",
    };

    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
          required
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Bio
        <textarea
          name="bio"
          defaultValue={initialBio}
          maxLength={500}
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publicVisibility" defaultChecked={initialPublicVisibility} />
        Make my profile public
      </label>

      {status === "saved" && <p className="text-sm text-brand-accent">Saved.</p>}
      {status === "error" && <p className="text-sm text-red-400">Could not save.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b] disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write the public profile page**

Create `src/app/[username]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/client";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: true, streamerProfile: true },
  });

  if (!user || !user.profile || !user.profile.publicVisibility) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">{user.profile.displayName}</h1>
      <p className="text-sm text-foreground/70">@{user.username}</p>
      {user.profile.bio && <p className="max-w-md text-sm">{user.profile.bio}</p>}
      {user.role === "STREAMER" && user.streamerProfile?.description && (
        <p className="max-w-md text-sm text-foreground/70">
          {user.streamerProfile.description}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Log in as a verified test account, visit `/me`, edit the display name and bio, save, reload the page and confirm the changes persisted. Visit `/<that-account's-username>` in a new tab and confirm the public profile page shows the updated display name/bio (when `publicVisibility` is on) or 404s (when turned off). Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/app/me src/app/[username]
git commit -m "Add profile edit and public profile pages"
```

---

### Task 13: Final verification, docs, and wrap-up

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `README.md`

**Interfaces:** None — this task only verifies and documents.

- [ ] **Step 1: Full verification sweep**

Run, in order:
```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```
Expected: all four succeed with no errors.

- [ ] **Step 2: End-to-end manual click-through**

Run: `npm run dev`. Walk the full flow once, start to finish, in a browser:
1. `/register` → create a STREAMER account → "check your email" screen.
2. Check server console for the verification URL (or real inbox if `RESEND_API_KEY` is set) → visit it → lands on `/verify-email/success`.
3. `/login` → log in with that account → redirected to `/me`.
4. `/me` → edit display name/bio, toggle public visibility on → save → reload → changes persisted.
5. Open `/<username>` in a new tab → public profile displays correctly.
6. `/forgot-password` → request a reset for that account → check console/inbox for the reset URL → visit it → set a new password → `/login` with the new password succeeds.

Expected: every step works with no unhandled errors. Note any step that doesn't behave as described — fix before proceeding to Step 3.

- [ ] **Step 3: Log the Phase 1 decisions in docs/DECISIONS.md**

Append to `docs/DECISIONS.md` (before the `## Template` section), using the project's existing decision-log format:

```md
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
```

- [ ] **Step 4: Update README's setup steps**

Edit `README.md`'s Setup section to include the new env vars. Replace the existing setup code block with:

```bash
npm install
cp .env.example .env   # then set BETTER_AUTH_SECRET (openssl rand -base64 32) and RESEND_API_KEY
docker compose up -d   # starts Postgres on localhost:5433
npx prisma migrate dev
npm run dev             # http://localhost:3000
```

Also add a short note after the Stack section:

```md
## Identity (Phase 1)

Registration, login, email verification, and password reset are implemented
via [Better Auth](https://better-auth.com) (email+password only) with
[Resend](https://resend.com) for email delivery. If `RESEND_API_KEY` is
unset, emails are logged to the server console instead of sent — see
`src/lib/email/resend.ts`.
```

- [ ] **Step 5: Final git status check**

Run: `git status --porcelain=v1 -uall`
Expected: no untracked `.env` file, no `node_modules`/`.next` listed (already gitignored from Phase 0).

- [ ] **Step 6: Commit**

```bash
git add docs/DECISIONS.md README.md
git commit -m "Document Phase 1 (Identity) decisions and update README setup steps"
```
