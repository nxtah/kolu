# Phase 2 (Donation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement KOLU Phase 2 (Donation) — a public donation page, Xendit Payment Session integration, webhook-driven donation completion with idempotency, and donation history — per the approved spec at `docs/superpowers/specs/2026-10-07-phase2-donation-design.md`.

**Architecture:** A `XenditAdapter` calls Xendit's Payment Session REST endpoint directly via `fetch` (no SDK — `xendit-node` doesn't yet cover this API), implementing the existing `PaymentProviderAdapter` interface from `src/lib/payments/types.ts`. `POST /api/donations` validates input, creates `Donation`+`Payment` (both `PENDING`) in one transaction, calls the adapter, and returns a checkout URL. `POST /api/webhooks/payment` verifies a static `x-callback-token` header, looks up the `Payment` by the `reference_id` we ourselves supplied (our own `Payment.id`, never a value Xendit invents), checks idempotency via `Payment.status`, and updates `Payment`/`Donation` state — with explicit no-op hook points for XP/media/realtime (Phases 3-5, not built yet).

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), Prisma 7, Zod, Vitest. Builds on Phase 1 (Identity, merged to `master`).

## Global Constraints

- Never trust a client-supplied userId/role/donation status — every authorization and payment-state check happens server-side.
- All API routes return errors as `{ error: { code, message } }`.
- Money is an integer, minor currency unit — never a float.
- Webhook idempotency: a replayed webhook for an already-terminal `Payment` must be a safe no-op, never double-apply state.
- No automated test makes a live call to Xendit's API — the `xendit-node` package is NOT a dependency of this plan; all adapter tests mock the global `fetch`.
- The exact Xendit webhook payload/event-name shape is **not fully confirmed from public docs** (see Task 5) — the plan designs defensively and flags exactly where to verify/adjust once Xendit sandbox access exists. Do not skip that verification step when sandbox keys become available.
- IDR only, no currency picker, no minimum donation amount beyond "a positive integer," guest donations allowed (no account required).

---

### Task 1: Env vars and payments interface extension

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/lib/env.test.ts`
- Modify: `vitest.config.mts`
- Modify: `.env.example`
- Modify: `src/lib/payments/types.ts`

**Interfaces:**
- Produces: `env.XENDIT_SECRET_KEY: string`, `env.XENDIT_WEBHOOK_TOKEN: string` — consumed by Task 2. Extended `CreatePaymentInput` (adds `description?`, `successReturnUrl?`) and new `PaymentProviderAdapter.parseWebhookEvent(rawBody: string): WebhookEvent | null` — consumed by Task 2 and Task 5.

- [ ] **Step 1: Extend the env schema**

Edit `src/lib/env.ts` — add to `envSchema`:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  RESEND_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  EMAIL_FROM: z.string().min(1),
  XENDIT_SECRET_KEY: z.string().min(1),
  XENDIT_WEBHOOK_TOKEN: z.string().min(1),
});
```

- [ ] **Step 2: Update env.test.ts's shared fixture and add new cases**

Edit `src/lib/env.test.ts` — add `XENDIT_SECRET_KEY: "xnd_development_test_key"` and `XENDIT_WEBHOOK_TOKEN: "test-webhook-token"` to `BASE_VALID_ENV`, and add these two cases:

```ts
  it("throws when XENDIT_SECRET_KEY is missing", () => {
    const { XENDIT_SECRET_KEY, ...rest } = BASE_VALID_ENV;
    expect(() => loadEnv(rest)).toThrow(/XENDIT_SECRET_KEY/);
  });

  it("throws when XENDIT_WEBHOOK_TOKEN is missing", () => {
    const { XENDIT_WEBHOOK_TOKEN, ...rest } = BASE_VALID_ENV;
    expect(() => loadEnv(rest)).toThrow(/XENDIT_WEBHOOK_TOKEN/);
  });
```

- [ ] **Step 3: Update the Vitest env fixture**

Edit `vitest.config.mts` — add to `test.env`:

```ts
      XENDIT_SECRET_KEY: "xnd_development_test_key",
      XENDIT_WEBHOOK_TOKEN: "test-webhook-token",
```

- [ ] **Step 4: Run the env tests**

Run: `npm run test -- src/lib/env.test.ts`
Expected: all tests pass (9 total: 7 existing + 2 new).

- [ ] **Step 5: Add Xendit env vars to .env.example**

Edit `.env.example` — add to the `LOCAL DEVELOPMENT VARIABLES` section (after the Resend/email vars):

```bash
# Xendit Payment Session API. Get sandbox keys from the Xendit dashboard
# (Settings > API Keys for XENDIT_SECRET_KEY, Settings > Webhooks for
# XENDIT_WEBHOOK_TOKEN — the "Verification Token" shown there, not a
# webhook you create yourself). Sandbox keys are free and don't require
# full merchant activation.
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
```

- [ ] **Step 6: Extend the payments interface**

Edit `src/lib/payments/types.ts` — replace its contents with:

```ts
// Provider-agnostic boundary for payments. docs/DECISIONS.md records Xendit
// as the chosen provider (Payment Session API) as of Phase 2 — this
// interface stays provider-agnostic regardless, so the donation core never
// depends on Xendit specifically.

export type PaymentProviderName = "XENDIT" | "MIDTRANS";

export interface CreatePaymentInput {
  /** Integer, minor currency unit — never a float (docs/CLAUDE.md rule 11). */
  amount: number;
  currency: string;
  /** Our own idempotency/correlation reference — never provider-generated. */
  reference: string;
  description?: string;
  successReturnUrl?: string;
  cancelReturnUrl?: string;
}

export interface CreatePaymentResult {
  providerReference: string;
  redirectUrl: string;
  /** Full raw provider response, stored for audit/debugging. */
  rawResponse: unknown;
}

/** Normalized outcome of a provider webhook event, after signature verification. */
export interface WebhookEvent {
  /** Matches CreatePaymentInput.reference — how we find our own Payment row. */
  reference: string;
  status: "PAID" | "FAILED";
  rawPayload: unknown;
}

/**
 * Verifies a webhook payload's signature and returns the parsed event, or
 * null if the signature is invalid. Implementations must never trust an
 * unverified payload (docs/SECURITY.md, docs/PAYMENT.md).
 */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderName;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhookSignature(signatureHeader: string | null): boolean;
  parseWebhookEvent(rawBody: string): WebhookEvent | null;
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (nothing implements this interface yet, so no call sites to break).

- [ ] **Step 8: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts vitest.config.mts .env.example src/lib/payments/types.ts
git commit -m "Add Xendit env vars and extend the payments provider interface"
```

---

### Task 2: XenditAdapter

**Files:**
- Create: `src/lib/payments/xendit/adapter.ts`
- Create: `src/lib/payments/xendit/adapter.test.ts`

**Interfaces:**
- Consumes: `env.XENDIT_SECRET_KEY`, `env.XENDIT_WEBHOOK_TOKEN` from `@/lib/env` (Task 1); `CreatePaymentInput`, `CreatePaymentResult`, `WebhookEvent`, `PaymentProviderAdapter` from `@/lib/payments/types` (Task 1).
- Produces: `xenditAdapter: PaymentProviderAdapter` — consumed by Task 3 (`createDonation`) and Task 5 (webhook route).

- [ ] **Step 1: Write the failing tests for createPayment**

Create `src/lib/payments/xendit/adapter.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { xenditAdapter } from "./adapter";

describe("xenditAdapter.createPayment", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs to the Payment Session endpoint with Basic Auth and returns the checkout URL", async () => {
    const mockResponse = {
      payment_session_id: "ps-abc123",
      payment_link_url: "https://checkout.xendit.co/sessions/ps-abc123",
      status: "ACTIVE",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    global.fetch = fetchMock as never;

    const result = await xenditAdapter.createPayment({
      amount: 50000,
      currency: "IDR",
      reference: "payment_1",
      description: "Donation to streamer1",
      successReturnUrl: "https://kolu.test/donations/donation_1/thanks",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.xendit.co/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      reference_id: "payment_1",
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: 50000,
      currency: "IDR",
      country: "ID",
      description: "Donation to streamer1",
      success_return_url: "https://kolu.test/donations/donation_1/thanks",
    });

    expect(result).toEqual({
      providerReference: "ps-abc123",
      redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123",
      rawResponse: mockResponse,
    });
  });

  it("throws when Xendit returns a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error_code: "INVALID_REQUEST" }),
    }) as never;

    await expect(
      xenditAdapter.createPayment({
        amount: 50000,
        currency: "IDR",
        reference: "payment_1",
      }),
    ).rejects.toThrow();
  });
});

describe("xenditAdapter.verifyWebhookSignature", () => {
  it("returns true when the header matches the configured token", () => {
    expect(xenditAdapter.verifyWebhookSignature("test-webhook-token")).toBe(true);
  });

  it("returns false when the header doesn't match", () => {
    expect(xenditAdapter.verifyWebhookSignature("wrong-token")).toBe(false);
  });

  it("returns false when the header is missing", () => {
    expect(xenditAdapter.verifyWebhookSignature(null)).toBe(false);
  });
});

describe("xenditAdapter.parseWebhookEvent", () => {
  it("parses a successful payment event", () => {
    const payload = JSON.stringify({
      event: "payment.capture",
      data: { reference_id: "payment_1", status: "SUCCEEDED" },
    });

    expect(xenditAdapter.parseWebhookEvent(payload)).toEqual({
      reference: "payment_1",
      status: "PAID",
      rawPayload: JSON.parse(payload),
    });
  });

  it("parses a failed payment event", () => {
    const payload = JSON.stringify({
      event: "payment.failure",
      data: { reference_id: "payment_1", status: "FAILED" },
    });

    expect(xenditAdapter.parseWebhookEvent(payload)).toEqual({
      reference: "payment_1",
      status: "FAILED",
      rawPayload: JSON.parse(payload),
    });
  });

  it("returns null for an unrecognized event shape", () => {
    expect(xenditAdapter.parseWebhookEvent(JSON.stringify({ foo: "bar" }))).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(xenditAdapter.parseWebhookEvent("not json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/payments/xendit/adapter.test.ts`
Expected: FAIL — `adapter.ts` does not exist yet.

- [ ] **Step 3: Write the adapter**

Create `src/lib/payments/xendit/adapter.ts`:

```ts
import { env } from "@/lib/env";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProviderAdapter,
  WebhookEvent,
} from "@/lib/payments/types";

const XENDIT_SESSIONS_URL = "https://api.xendit.co/sessions";

/**
 * Calls Xendit's Payment Session REST endpoint directly via fetch — the
 * official xendit-node SDK does not yet cover this API (confirmed by
 * reading its README during planning), so a documented, confirmed REST
 * call is more reliable than depending on unconfirmed SDK support.
 */
async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const body: Record<string, unknown> = {
    reference_id: input.reference,
    session_type: "PAY",
    mode: "PAYMENT_LINK",
    amount: input.amount,
    currency: input.currency,
    country: "ID",
  };
  if (input.description) body.description = input.description;
  if (input.successReturnUrl) body.success_return_url = input.successReturnUrl;
  if (input.cancelReturnUrl) body.cancel_return_url = input.cancelReturnUrl;

  const response = await fetch(XENDIT_SESSIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Xendit's Payment Session API uses HTTP Basic Auth: secret key as
      // the username, empty password.
      Authorization: `Basic ${Buffer.from(`${env.XENDIT_SECRET_KEY}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Xendit createPayment failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return {
    providerReference: json.payment_session_id,
    redirectUrl: json.payment_link_url,
    rawResponse: json,
  };
}

/**
 * Xendit's Payment Session webhooks use a static shared-secret header
 * (x-callback-token), not a computed HMAC signature — confirmed during
 * planning against Xendit's own docs. Constant-time-ish comparison isn't
 * critical here the way it is for cryptographic signatures, but we still
 * avoid short-circuiting on the raw header to keep this robust if Xendit
 * changes their scheme later.
 */
function verifyWebhookSignature(signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  return signatureHeader === env.XENDIT_WEBHOOK_TOKEN;
}

/**
 * Parses a webhook payload into a normalized event.
 *
 * IMPORTANT — verify against real Xendit sandbox data once available: the
 * exact event names and payload shape for Payment Session webhooks aren't
 * fully confirmed from public docs as of this writing (payment.capture/
 * payment.failure with data.reference_id/data.status is the best-documented
 * shape found, from Xendit's Payment Request webhook docs — Payment Session
 * is built on the same underlying infrastructure). If Xendit's dashboard
 * webhook simulator or a real sandbox event shows different field names,
 * update the parsing below (and this plan's Task 5 test fixtures) to match
 * — do not guess further without real data.
 */
function parseWebhookEvent(rawBody: string): WebhookEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const payload = parsed as { event?: unknown; data?: { reference_id?: unknown; status?: unknown } };

  const reference = payload.data?.reference_id;
  if (typeof reference !== "string") return null;

  if (payload.event === "payment.capture") {
    return { reference, status: "PAID", rawPayload: parsed };
  }
  if (payload.event === "payment.failure") {
    return { reference, status: "FAILED", rawPayload: parsed };
  }

  return null;
}

export const xenditAdapter: PaymentProviderAdapter = {
  provider: "XENDIT",
  createPayment,
  verifyWebhookSignature,
  parseWebhookEvent,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/payments/xendit/adapter.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/payments/xendit
git commit -m "Add XenditAdapter: Payment Session creation and webhook parsing"
```

---

### Task 3: Donation domain logic (schema, orchestration)

**Files:**
- Create: `src/features/donations/schema.ts`
- Create: `src/features/donations/schema.test.ts`
- Create: `src/features/donations/create-donation.ts`
- Create: `src/features/donations/create-donation.test.ts`

**Interfaces:**
- Consumes: `xenditAdapter` from `@/lib/payments/xendit/adapter` (Task 2); `prisma` from `@/lib/db/client`; `NotFoundError`, `ConflictError` from `@/lib/api/errors`; `env.NEXT_PUBLIC_APP_URL` from `@/lib/env`.
- Produces: `donationSchema` (Zod), `DonationInput` type, `createDonation(input: DonationInput, supporterId: string | null): Promise<{ donationId: string; redirectUrl: string }>` — consumed by Task 4 (`POST /api/donations` route).

- [ ] **Step 1: Write the failing tests for the donation schema**

Create `src/features/donations/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { donationSchema } from "./schema";

describe("donationSchema", () => {
  const valid = {
    streamerUsername: "teststreamer",
    amount: 50000,
    displayName: "Supporter",
    message: "Semangat!",
    anonymous: false,
  };

  it("accepts a valid donation payload", () => {
    expect(donationSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a payload with no message and no anonymous flag", () => {
    const { message, anonymous, ...rest } = valid;
    expect(donationSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(donationSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    expect(donationSchema.safeParse({ ...valid, amount: 50000.5 }).success).toBe(false);
  });

  it("rejects an empty display name", () => {
    expect(donationSchema.safeParse({ ...valid, displayName: "" }).success).toBe(false);
  });

  it("rejects a message longer than 500 characters", () => {
    expect(donationSchema.safeParse({ ...valid, message: "a".repeat(501) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/donations/schema.test.ts`
Expected: FAIL — `schema.ts` does not exist yet.

- [ ] **Step 3: Write the donation schema**

Create `src/features/donations/schema.ts`:

```ts
import { z } from "zod";

// IDR only, no currency field — matches docs/superpowers/specs/2026-10-07-phase2-donation-design.md.
// No minimum beyond "a positive integer" (per that spec's brainstorming decision).
export const donationSchema = z.object({
  streamerUsername: z.string().trim().min(1).max(24),
  amount: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(60),
  message: z.string().trim().max(500).optional(),
  anonymous: z.boolean().optional(),
});

export type DonationInput = z.infer<typeof donationSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/donations/schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing tests for createDonation**

Create `src/features/donations/create-donation.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/payments/xendit/adapter", () => ({
  xenditAdapter: { createPayment: vi.fn() },
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    streamerProfile: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { xenditAdapter } from "@/lib/payments/xendit/adapter";
import { prisma } from "@/lib/db/client";
import { NotFoundError, ConflictError } from "@/lib/api/errors";

import { createDonation } from "./create-donation";

const validInput = {
  streamerUsername: "teststreamer",
  amount: 50000,
  displayName: "Supporter",
  message: "Semangat!",
  anonymous: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeTx() {
  return {
    donation: { create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn() },
  };
}

describe("createDonation", () => {
  it("throws NotFoundError when the streamer username doesn't exist", async () => {
    vi.mocked(prisma.streamerProfile.findFirst).mockResolvedValue(null);

    await expect(createDonation(validInput, null)).rejects.toThrow(NotFoundError);
    expect(xenditAdapter.createPayment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the streamer has donations disabled", async () => {
    vi.mocked(prisma.streamerProfile.findFirst).mockResolvedValue({
      id: "streamer_1",
      donationEnabled: false,
    } as never);

    await expect(createDonation(validInput, null)).rejects.toThrow(ConflictError);
    expect(xenditAdapter.createPayment).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("calls Xendit before writing anything, then creates Payment + Donation in one transaction with pre-generated ids", async () => {
    vi.mocked(prisma.streamerProfile.findFirst).mockResolvedValue({
      id: "streamer_1",
      donationEnabled: true,
    } as never);

    vi.mocked(xenditAdapter.createPayment).mockResolvedValue({
      providerReference: "ps-abc123",
      redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123",
      rawResponse: { payment_session_id: "ps-abc123" },
    });

    const tx = fakeTx();
    vi.mocked(prisma.$transaction).mockImplementation(
      (cb: unknown) => (cb as (tx: unknown) => unknown)(tx) as never,
    );

    // crypto.randomUUID() is called twice in order: paymentId, then
    // donationId. Stub both calls so assertions below can use exact values.
    const randomUUIDSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("payment-uuid-1" as never)
      .mockReturnValueOnce("donation-uuid-1" as never);

    const result = await createDonation(validInput, null);

    // Xendit is called with the pre-generated payment id, before any DB
    // row exists — never a DB-generated id we don't have yet.
    expect(xenditAdapter.createPayment).toHaveBeenCalledWith({
      amount: 50000,
      currency: "IDR",
      reference: "payment-uuid-1",
      description: "Donation to teststreamer",
      successReturnUrl: expect.stringContaining("/donations/donation-uuid-1/thanks"),
    });

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        id: "payment-uuid-1",
        provider: "XENDIT",
        providerReference: "ps-abc123",
        amount: 50000,
        currency: "IDR",
        rawReferenceMetadata: { payment_session_id: "ps-abc123" },
      },
    });
    expect(tx.donation.create).toHaveBeenCalledWith({
      data: {
        id: "donation-uuid-1",
        streamerId: "streamer_1",
        supporterId: null,
        amount: 50000,
        currency: "IDR",
        displayName: "Supporter",
        message: "Semangat!",
        anonymous: false,
        paymentId: "payment-uuid-1",
      },
    });
    expect(result).toEqual({
      donationId: "donation-uuid-1",
      redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123",
    });

    randomUUIDSpy.mockRestore();
  });

  it("never touches the database when the Xendit call fails — no orphaned PENDING rows", async () => {
    vi.mocked(prisma.streamerProfile.findFirst).mockResolvedValue({
      id: "streamer_1",
      donationEnabled: true,
    } as never);
    vi.mocked(xenditAdapter.createPayment).mockRejectedValue(new Error("Xendit API error"));

    await expect(createDonation(validInput, null)).rejects.toThrow("Xendit API error");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sets supporterId when a session user id is provided", async () => {
    vi.mocked(prisma.streamerProfile.findFirst).mockResolvedValue({
      id: "streamer_1",
      donationEnabled: true,
    } as never);
    vi.mocked(xenditAdapter.createPayment).mockResolvedValue({
      providerReference: "ps-abc123",
      redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123",
      rawResponse: {},
    });

    const tx = fakeTx();
    vi.mocked(prisma.$transaction).mockImplementation(
      (cb: unknown) => (cb as (tx: unknown) => unknown)(tx) as never,
    );

    await createDonation(validInput, "user_1");

    expect(tx.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ supporterId: "user_1" }) }),
    );
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- src/features/donations/create-donation.test.ts`
Expected: FAIL — `create-donation.ts` does not exist yet.

- [ ] **Step 7: Write the orchestration function**

Create `src/features/donations/create-donation.ts`:

```ts
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";
import { env } from "@/lib/env";
import { xenditAdapter } from "@/lib/payments/xendit/adapter";

import type { DonationInput } from "./schema";

/**
 * Looks up the streamer, calls Xendit to create the checkout session, and
 * only writes to the database if that succeeds — Donation + Payment are
 * created together in one transaction, after Xendit has already
 * responded. This ordering matters: if the Xendit call throws, nothing
 * has been written at all, so there's never an orphaned PENDING row from
 * a failed payment-provider call (per
 * docs/superpowers/specs/2026-10-07-phase2-donation-design.md's error
 * handling section).
 *
 * Because the success-redirect URL needs a donation ID before the
 * Donation row exists (it's part of what we send TO Xendit), both the
 * Payment and Donation ids are generated here rather than left to
 * Prisma's default — then passed explicitly to `create()`.
 */
export async function createDonation(
  input: DonationInput,
  supporterId: string | null,
): Promise<{ donationId: string; redirectUrl: string }> {
  const streamer = await prisma.streamerProfile.findFirst({
    where: { user: { username: input.streamerUsername.toLowerCase() } },
  });

  if (!streamer) {
    throw new NotFoundError("Streamer not found.");
  }
  if (!streamer.donationEnabled) {
    throw new ConflictError("DONATIONS_DISABLED", "This streamer isn't accepting donations right now.");
  }

  const paymentId = crypto.randomUUID();
  const donationId = crypto.randomUUID();

  const { providerReference, redirectUrl, rawResponse } = await xenditAdapter.createPayment({
    amount: input.amount,
    currency: "IDR",
    reference: paymentId,
    description: `Donation to ${input.streamerUsername}`,
    successReturnUrl: `${env.NEXT_PUBLIC_APP_URL}/donations/${donationId}/thanks`,
  });

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        id: paymentId,
        provider: "XENDIT",
        providerReference,
        amount: input.amount,
        currency: "IDR",
        rawReferenceMetadata: rawResponse as object,
      },
    });
    await tx.donation.create({
      data: {
        id: donationId,
        streamerId: streamer.id,
        supporterId,
        amount: input.amount,
        currency: "IDR",
        displayName: input.displayName,
        message: input.message,
        anonymous: input.anonymous ?? false,
        paymentId,
      },
    });
  });

  return { donationId, redirectUrl };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test -- src/features/donations/create-donation.test.ts`
Expected: PASS (4 tests). The test's exact `tx.donation.create`/`tx.payment.create` mock call assertions must match this implementation's real call order and argument shapes — if a field is missing or ordered differently, fix the implementation (not the test) unless the test itself has a typo, since the test encodes the spec's required data shape.

- [ ] **Step 9: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/features/donations
git commit -m "Add donation schema and createDonation orchestration"
```

---

### Task 4: POST /api/donations route

**Files:**
- Create: `src/app/api/donations/route.ts`
- Create: `src/app/api/donations/route.test.ts`

**Interfaces:**
- Consumes: `donationSchema`, `createDonation` from `@/features/donations/*` (Task 3); `getCurrentSession` from `@/lib/auth/session`; `toErrorResponse`, `ValidationError` from `@/lib/api/errors`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/donations/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));
vi.mock("@/features/donations/create-donation", () => ({
  createDonation: vi.fn(),
}));

import { getCurrentSession } from "@/lib/auth/session";
import { createDonation } from "@/features/donations/create-donation";
import { NotFoundError } from "@/lib/api/errors";

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeRequest(body: unknown) {
  return new Request("http://localhost/api/donations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  streamerUsername: "teststreamer",
  amount: 50000,
  displayName: "Supporter",
};

describe("POST /api/donations", () => {
  it("creates a donation for a guest (no session) and returns the redirect URL", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    vi.mocked(createDonation).mockResolvedValue({
      donationId: "donation_1",
      redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123",
    });

    const res = await POST(fakeRequest(validBody));

    expect(res.status).toBe(201);
    expect(createDonation).toHaveBeenCalledWith(validBody, null);
    const json = await res.json();
    expect(json).toEqual({ redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123" });
  });

  it("passes the session's user id as supporterId when logged in", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({ user: { id: "user_1" } } as never);
    vi.mocked(createDonation).mockResolvedValue({
      donationId: "donation_1",
      redirectUrl: "https://checkout.xendit.co/sessions/ps-abc123",
    });

    await POST(fakeRequest(validBody));

    expect(createDonation).toHaveBeenCalledWith(validBody, "user_1");
  });

  it("returns 400 for an invalid body", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    const res = await POST(fakeRequest({ ...validBody, amount: -5 }));

    expect(res.status).toBe(400);
    expect(createDonation).not.toHaveBeenCalled();
  });

  it("returns 404 when createDonation throws NotFoundError", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    vi.mocked(createDonation).mockRejectedValue(new NotFoundError("Streamer not found."));

    const res = await POST(fakeRequest(validBody));

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/app/api/donations/route.test.ts`
Expected: FAIL — `route.ts` does not exist yet.

- [ ] **Step 3: Write the route**

Create `src/app/api/donations/route.ts`:

```ts
import { toErrorResponse, ValidationError } from "@/lib/api/errors";
import { getCurrentSession } from "@/lib/auth/session";
import { createDonation } from "@/features/donations/create-donation";
import { donationSchema } from "@/features/donations/schema";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    const body = await request.json();
    const parsed = donationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const { redirectUrl } = await createDonation(parsed.data, session?.user.id ?? null);
    return Response.json({ redirectUrl }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/app/api/donations/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all pass, 0 lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/donations
git commit -m "Add POST /api/donations route"
```

---

### Task 5: POST /api/webhooks/payment route

**Files:**
- Create: `src/app/api/webhooks/payment/route.ts`
- Create: `src/app/api/webhooks/payment/route.test.ts`

**Interfaces:**
- Consumes: `xenditAdapter` from `@/lib/payments/xendit/adapter` (Task 2); `prisma` from `@/lib/db/client`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/webhooks/payment/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/payments/xendit/adapter", () => ({
  xenditAdapter: {
    verifyWebhookSignature: vi.fn(),
    parseWebhookEvent: vi.fn(),
  },
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    payment: { findUnique: vi.fn(), update: vi.fn() },
    donation: { update: vi.fn() },
  },
}));

import { xenditAdapter } from "@/lib/payments/xendit/adapter";
import { prisma } from "@/lib/db/client";

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeRequest(body: string, token: string | null) {
  const headers = new Headers();
  if (token !== null) headers.set("x-callback-token", token);
  return new Request("http://localhost/api/webhooks/payment", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/webhooks/payment", () => {
  it("returns 401 when the signature is invalid", async () => {
    vi.mocked(xenditAdapter.verifyWebhookSignature).mockReturnValue(false);

    const res = await POST(fakeRequest("{}", "bad-token"));

    expect(res.status).toBe(401);
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when the payload can't be parsed into a known event", async () => {
    vi.mocked(xenditAdapter.verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(xenditAdapter.parseWebhookEvent).mockReturnValue(null);

    const res = await POST(fakeRequest("not json", "good-token"));

    expect(res.status).toBe(400);
  });

  it("returns 200 no-op when the referenced Payment doesn't exist", async () => {
    vi.mocked(xenditAdapter.verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(xenditAdapter.parseWebhookEvent).mockReturnValue({
      reference: "payment_1",
      status: "PAID",
      rawPayload: {},
    });
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    const res = await POST(fakeRequest("{}", "good-token"));

    expect(res.status).toBe(200);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("updates Payment and Donation to COMPLETED on a PAID event", async () => {
    vi.mocked(xenditAdapter.verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(xenditAdapter.parseWebhookEvent).mockReturnValue({
      reference: "payment_1",
      status: "PAID",
      rawPayload: {},
    });
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: "payment_1",
      status: "PENDING",
      donation: { id: "donation_1" },
    } as never);

    const res = await POST(fakeRequest("{}", "good-token"));

    expect(res.status).toBe(200);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment_1" },
      data: { status: "PAID" },
    });
    expect(prisma.donation.update).toHaveBeenCalledWith({
      where: { id: "donation_1" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    // No-op hook points for Phase 3 (realtime), 4 (XP), 5 (media) — not
    // built yet, so nothing else should have been called.
  });

  it("updates Payment and Donation to FAILED on a FAILED event", async () => {
    vi.mocked(xenditAdapter.verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(xenditAdapter.parseWebhookEvent).mockReturnValue({
      reference: "payment_1",
      status: "FAILED",
      rawPayload: {},
    });
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: "payment_1",
      status: "PENDING",
      donation: { id: "donation_1" },
    } as never);

    const res = await POST(fakeRequest("{}", "good-token"));

    expect(res.status).toBe(200);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment_1" },
      data: { status: "FAILED" },
    });
    expect(prisma.donation.update).toHaveBeenCalledWith({
      where: { id: "donation_1" },
      data: { status: "FAILED" },
    });
  });

  it("is idempotent: a replayed event for an already-PAID Payment is a no-op", async () => {
    vi.mocked(xenditAdapter.verifyWebhookSignature).mockReturnValue(true);
    vi.mocked(xenditAdapter.parseWebhookEvent).mockReturnValue({
      reference: "payment_1",
      status: "PAID",
      rawPayload: {},
    });
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: "payment_1",
      status: "PAID",
      donation: { id: "donation_1" },
    } as never);

    const res = await POST(fakeRequest("{}", "good-token"));

    expect(res.status).toBe(200);
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.donation.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/app/api/webhooks/payment/route.test.ts`
Expected: FAIL — `route.ts` does not exist yet.

- [ ] **Step 3: Write the route**

Create `src/app/api/webhooks/payment/route.ts`:

```ts
import { xenditAdapter } from "@/lib/payments/xendit/adapter";
import { prisma } from "@/lib/db/client";

const TERMINAL_STATUSES = new Set(["PAID", "FAILED", "EXPIRED", "REFUNDED", "DISPUTED"]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-callback-token");

  if (!xenditAdapter.verifyWebhookSignature(signatureHeader)) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Invalid signature." } }, { status: 401 });
  }

  const event = xenditAdapter.parseWebhookEvent(rawBody);
  if (!event) {
    return Response.json({ error: { code: "INVALID_REQUEST", message: "Unrecognized payload." } }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: event.reference },
    include: { donation: true },
  });

  // Unknown reference — nothing to update. Still 200: Xendit should not
  // retry a webhook we can't act on, and this isn't the caller's fault.
  if (!payment) {
    return Response.json({ ok: true });
  }

  // Idempotency: a replayed webhook for an already-terminal Payment is a
  // safe no-op — never double-apply state (docs/CLAUDE.md rule 12).
  if (TERMINAL_STATUSES.has(payment.status)) {
    return Response.json({ ok: true });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: event.status },
  });

  if (payment.donation) {
    if (event.status === "PAID") {
      await prisma.donation.update({
        where: { id: payment.donation.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    } else {
      await prisma.donation.update({
        where: { id: payment.donation.id },
        data: { status: "FAILED" },
      });
    }
  }

  // No-op hook points — intentionally not implemented yet:
  // - XP award (Phase 4, docs/ROADMAP.md): would award XP to
  //   payment.donation.supporterId once, keyed by donation id.
  // - Media queue enqueue (Phase 5): would enqueue payment.donation.media
  //   for streamer moderation if a MediaDonation is attached.
  // - Realtime donation event (Phase 3/OBS): would push an alert event to
  //   the streamer's overlay.

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/app/api/webhooks/payment/route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all pass, 0 lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks
git commit -m "Add POST /api/webhooks/payment with idempotent status handling"
```

---

### Task 6: Donation history routes

**Files:**
- Create: `src/app/api/me/donations/route.ts`
- Create: `src/app/api/streamers/[username]/donations/route.ts`
- Create: `src/app/api/streamers/[username]/donations/route.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `requireRole`, `requireOwnership` from `@/lib/auth/session`; `toErrorResponse`, `NotFoundError` from `@/lib/api/errors`; `prisma` from `@/lib/db/client`.

- [ ] **Step 1: Write GET /api/me/donations**

Create `src/app/api/me/donations/route.ts`:

```ts
import { toErrorResponse } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const session = await requireSession();

    const donations = await prisma.donation.findMany({
      where: { supporterId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        message: true,
        anonymous: true,
        status: true,
        createdAt: true,
        completedAt: true,
        streamer: { select: { user: { select: { username: true } } } },
      },
    });

    return Response.json({ donations });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 2: Write the failing tests for the streamer donations route**

Create `src/app/api/streamers/[username]/donations/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    donation: { findMany: vi.fn() },
  },
}));

import { requireSession, requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeRequest() {
  return new Request("http://localhost/api/streamers/teststreamer/donations");
}

describe("GET /api/streamers/[username]/donations", () => {
  it("returns 404 when the username doesn't exist", async () => {
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user_1", role: "STREAMER" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await GET(fakeRequest(), { params: Promise.resolve({ username: "teststreamer" }) });

    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller doesn't own this streamer account", async () => {
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user_1", role: "STREAMER" } } as never);
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_2",
      streamerProfile: { id: "streamer_2" },
    } as never);

    const res = await GET(fakeRequest(), { params: Promise.resolve({ username: "teststreamer" }) });

    expect(res.status).toBe(403);
    expect(prisma.donation.findMany).not.toHaveBeenCalled();
  });

  it("returns the streamer's own donations", async () => {
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user_1", role: "STREAMER" } } as never);
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      streamerProfile: { id: "streamer_1" },
    } as never);
    vi.mocked(prisma.donation.findMany).mockResolvedValue([{ id: "donation_1" }] as never);

    const res = await GET(fakeRequest(), { params: Promise.resolve({ username: "teststreamer" }) });

    expect(res.status).toBe(200);
    expect(prisma.donation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { streamerId: "streamer_1" } }),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/app/api/streamers/[username]/donations/route.test.ts`
Expected: FAIL — `route.ts` does not exist yet.

- [ ] **Step 4: Write the streamer donations route**

Create `src/app/api/streamers/[username]/donations/route.ts`:

```ts
import { ForbiddenError, NotFoundError, toErrorResponse } from "@/lib/api/errors";
import { requireRole, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const session = await requireSession();
    requireRole(session, "STREAMER");

    const { username } = await params;
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { streamerProfile: true },
    });

    if (!user || !user.streamerProfile) {
      throw new NotFoundError();
    }
    if (user.id !== session.user.id) {
      throw new ForbiddenError();
    }

    const donations = await prisma.donation.findMany({
      where: { streamerId: user.streamerProfile.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        displayName: true,
        message: true,
        anonymous: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return Response.json({ donations });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/app/api/streamers/[username]/donations/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Full test run and typecheck**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all pass, 0 lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/me/donations src/app/api/streamers/[username]/donations
git commit -m "Add donation history routes (own + streamer-private)"
```

---

### Task 7: UI — Donate page and thanks page

**Files:**
- Create: `src/app/[username]/donate/page.tsx`
- Create: `src/app/[username]/donate/donate-form.tsx`
- Create: `src/app/donations/[id]/thanks/page.tsx`

**Interfaces:**
- Consumes: `POST /api/donations` (Task 4); `prisma` from `@/lib/db/client`.

- [ ] **Step 1: Write the donate page (server component)**

Create `src/app/[username]/donate/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/client";

import { DonateForm } from "./donate-form";

// Reads donationEnabled live — never prerenderable/cacheable (same
// reasoning as src/app/[username]/page.tsx and src/app/me/page.tsx).
export const instant = false;

export default async function DonatePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: true, streamerProfile: true },
  });

  if (!user || user.role !== "STREAMER" || !user.streamerProfile || !user.profile?.publicVisibility) {
    notFound();
  }

  if (!user.streamerProfile.donationEnabled) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Donations not available</h1>
        <p className="max-w-md text-sm text-foreground/70">
          {user.profile.displayName} isn&apos;t accepting donations right now.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Support {user.profile.displayName}</h1>
        <DonateForm streamerUsername={user.username} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the donate form (client component)**

Create `src/app/[username]/donate/donate-form.tsx`:

```tsx
"use client";

import { useState } from "react";

export function DonateForm({ streamerUsername }: { streamerUsername: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const body = {
      streamerUsername,
      amount: Number(form.get("amount")),
      displayName: String(form.get("displayName")),
      message: String(form.get("message") ?? "") || undefined,
      anonymous: form.get("anonymous") === "on",
    };

    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    const { redirectUrl } = await res.json();
    window.location.href = redirectUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Amount (IDR)
        <input
          name="amount"
          type="number"
          min={1}
          step={1}
          required
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          name="displayName"
          type="text"
          required
          maxLength={60}
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Message (optional)
        <textarea
          name="message"
          maxLength={500}
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="anonymous" />
        Donate anonymously
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b] disabled:opacity-50"
      >
        {loading ? "Redirecting…" : "Donate"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write the thanks page**

Create `src/app/donations/[id]/thanks/page.tsx`:

```tsx
export default function DonationThanksPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Thank you!</h1>
      <p className="max-w-md text-sm text-foreground/70">
        We&apos;re confirming your payment — it&apos;ll show up shortly.
      </p>
    </main>
  );
}
```

(This page doesn't need the donation `id` param at all — it's the same
generic message regardless, per the spec's "no polling" decision. The `[id]`
segment exists only so the URL Xendit redirects to is unique per donation,
which is harmless even though the page ignores it.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification (adapted — no live Xendit sandbox yet)**

Run: `npm run dev > /tmp/dev-donate.log 2>&1 &`. Register a STREAMER test account, verify it in the DB, enable donations via `PATCH /api/me/profile` with `{"donationEnabled": true}` (using a session cookie, same pattern as Phase 1's manual checks). Then:
```bash
curl -s http://localhost:3000/<username>/donate
```
Expected: 200, HTML contains the donation form fields (amount/displayName/message/anonymous).

Submit a real `POST /api/donations` via curl with that streamer's username:
```bash
curl -s -X POST http://localhost:3000/api/donations -H "Content-Type: application/json" \
  -d '{"streamerUsername":"<username>","amount":50000,"displayName":"Test Supporter"}'
```
Expected: without real `XENDIT_SECRET_KEY`/`XENDIT_WEBHOOK_TOKEN` values from an actual Xendit sandbox account, this call will fail at the `fetch` to `api.xendit.co` (since the dummy env values from `.env` aren't real credentials) — that's expected and fine for this task. Confirm the error surfaces as a clean `502`-style JSON error (per Task 3's error handling), not an unhandled crash, by checking the response body and status code. **Do not treat a failure here as a blocker** — full success-path verification against a real checkout is deferred to Task 8, once real Xendit sandbox keys are available.

Also confirm the disabled-donations path: toggle `donationEnabled` back to `false` via `PATCH /api/me/profile`, then `curl -s http://localhost:3000/<username>/donate` again — expect 200 with "Donations not available" in the body, not an error. Clean up test data and stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/app/[username]/donate src/app/donations
git commit -m "Add donate page and post-payment thanks page"
```

---

### Task 8: Final verification, docs, and wrap-up

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `README.md`

**Interfaces:** None — this task only verifies and documents.

- [ ] **Step 1: Full verification sweep**

Run, in order: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`. All must pass with zero errors.

- [ ] **Step 2: Note the Xendit sandbox verification gap explicitly**

This plan's automated tests mock Xendit entirely — no task in this plan has made a real call to Xendit's sandbox. **If real `XENDIT_SECRET_KEY`/`XENDIT_WEBHOOK_TOKEN` sandbox credentials are available by this point**, do the following real end-to-end check and record the result in your report:
1. Put real sandbox credentials in `.env`.
2. Register+verify a STREAMER test account, enable donations.
3. Submit a real donation via the `/[username]/donate` page's underlying API (`curl -X POST /api/donations ...`) and confirm a real `redirectUrl` pointing at `https://checkout.xendit.co/...` comes back.
4. Visit that URL and complete a test payment using Xendit's documented sandbox test payment methods/instruments.
5. Use Xendit's dashboard webhook simulator (or wait for the real webhook) to confirm `POST /api/webhooks/payment` is reachable and correctly flips `Payment`/`Donation` to `COMPLETED` — check the actual webhook payload Xendit sends and compare it against `src/lib/payments/xendit/adapter.ts`'s `parseWebhookEvent` assumptions (event name, `data.reference_id`/`data.status` field paths). **If the real payload shape differs, fix `parseWebhookEvent` and its test fixtures in Task 2 now** — this is the one piece of this plan that was explicitly built against unconfirmed documentation and flagged for this exact checkpoint.

**If sandbox credentials are NOT yet available**, skip this step and clearly record in your report that Xendit's real webhook payload shape remains unverified — this is a known, explicitly-flagged gap, not a silently skipped requirement.

- [ ] **Step 3: Log the Phase 2 decisions in docs/DECISIONS.md**

Append to `docs/DECISIONS.md` (before the `## Template` section):

```md
## 2026-10-07 — Phase 2: Xendit adopted (Payment Session API)
### Context
Phase 0/1 left the payment provider choice open. The user compared Xendit, Midtrans, and a friend's gateway ("Kipay"); Kipay was ruled out because its webhook signature verification isn't publicly documented, a hard requirement per docs/SECURITY.md.

### Decision
Adopt Xendit, using the Payment Session API (mode: PAYMENT_LINK) called directly via fetch rather than the xendit-node SDK — the SDK's README doesn't cover this API yet. Webhook verification uses Xendit's documented x-callback-token static-secret header (not HMAC, which a different/older Xendit product uses). Guest donations are allowed; IDR only; no minimum donation amount; donation history is private to the streamer.

### Alternatives
- Midtrans — slower account activation (7-14 working days vs Xendit's 1-3 days / Instant Activation for money-in).
- Kipay — rejected: webhook signature verification undocumented.
- xendit-node SDK — would have been preferred for maintainability, but doesn't yet support Payment Session per its README.

### Reason
Xendit's documentation and activation timeline were both materially better for a solo-dev MVP. Direct REST calls avoid depending on unconfirmed SDK support for a feature this core.

### Consequences
- New env vars: XENDIT_SECRET_KEY, XENDIT_WEBHOOK_TOKEN.
- src/lib/payments/xendit/adapter.ts's webhook payload parsing was built against the best-documented-but-unconfirmed Xendit webhook shape (payment.capture/payment.failure events) — flagged for verification once real sandbox access exists (see this phase's implementation plan, Task 8).
- No Prisma schema changes — Donation/Payment/DonationStatus/PaymentStatus from Phase 0 already matched this flow.
```

- [ ] **Step 4: Update docs/ROADMAP.md**

Edit the Phase 2 checklist to reflect what's done:

```md
## Phase 2 — Donation
- [x] Donation page
- [x] Payment creation
- [x] Webhook
- [x] Idempotency
- [x] Transaction states
- [x] Donation history
```

- [ ] **Step 5: Update README.md**

Add a short "Donations (Phase 2)" section after the existing "Identity (Phase 1)" section:

```md
## Donations (Phase 2)

Donations are processed via [Xendit](https://xendit.co)'s Payment Session
API (called directly via `fetch`, no SDK — see `src/lib/payments/xendit/`).
Guest donations are allowed; no KOLU account required. Set
`XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_TOKEN` in `.env` (from your Xendit
dashboard's sandbox API keys and webhook verification token) to test the
real checkout flow locally.
```

- [ ] **Step 6: Final git status check**

Run: `git status --porcelain=v1 -uall`
Expected: no untracked `.env`, no `node_modules`/`.next`/`.claude/worktrees` listed.

- [ ] **Step 7: Commit**

```bash
git add docs/DECISIONS.md docs/ROADMAP.md README.md
git commit -m "Document Phase 2 (Donation) decisions and update ROADMAP/README"
```
