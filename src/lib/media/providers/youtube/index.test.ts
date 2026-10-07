import { describe, expect, it } from "vitest";

import { youtubeAdapter } from "./index";

describe("youtubeAdapter.canHandle", () => {
  it("accepts youtube.com", () => {
    expect(youtubeAdapter.canHandle(new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))).toBe(
      true,
    );
  });

  it("accepts youtu.be", () => {
    expect(youtubeAdapter.canHandle(new URL("https://youtu.be/dQw4w9WgXcQ"))).toBe(true);
  });

  it("rejects an unrelated host", () => {
    expect(youtubeAdapter.canHandle(new URL("https://evil.com/dQw4w9WgXcQ"))).toBe(false);
  });

  it("rejects a lookalike host", () => {
    expect(youtubeAdapter.canHandle(new URL("https://notyoutube.com/watch?v=abc"))).toBe(false);
  });
});

describe("youtubeAdapter.parse", () => {
  it("extracts the video id from a watch URL", () => {
    const result = youtubeAdapter.parse(
      new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    );
    expect(result?.contentId).toBe("dQw4w9WgXcQ");
    expect(result?.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("extracts the video id from a youtu.be share URL", () => {
    const result = youtubeAdapter.parse(new URL("https://youtu.be/dQw4w9WgXcQ"));
    expect(result?.contentId).toBe("dQw4w9WgXcQ");
  });

  it("extracts the video id from a shorts URL", () => {
    const result = youtubeAdapter.parse(
      new URL("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    );
    expect(result?.contentId).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a malformed video id", () => {
    const result = youtubeAdapter.parse(
      new URL("https://www.youtube.com/watch?v=short"),
    );
    expect(result).toBeNull();
  });

  it("returns null for a URL it cannot handle", () => {
    const result = youtubeAdapter.parse(new URL("https://evil.com/watch?v=dQw4w9WgXcQ"));
    expect(result).toBeNull();
  });
});

describe("youtubeAdapter.getPlaybackDescriptor", () => {
  it("returns an EMBED descriptor", () => {
    const reference = youtubeAdapter.parse(
      new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    )!;
    expect(youtubeAdapter.getPlaybackDescriptor(reference)).toEqual({
      provider: "YOUTUBE",
      contentId: "dQw4w9WgXcQ",
      mode: "EMBED",
    });
  });
});
