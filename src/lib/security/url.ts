// SSRF-safe URL handling for user-submitted media URLs (docs/SECURITY.md:
// "allowlist supported providers", "reject unsupported schemes", "do not
// fetch arbitrary user-provided URLs from the server"). This module never
// performs a network request — it only parses and validates strings.

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Parses a raw string into a URL, rejecting anything that isn't a plain
 * http(s) URL (e.g. `javascript:`, `file:`, `data:` schemes).
 */
export function parseSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${rawUrl}`);
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new UnsafeUrlError(`Unsupported URL scheme: ${url.protocol}`);
  }

  return url;
}

/**
 * Checks whether a URL's hostname is exactly one of the allowed hosts, or a
 * subdomain of one. Used by provider adapters to allowlist known hosts
 * (e.g. youtube.com, youtu.be) before treating a URL as that provider's.
 */
export function isAllowedHost(url: URL, allowedHosts: readonly string[]): boolean {
  const hostname = url.hostname.toLowerCase();
  return allowedHosts.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}
