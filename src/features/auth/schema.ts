import { z } from "zod";

// Top-level static routes (and the ADMIN role name) that a username must not
// collide with, since src/app/[username]/page.tsx is a catch-all dynamic
// route and Next.js always resolves static routes first — a colliding
// username would be permanently unreachable at its own profile URL.
export const RESERVED_USERNAMES = new Set([
  "login",
  "register",
  "me",
  "forgot-password",
  "reset-password",
  "verify-email",
  "resend-verification",
  "api",
  "admin",
]);

// Deliberately excludes ADMIN — registration can only create a SUPPORTER or
// STREAMER account. See src/lib/auth/server.ts for why the role additional
// field itself is also locked down server-side (input: false).
export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(60),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.")
    .refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()), {
      message: "That username is reserved.",
    }),
  role: z.enum(["SUPPORTER", "STREAMER"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
