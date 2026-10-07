import { youtubeAdapter } from "./youtube";
import { tiktokAdapter } from "./tiktok";
import type { MediaProviderAdapter } from "./adapter";

// Only providers actually implemented by KOLU go here. docs/MEDIA_DONATION.md
// is explicit that the `OTHER` enum value must never become a selectable,
// playable provider — so there is deliberately no entry for it.
const PROVIDERS: readonly MediaProviderAdapter[] = [youtubeAdapter, tiktokAdapter];

/** Returns the adapter that recognizes this URL, or null if unsupported. */
export function detectProvider(url: URL): MediaProviderAdapter | null {
  return PROVIDERS.find((adapter) => adapter.canHandle(url)) ?? null;
}

export { youtubeAdapter, tiktokAdapter };
export type { MediaProviderAdapter } from "./adapter";
