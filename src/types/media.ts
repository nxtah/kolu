// Shared types for the media-provider abstraction. Mirrors the conceptual
// shapes in docs/ARCHITECTURE.md and docs/MEDIA_DONATION.md. Kept provider-
// agnostic so new providers never require changes to the donation core.

export type MediaProvider = "YOUTUBE" | "TIKTOK" | "TWITCH" | "INSTAGRAM" | "X" | "OTHER";

export type MediaContentType = "VIDEO" | "CLIP" | "REEL";

export type PlaybackMode = "EMBED" | "PREVIEW";

/** Result of successfully parsing a URL for a specific provider. */
export interface ParsedMediaReference {
  provider: MediaProvider;
  contentType: MediaContentType;
  contentId: string;
  normalizedUrl: string;
}

/** Metadata resolved from the provider (title, thumbnail, duration). */
export interface MediaMetadata {
  title?: string;
  thumbnailUrl?: string;
  durationMs?: number;
}

/**
 * Safe, structured description of how the overlay should render this media.
 * Never raw HTML/iframe markup — the overlay chooses a trusted renderer
 * based on this descriptor (docs/ARCHITECTURE.md).
 */
export interface PlaybackDescriptor {
  provider: MediaProvider;
  contentId: string;
  mode: PlaybackMode;
}
