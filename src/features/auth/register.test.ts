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

type TransactionCallback = Parameters<typeof prisma.$transaction>[0];

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
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: TransactionCallback) =>
      (cb as (tx: unknown) => unknown)(tx),
    );

    const result = await registerUser({ ...validInput, role: "STREAMER" });

    expect(auth.api.signUpEmail).toHaveBeenCalledWith({
      body: {
        email: "user@example.com",
        password: "password1234",
        name: "Test User",
        username: "test_user1",
        callbackURL: "/verify-email/success",
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
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: TransactionCallback) =>
      (cb as (tx: unknown) => unknown)(tx),
    );

    await registerUser(validInput);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(createRoleProfile).toHaveBeenCalledWith(tx, "user_2", "SUPPORTER", "Test User");
  });

  // NOTE on this fixture: Better Auth is configured with
  // `emailAndPassword.requireEmailVerification: true` (src/lib/auth/server.ts).
  // Per node_modules/better-auth/dist/api/routes/sign-up.mjs, that makes
  // `shouldReturnGenericDuplicateResponse` true, so signUpEmail does NOT
  // throw USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL for a duplicate email — it
  // returns a 200 with a *synthetic* user object carrying a freshly
  // generated id that was never written to the database (a timing-attack
  // mitigation: the response is deliberately indistinguishable from a real
  // success). We can't detect the duplicate from signUpEmail's return value
  // at all; the first place it becomes observable is our own transaction,
  // which references that fake id and fails because the row doesn't exist
  // (P2025 "record not found" on the role update, or P2003 "foreign key
  // constraint" on the profile insert when there's no role update to run).
  it("throws ConflictError when the post-signup transaction can't find the signed-up user (masked duplicate email)", async () => {
    vi.mocked(auth.api.signUpEmail).mockResolvedValue({
      user: { id: "user_fake" },
    } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("foreign key constraint failed"), { code: "P2003" }),
    );

    await expect(registerUser(validInput)).rejects.toThrow(ConflictError);
  });

  // NOTE on this fixture: since duplicate emails are masked (see above),
  // by the time signUpEmail actually attempts to insert a user row, the
  // email is known-new. A thrown error at that point (wrapped by Better
  // Auth as an APIError with code FAILED_TO_CREATE_USER, status 422 — see
  // the same sign-up.mjs) corresponds in practice to the username's unique
  // constraint on the users table being violated.
  it("throws ConflictError when Better Auth fails to create the user (e.g. username taken)", async () => {
    vi.mocked(auth.api.signUpEmail).mockRejectedValue(
      Object.assign(new Error("Failed to create user"), {
        body: { code: "FAILED_TO_CREATE_USER" },
      }),
    );

    await expect(registerUser(validInput)).rejects.toThrow(ConflictError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
