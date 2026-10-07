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
