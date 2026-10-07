import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/db/client";
import { env } from "@/lib/env";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email/templates";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    additionalFields: {
      // Chosen by the user at registration, written directly by our own
      // /api/register route (Task 6) — never trust this if it were settable
      // through Better Auth's public signUp API.
      username: {
        type: "string",
        required: true,
        input: true,
      },
      // Server-owned: input is disabled so the public signUp API can never
      // set a role (e.g. ADMIN) directly. Defaults every new account to
      // SUPPORTER; our own /api/register route (Task 6) elevates it to
      // STREAMER inside a server-controlled transaction when the user
      // chose that at registration (docs/SECURITY.md: never trust
      // client-provided role).
      role: {
        type: ["SUPPORTER", "STREAMER", "ADMIN"],
        required: false,
        defaultValue: "SUPPORTER",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      await sendVerificationEmail(user.email, url);
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
