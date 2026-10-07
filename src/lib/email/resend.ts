import { Resend } from "resend";

import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Sends an email via Resend if RESEND_API_KEY is configured; otherwise logs
 * it to the console. Never throws — email delivery failures must not block
 * the auth flow that triggered them (docs/superpowers/specs/2026-10-07-phase1-identity-design.md).
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`[email:dev-fallback] to=${to} subject="${subject}"\n${html}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    });
    if (error) {
      console.error("[email] Resend returned an error", error);
    }
  } catch (err) {
    console.error("[email] Failed to send email", err);
  }
}
