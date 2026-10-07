import { describe, expect, it, vi } from "vitest";

vi.mock("./resend", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "./resend";
import { sendPasswordResetEmail, sendVerificationEmail } from "./templates";

describe("sendVerificationEmail", () => {
  it("sends an email containing the verification URL", async () => {
    await sendVerificationEmail("user@example.com", "https://kolu.test/verify?token=abc");

    expect(sendEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining("Verify"),
      expect.stringContaining("https://kolu.test/verify?token=abc"),
    );
  });
});

describe("sendPasswordResetEmail", () => {
  it("sends an email containing the reset URL", async () => {
    await sendPasswordResetEmail("user@example.com", "https://kolu.test/reset-password/abc");

    expect(sendEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining("Reset"),
      expect.stringContaining("https://kolu.test/reset-password/abc"),
    );
  });
});
