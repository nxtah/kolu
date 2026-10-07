import { NotFoundError, toErrorResponse } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });

    if (!user || !user.profile || !user.profile.publicVisibility) {
      // Treat a private profile the same as a nonexistent one — never leak
      // whether a username exists to an unauthorized caller (docs/SECURITY.md).
      throw new NotFoundError();
    }

    return Response.json({
      username: user.username,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      bio: user.profile.bio,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
