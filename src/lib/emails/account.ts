import "server-only";

import { APP_NAME, appUrl, supportEmail } from "@/lib/env";
import { sendEmail } from "@/lib/email";

const sig = `${APP_NAME}\n${supportEmail()}`;

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    kind: "verify_email",
    subject: `Confirm your email for ${APP_NAME}`,
    text: `Hi ${name || "there"},\n\nConfirm your email address to finish setting up your ${APP_NAME} account. The link is valid for 24 hours.\n\n${url}\n\nIf you did not create an account, you can ignore this message.\n\n${sig}`,
    cta: { label: "Confirm email", url },
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    kind: "reset_password",
    subject: `Reset your ${APP_NAME} password`,
    text: `Someone asked to reset the password for this ${APP_NAME} account. If that was you, use the link below within 1 hour.\n\n${url}\n\nIf you did not ask for this, nothing changes and you can ignore this email.\n\n${sig}`,
    cta: { label: "Choose a new password", url },
  });
}

export async function sendInviteEmail(to: string, studioName: string, inviterName: string, token: string) {
  const url = `${appUrl()}/invite/${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    kind: "invite",
    subject: `${inviterName} invited you to ${studioName} on ${APP_NAME}`,
    text: `${inviterName} invited you to join ${studioName} on ${APP_NAME}. Accept the invitation to manage galleries and clients together. The link is valid for 7 days.\n\n${url}\n\n${sig}`,
    cta: { label: "Accept invitation", url },
  });
}

// Billing mail (trial, payment failed, cancellation, referrals) lives in emails/billing.ts.
