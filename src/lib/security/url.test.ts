import { describe, expect, it } from "vitest";

import { isAllowedHost, parseSafeUrl, UnsafeUrlError } from "./url";

describe("parseSafeUrl", () => {
  it("accepts a plain https URL", () => {
    const url = parseSafeUrl("https://www.youtube.com/watch?v=abc123");
    expect(url.hostname).toBe("www.youtube.com");
  });

  it("accepts a plain http URL", () => {
    const url = parseSafeUrl("http://example.com/path");
    expect(url.protocol).toBe("http:");
  });

  it("rejects javascript: scheme", () => {
    expect(() => parseSafeUrl("javascript:alert(1)")).toThrow(UnsafeUrlError);
  });

  it("rejects data: scheme", () => {
    expect(() => parseSafeUrl("data:text/html,<script>alert(1)</script>")).toThrow(
      UnsafeUrlError,
    );
  });

  it("rejects malformed input", () => {
    expect(() => parseSafeUrl("not a url")).toThrow(UnsafeUrlError);
  });
});

describe("isAllowedHost", () => {
  it("matches an exact host", () => {
    const url = new URL("https://youtube.com/watch?v=abc123");
    expect(isAllowedHost(url, ["youtube.com"])).toBe(true);
  });

  it("matches a subdomain of an allowed host", () => {
    const url = new URL("https://www.youtube.com/watch?v=abc123");
    expect(isAllowedHost(url, ["youtube.com"])).toBe(true);
  });

  it("rejects an unrelated host", () => {
    const url = new URL("https://evil.com/youtube.com");
    expect(isAllowedHost(url, ["youtube.com"])).toBe(false);
  });

  it("does not match a host that merely contains the allowed string", () => {
    const url = new URL("https://notyoutube.com/watch?v=abc123");
    expect(isAllowedHost(url, ["youtube.com"])).toBe(false);
  });
});
