import type { Prisma } from "@prisma/client";

/**
 * Creates the Profile every user gets, plus exactly one of
 * StreamerProfile/SupporterProfile based on role. Must run inside the same
 * transaction as the role update on User (see register.ts) so a crash
 * partway through never leaves a user with no profile or two profiles.
 */
export async function createRoleProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  role: "SUPPORTER" | "STREAMER",
  displayName: string,
): Promise<void> {
  await tx.profile.create({ data: { userId, displayName } });

  if (role === "STREAMER") {
    await tx.streamerProfile.create({ data: { userId } });
  } else {
    await tx.supporterProfile.create({ data: { userId } });
  }
}
