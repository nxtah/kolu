import { isAllowedHost } from "@/lib/security/url";
import type {
  MediaMetadata,
  ParsedMediaReference,
  PlaybackDescriptor,
} from "@/types/media";

import { NotImplementedError, type MediaProviderAdapter } from "../adapter";

const ALLOWED_HOSTS = ["youtube.com", "youtu.be"] as const;

// Matches standard YouTube video IDs: 11 chars, URL-safe base64 alphabet.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function extractVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();

  // youtu.be/<id>
  if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
    const id = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const vParam = url.searchParams.get("v");
  if (vParam && VIDEO_ID_PATTERN.test(vParam)) {
    return vParam;
  }

  // youtube.com/shorts/<id> or youtube.com/embed/<id>
  const pathMatch = url.pathname.match(/^\/(shorts|embed)\/([A-Za-z0-9_-]{11})/);
  if (pathMatch) {
    return pathMatch[2];
  }

  return null;
}

export const youtubeAdapter: MediaProviderAdapter = {
  provider: "YOUTUBE",

  canHandle(url) {
    return isAllowedHost(url, ALLOWED_HOSTS);
  },

  parse(url) {
    if (!this.canHandle(url)) return null;

    const contentId = extractVideoId(url);
    if (!contentId) return null;

    return {
      provider: "YOUTUBE",
      contentType: "VIDEO",
      contentId,
      normalizedUrl: `https://www.youtube.com/watch?v=${contentId}`,
    };
  },

  async resolveMetadata(_reference: ParsedMediaReference): Promise<MediaMetadata | null> {
    throw new NotImplementedError("YOUTUBE", "resolveMetadata");
  },

  getPlaybackDescriptor(reference): PlaybackDescriptor {
    return {
      provider: "YOUTUBE",
      contentId: reference.contentId,
      mode: "EMBED",
    };
  },
};
