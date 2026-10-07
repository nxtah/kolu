import { NotFoundError, toErrorResponse } from "@/lib/api/errors";
import { prisma } from "@/lib/db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true, streamerProfile: true },
    });

    if (
      !user ||
      user.role !== "STREAMER" ||
      !user.streamerProfile ||
      !user.profile ||
      !user.profile.publicVisibility
    ) {
      throw new NotFoundError();
    }

    return Response.json({
      username: user.username,
      displayName: user.profile.displayName,
      avatarUrl: user.profile.avatarUrl,
      bannerUrl: user.streamerProfile.bannerUrl,
      description: user.streamerProfile.description,
      donationEnabled: user.streamerProfile.donationEnabled,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
