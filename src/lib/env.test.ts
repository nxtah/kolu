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
