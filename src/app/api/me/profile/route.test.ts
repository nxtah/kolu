import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: { profile: { update: vi.fn() } },
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

describe("PATCH /api/me/profile", () => {
  it("updates the caller's own profile", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user_1" },
    } as never);
    vi.mocked(prisma.profile.update).mockResolvedValue({} as never);

    const res = await PATCH(fakeRequest({ displayName: "New Name" }));

    expect(res.status).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      data: { displayName: "New Name" },
    });
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthorizedError());

    const res = await PATCH(fakeRequest({ displayName: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user_1" } } as never);

    const res = await PATCH(fakeRequest({ displayName: "" }));
    expect(res.status).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
});
