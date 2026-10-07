"use client";

import { useState } from "react";

interface StreamerFields {
  initialBannerUrl: string;
  initialDescription: string;
  initialDonationEnabled: boolean;
}

export function ProfileForm({
  initialDisplayName,
  initialBio,
  initialPublicVisibility,
  streamerFields,
}: {
  initialDisplayName: string;
  initialBio: string;
  initialPublicVisibility: boolean;
  streamerFields: StreamerFields | null;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      displayName: String(form.get("displayName")),
      bio: String(form.get("bio")),
      publicVisibility: form.get("publicVisibility") === "on",
    };

    if (streamerFields) {
      const bannerUrl = String(form.get("bannerUrl") ?? "").trim();
      if (bannerUrl) {
        body.bannerUrl = bannerUrl;
      }
      body.description = String(form.get("description") ?? "");
      body.donationEnabled = form.get("donationEnabled") === "on";
    }

    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
          required
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Bio
        <textarea
          name="bio"
          defaultValue={initialBio}
          maxLength={500}
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publicVisibility" defaultChecked={initialPublicVisibility} />
        Make my profile public
      </label>

      {streamerFields && (
        <>
          <hr className="border-foreground/10" />
          <p className="text-sm font-medium text-foreground/80">Streamer settings</p>

          <label className="flex flex-col gap-1 text-sm">
            Banner URL
            <input
              name="bannerUrl"
              type="url"
              defaultValue={streamerFields.initialBannerUrl}
              maxLength={2048}
              className="rounded border border-foreground/20 bg-transparent px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Description
            <textarea
              name="description"
              defaultValue={streamerFields.initialDescription}
              maxLength={1000}
              className="rounded border border-foreground/20 bg-transparent px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="donationEnabled"
              defaultChecked={streamerFields.initialDonationEnabled}
            />
            Enable donations on my page
          </label>
        </>
      )}

      {status === "saved" && <p className="text-sm text-brand-accent">Saved.</p>}
      {status === "error" && <p className="text-sm text-red-400">Could not save.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b] disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
