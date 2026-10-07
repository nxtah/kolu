import { isAllowedHost } from "@/lib/security/url";
import type {
  MediaMetadata,
  ParsedMediaReference,
  PlaybackDescriptor,
} from "@/types/media";

import { NotImplementedError, type MediaProviderAdapter } from "../adapter";

const ALLOWED_HOSTS = ["tiktok.com"] as const;

// Matches the numeric video ID in full-form URLs like
// https://www.tiktok.com/@user/video/7123456789012345678
const VIDEO_PATH_PATTERN = /\/video\/(\d{5,25})/;

function extractVideoId(url: URL): string | null {
  const match = url.pathname.match(VIDEO_PATH_PATTERN);
  return match ? match[1] : null;
}

export const tiktokAdapter: MediaProviderAdapter = {
  provider: "TIKTOK",

  canHandle(url) {
    return isAllowedHost(url, ALLOWED_HOSTS);
  },

  parse(url) {
    if (!this.canHandle(url)) return null;

    // Short share links (vm.tiktok.com/vt.tiktok.com) only resolve to a
    // video ID via an HTTP redirect, which would require the server to
    // follow an arbitrary short link — forbidden by docs/SECURITY.md. Treat
    // these as unsupported for now; only full-form /video/<id> URLs parse.
    const contentId = extractVideoId(url);
    if (!contentId) return null;

    return {
      provider: "TIKTOK",
      contentType: "VIDEO",
      contentId,
      normalizedUrl: `https://www.tiktok.com/video/${contentId}`,
    };
  },

  async resolveMetadata(_reference: ParsedMediaReference): Promise<MediaMetadata | null> {
    throw new NotImplementedError("TIKTOK", "resolveMetadata");
  },

  getPlaybackDescriptor(reference): PlaybackDescriptor {
    return {
      provider: "TIKTOK",
      contentId: reference.contentId,
      // TikTok's embed support is less consistent than YouTube's — default
      // to PREVIEW; docs/MEDIA_DONATION.md allows either EMBED or PREVIEW
      // and calls for graceful degradation when direct embedding isn't safe.
      mode: "PREVIEW",
    };
  },
};
