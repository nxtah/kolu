"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email/success" });
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-md text-sm text-foreground/70">
          If that email is registered and not yet verified, we sent a new verification link.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Resend verification email</h1>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b]"
        >
          Resend email
        </button>
      </form>
    </main>
  );
}
