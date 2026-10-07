import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/client";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    include: { profile: true, streamerProfile: true },
  });

  if (!user || !user.profile || !user.profile.publicVisibility) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">{user.profile.displayName}</h1>
      <p className="text-sm text-foreground/70">@{user.username}</p>
      {user.profile.bio && <p className="max-w-md text-sm">{user.profile.bio}</p>}
      {user.role === "STREAMER" && user.streamerProfile?.description && (
        <p className="max-w-md text-sm text-foreground/70">
          {user.streamerProfile.description}
        </p>
      )}
    </main>
  );
}
