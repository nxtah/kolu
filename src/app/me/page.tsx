import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

import { ProfileForm } from "./profile-form";

// Reads the session cookie and the current user's profile on every request —
// inherently per-visitor and never prerenderable/cacheable.
export const instant = false;

export default async function MePage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) {
    // Should never happen — every user gets a Profile at registration
    // (src/features/auth/create-role-profile.ts).
    throw new Error("Profile not found for authenticated user");
  }

  const streamerProfile =
    session.user.role === "STREAMER"
      ? await prisma.streamerProfile.findUnique({ where: { userId: session.user.id } })
      : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <ProfileForm
          initialDisplayName={profile.displayName}
          initialBio={profile.bio ?? ""}
          initialPublicVisibility={profile.publicVisibility}
          streamerFields={
            streamerProfile
              ? {
                  initialBannerUrl: streamerProfile.bannerUrl ?? "",
                  initialDescription: streamerProfile.description ?? "",
                  initialDonationEnabled: streamerProfile.donationEnabled,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
