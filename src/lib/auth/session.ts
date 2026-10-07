import { headers } from "next/headers";

import { ForbiddenError, UnauthorizedError } from "@/lib/api/errors";

import { auth, type AuthSession } from "./server";

/** Reads the current Better Auth session, or null if there isn't one. */
export async function getCurrentSession(): Promise<AuthSession | null> {
  return auth.api.getSession({ headers: await headers() }) as Promise<AuthSession | null>;
}

/** Throws UnauthorizedError if there's no active session. */
export async function requireSession(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

/** Throws ForbiddenError if the session's role doesn't match. */
export function requireRole(
  session: AuthSession,
  role: "SUPPORTER" | "STREAMER" | "ADMIN",
): void {
  if (session.user.role !== role) {
    throw new ForbiddenError();
  }
}

/** Throws ForbiddenError unless the session user owns the given resource. */
export function requireOwnership(session: AuthSession, ownerUserId: string): void {
  if (session.user.id !== ownerUserId) {
    throw new ForbiddenError();
  }
}
