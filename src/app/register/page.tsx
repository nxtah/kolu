"use client";

import { useState } from "react";
import Link from "next/link";

type Role = "SUPPORTER" | "STREAMER";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const body = {
      email: form.get("email"),
      password: form.get("password"),
      displayName: form.get("displayName"),
      username: form.get("username"),
      role: form.get("role") as Role,
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Something went wrong.");
        return;
      }

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-md text-sm text-foreground/70">
          We sent a verification link to your email address. Verify it, then{" "}
          <Link href="/login" className="text-brand-accent underline">
            log in
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 text-foreground">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold">Create your KOLU account</h1>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            name="displayName"
            type="text"
            required
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Username
          <input
            name="username"
            type="text"
            required
            minLength={3}
            pattern="[a-zA-Z0-9_]+"
            className="rounded border border-foreground/20 bg-transparent px-3 py-2"
          />
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>I am a</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="SUPPORTER" defaultChecked />
            Supporter
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="STREAMER" />
            Streamer
          </label>
        </fieldset>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-[#0b0b0b] disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
