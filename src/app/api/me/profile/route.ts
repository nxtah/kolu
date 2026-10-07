import { z } from "zod";

import { toErrorResponse, ValidationError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  avatarUrl: z.string().trim().url().max(2048).optional(),
  bio: z.string().trim().max(500).optional(),
  publicVisibility: z.boolean().optional(),
  // Streamer-only fields — see the role check below. Accepting them in the
  // same schema keeps one endpoint for profile editing; the role check is
  // what actually enforces who can set them (never the presence of the
  // field in the request body).
  bannerUrl: z.string().trim().url().max(2048).optional(),
  description: z.string().trim().max(1000).optional(),
  donationEnabled: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const { bannerUrl, description, donationEnabled, ...profileData } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId: session.user.id },
        data: profileData,
      });

      // Never trust the client's role — only a session whose own role is
      // STREAMER can ever touch StreamerProfile fields, regardless of what
      // the request body contains.
      const hasStreamerFields =
        bannerUrl !== undefined || description !== undefined || donationEnabled !== undefined;
      if (hasStreamerFields && session.user.role === "STREAMER") {
        await tx.streamerProfile.update({
          where: { userId: session.user.id },
          data: { bannerUrl, description, donationEnabled },
        });
      }
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
