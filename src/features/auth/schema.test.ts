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
