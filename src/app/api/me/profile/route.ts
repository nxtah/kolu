import { z } from "zod";

import { toErrorResponse, ValidationError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  avatarUrl: z.string().trim().url().max(2048).optional(),
  bio: z.string().trim().max(500).optional(),
  publicVisibility: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    await prisma.profile.update({
      where: { userId: session.user.id },
      data: parsed.data,
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
