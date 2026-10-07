import { auth } from "@/lib/auth/server";
import { ConflictError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";

import { createRoleProfile } from "./create-role-profile";
import { normalizeUsername, type RegisterInput } from "./schema";

interface BetterAuthErrorShape {
  body?: { code?: string };
}

function hasPrismaErrorCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === code;
}

/**
 * Creates a new account: Better Auth owns the credential/session tables;
 * role defaults to SUPPORTER there (input disabled, see
 * src/lib/auth/server.ts). This function then, in one transaction, elevates
 * the role to STREAMER if chosen and creates the matching Profile +
 * StreamerProfile/SupporterProfile — so a user is never left half-created.
 *
 * Error detection deliberately does NOT follow the "catch
 * USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" pattern you might expect. Our
 * Better Auth config sets emailAndPassword.requireEmailVerification: true,
 * which (per node_modules/better-auth/dist/api/routes/sign-up.mjs) makes
 * signUpEmail return a 200 with a *synthetic*, never-persisted user object
 * for a duplicate email instead of throwing — a deliberate timing-attack
 * mitigation that makes the duplicate case indistinguishable from a real
 * success at the signUpEmail call site. We detect it one layer down: our
 * own transaction references that fake id and fails because the row
 * doesn't exist (P2025 on the role update, P2003 on the profile's foreign
 * key when there's no role update to run first).
 *
 * A thrown error from signUpEmail at this point (after the duplicate-email
 * case is masked as above) means the actual row insert failed — in
 * practice that's the username's unique constraint on the users table,
 * which Better Auth wraps as an APIError with code FAILED_TO_CREATE_USER.
 */
export async function registerUser(input: RegisterInput): Promise<{ userId: string }> {
  const username = normalizeUsername(input.username);

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.displayName,
        username,
      },
    });
    userId = result.user.id;
  } catch (err) {
    const code = (err as BetterAuthErrorShape).body?.code;
    if (code === "FAILED_TO_CREATE_USER") {
      throw new ConflictError("USERNAME_TAKEN", "That username is taken.");
    }
    throw err;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (input.role === "STREAMER") {
        await tx.user.update({ where: { id: userId }, data: { role: "STREAMER" } });
      }
      await createRoleProfile(tx, userId, input.role, input.displayName);
    });
  } catch (err) {
    if (hasPrismaErrorCode(err, "P2025") || hasPrismaErrorCode(err, "P2003")) {
      throw new ConflictError("EMAIL_TAKEN", "That email is already registered.");
    }
    if (hasPrismaErrorCode(err, "P2002")) {
      throw new ConflictError("USERNAME_TAKEN", "That username is taken.");
    }
    throw err;
  }

  return { userId };
}
