import { describe, expect, it } from "vitest";

import { detectProvider } from "./index";

describe("detectProvider", () => {
  it("detects YouTube URLs", () => {
    const adapter = detectProvider(new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
    expect(adapter?.provider).toBe("YOUTUBE");
  });

  it("detects TikTok URLs", () => {
    const adapter = detectProvider(
      new URL("https://www.tiktok.com/@user/video/7123456789012345678"),
    );
    expect(adapter?.provider).toBe("TIKTOK");
  });

  it("returns null for an unsupported provider", () => {
    const adapter = detectProvider(new URL("https://www.instagram.com/reel/abc123"));
    expect(adapter).toBeNull();
  });
});
