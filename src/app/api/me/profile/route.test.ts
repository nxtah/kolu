import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: { $transaction: vi.fn() },
}));

import { UnauthorizedError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

import { PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeRequest(body: unknown) {
  return new Request("http://localhost/api/me/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function fakeTx() {
  return {
    profile: { update: vi.fn() },
    streamerProfile: { update: vi.fn() },
  };
}

describe("PATCH /api/me/profile", () => {
  it("updates the caller's own profile", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user_1", role: "SUPPORTER" },
    } as never);

    const tx = fakeTx();
    vi.mocked(prisma.$transaction).mockImplementation(
      (cb: unknown) => (cb as (tx: unknown) => unknown)(tx) as never,
    );

    const res = await PATCH(fakeRequest({ displayName: "New Name" }));

    expect(res.status).toBe(200);
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: { displayName: "New Name" },
    });
    expect(tx.streamerProfile.update).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthorizedError());

    const res = await PATCH(fakeRequest({ displayName: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user_1", role: "SUPPORTER" },
    } as never);

    const res = await PATCH(fakeRequest({ displayName: "" }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates StreamerProfile fields when the session role is STREAMER", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "streamer_1", role: "STREAMER" },
    } as never);

    const tx = fakeTx();
    vi.mocked(prisma.$transaction).mockImplementation(
      (cb: unknown) => (cb as (tx: unknown) => unknown)(tx) as never,
    );

    const res = await PATCH(
      fakeRequest({
        displayName: "Streamer Name",
        bannerUrl: "https://example.com/banner.png",
        description: "I stream games.",
        donationEnabled: true,
      }),
    );

    expect(res.status).toBe(200);
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { userId: "streamer_1" },
      data: { displayName: "Streamer Name" },
    });
    expect(tx.streamerProfile.update).toHaveBeenCalledWith({
      where: { userId: "streamer_1" },
      data: {
        bannerUrl: "https://example.com/banner.png",
        description: "I stream games.",
        donationEnabled: true,
      },
    });
  });

  it("ignores StreamerProfile fields when the session role is not STREAMER", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "supporter_1", role: "SUPPORTER" },
    } as never);

    const tx = fakeTx();
    vi.mocked(prisma.$transaction).mockImplementation(
      (cb: unknown) => (cb as (tx: unknown) => unknown)(tx) as never,
    );

    const res = await PATCH(
      fakeRequest({
        displayName: "Supporter Name",
        bannerUrl: "https://example.com/banner.png",
        donationEnabled: true,
      }),
    );

    expect(res.status).toBe(200);
    expect(tx.streamerProfile.update).not.toHaveBeenCalled();
  });
});
