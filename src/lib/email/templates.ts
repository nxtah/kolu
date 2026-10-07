import { sendEmail } from "./resend";

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await sendEmail(
    to,
    "Verify your KOLU email",
    `<p>Welcome to KOLU. Click the link below to verify your email address:</p>
     <p><a href="${url}">${url}</a></p>
     <p>If you didn't create a KOLU account, you can ignore this email.</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await sendEmail(
    to,
    "Reset your KOLU password",
    `<p>We received a request to reset your KOLU password. Click the link below to choose a new one:</p>
     <p><a href="${url}">${url}</a></p>
     <p>If you didn't request this, you can ignore this email.</p>`,
  );
}
