// Placeholder session contract only — no auth library is installed yet.
// docs/ARCHITECTURE.md leaves the choice between Better Auth and Auth.js
// open; docs/DECISIONS.md records that this bootstrap phase defers the
// choice to Phase 1 (Identity, see docs/ROADMAP.md). Code elsewhere can be
// written against this shape without depending on a concrete provider.

export interface Session {
  userId: string;
  role: "SUPPORTER" | "STREAMER" | "ADMIN";
}

/** Not implemented yet — throws until an auth provider is selected. */
export function getCurrentSession(): Session | null {
  throw new Error(
    "Auth provider not yet selected (see docs/DECISIONS.md). getCurrentSession() is a placeholder.",
  );
}
