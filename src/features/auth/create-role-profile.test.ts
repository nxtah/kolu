import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

import { createRoleProfile } from "./create-role-profile";

function fakeTx() {
  return {
    profile: { create: vi.fn() },
    streamerProfile: { create: vi.fn() },
    supporterProfile: { create: vi.fn() },
  } as unknown as Prisma.TransactionClient;
}

describe("createRoleProfile", () => {
  it("creates a Profile and a StreamerProfile for role STREAMER", async () => {
    const tx = fakeTx();
    await createRoleProfile(tx, "user_1", "STREAMER", "Test User");

    expect(tx.profile.create).toHaveBeenCalledWith({
      data: { userId: "user_1", displayName: "Test User" },
    });
    expect(tx.streamerProfile.create).toHaveBeenCalledWith({ data: { userId: "user_1" } });
    expect(tx.supporterProfile.create).not.toHaveBeenCalled();
  });

  it("creates a Profile and a SupporterProfile for role SUPPORTER", async () => {
    const tx = fakeTx();
    await createRoleProfile(tx, "user_2", "SUPPORTER", "Another User");

    expect(tx.profile.create).toHaveBeenCalledWith({
      data: { userId: "user_2", displayName: "Another User" },
    });
    expect(tx.supporterProfile.create).toHaveBeenCalledWith({ data: { userId: "user_2" } });
    expect(tx.streamerProfile.create).not.toHaveBeenCalled();
  });
});
