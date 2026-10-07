import { describe, expect, it } from "vitest";

import { tiktokAdapter } from "./index";

describe("tiktokAdapter.canHandle", () => {
  it("accepts tiktok.com", () => {
    expect(
      tiktokAdapter.canHandle(new URL("https://www.tiktok.com/@user/video/7123456789012345678")),
    ).toBe(true);
  });

  it("rejects an unrelated host", () => {
    expect(tiktokAdapter.canHandle(new URL("https://evil.com/video/123"))).toBe(false);
  });
});

describe("tiktokAdapter.parse", () => {
  it("extracts the video id from a full-form URL", () => {
    const result = tiktokAdapter.parse(
      new URL("https://www.tiktok.com/@user/video/7123456789012345678"),
    );
    expect(result?.contentId).toBe("7123456789012345678");
  });

  it("returns null for a short share link (no safe way to resolve without a redirect fetch)", () => {
    const result = tiktokAdapter.parse(new URL("https://vm.tiktok.com/ZMabc123/"));
    expect(result).toBeNull();
  });

  it("returns null for a URL it cannot handle", () => {
    const result = tiktokAdapter.parse(new URL("https://evil.com/video/7123456789012345678"));
    expect(result).toBeNull();
  });
});

describe("tiktokAdapter.getPlaybackDescriptor", () => {
  it("returns a PREVIEW descriptor", () => {
    const reference = tiktokAdapter.parse(
      new URL("https://www.tiktok.com/@user/video/7123456789012345678"),
    )!;
    expect(tiktokAdapter.getPlaybackDescriptor(reference)).toEqual({
      provider: "TIKTOK",
      contentId: "7123456789012345678",
      mode: "PREVIEW",
    });
  });
});
