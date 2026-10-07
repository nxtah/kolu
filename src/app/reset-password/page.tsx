"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { authClient } from "@/lib/auth/client";

// Better Auth's request-password-reset email links to its own API endpoint
// (GET /api/auth/reset-password/:token), which validates the token and then
// redirects the browser here as `/reset-password?token=<token>` — a query
// param, not a path segment. useSearchParams() requires a Suspense boundary.
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));

    const { error: resetError } = await authClient.resetPassword({ newPassword, token });

    if (resetError) {
      setError(resetError.message ?? "Could not reset password. The link may have expired.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p className="max-w-md text-sm text-foreground/70">
          You can now{" "}
          <Link href="/login" className="text-brand-accent underline">
            log in
          </Link>{" "}
          with your new password.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>

        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b]"
        >
          Update password
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
