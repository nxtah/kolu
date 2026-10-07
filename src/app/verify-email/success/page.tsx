"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Better Auth's verification link points at its own API endpoint
// (GET /api/auth/verify-email?token=...&callbackURL=...), which validates
// the token server-side then redirects here. On success it's a bare
// redirect to callbackURL (no query params appended) — confirmed via
// node_modules/better-auth/dist/api/routes/email-verification.mjs
// (`throw ctx.redirect(ctx.query.callbackURL)`) and a live curl against the
// dev server. On failure (expired/invalid token, user not found) it instead
// redirects to `callbackURL` with `?error=<code>` appended
// (`appendQueryParams(callbackURL, { error: error.code })`), landing on this
// same page. Without reading that param we'd show "Email verified" even
// when verification failed, so this reads `error` and renders a failure
// state instead.
function VerifyEmailSuccessContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Verification failed</h1>
        <p className="max-w-md text-sm text-foreground/70">
          That verification link is invalid or has expired. You can{" "}
          <Link href="/resend-verification" className="text-brand-accent underline">
            request a new one
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Email verified</h1>
      <p className="max-w-md text-sm text-foreground/70">
        Your email is verified. You can now{" "}
        <Link href="/login" className="text-brand-accent underline">
          log in
        </Link>
        .
      </p>
    </main>
  );
}

export default function VerifyEmailSuccessPage() {
  return (
    <Suspense>
      <VerifyEmailSuccessContent />
    </Suspense>
  );
}
