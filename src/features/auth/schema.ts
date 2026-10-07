import { z } from "zod";

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
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
  role: z.enum(["SUPPORTER", "STREAMER"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
