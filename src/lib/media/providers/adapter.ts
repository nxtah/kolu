import type {
  MediaMetadata,
  MediaProvider,
  ParsedMediaReference,
  PlaybackDescriptor,
} from "@/types/media";

/**
 * Contract every media provider must implement. The exact shape can evolve
 * during later phases, but the separation between "donation core" and
 * "provider adapter" must remain (docs/ARCHITECTURE.md).
 *
 * `resolveMetadata` is intentionally not implemented by any adapter in this
 * bootstrap phase — fetching real provider metadata is out of scope until
 * Phase 5 (Media Donation MVP+, see docs/ROADMAP.md).
 */
export interface MediaProviderAdapter {
  readonly provider: MediaProvider;

  /** Whether this adapter recognizes the given URL as belonging to it. */
  canHandle(url: URL): boolean;

  /** Parses and normalizes a recognized URL into a safe content reference. */
  parse(url: URL): ParsedMediaReference | null;

  /** Resolves provider metadata (title/thumbnail/duration). Not implemented yet. */
  resolveMetadata(reference: ParsedMediaReference): Promise<MediaMetadata | null>;

  /** Returns the safe, structured playback descriptor for the overlay. */
  getPlaybackDescriptor(reference: ParsedMediaReference): PlaybackDescriptor;
}

export class NotImplementedError extends Error {
  constructor(provider: MediaProvider, method: string) {
    super(`${provider} adapter does not implement ${method} yet (bootstrap phase)`);
    this.name = "NotImplementedError";
  }
}
