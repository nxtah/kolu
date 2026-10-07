import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("accepts a valid environment", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5433/db");
  });

  it("defaults NODE_ENV to development when unset", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() =>
      loadEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("throws when NEXT_PUBLIC_APP_URL is not a valid URL", () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5433/db",
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
