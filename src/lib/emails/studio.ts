import "server-only";

import { sendEmail } from "@/lib/email";
import type { Studio } from "@/lib/types";

/** Emails a studio sends to its clients. From: "<Studio> via Proofroom", reply-to the studio. */

type StudioMail = Pick<Studio, "id" | "name" | "email">;

export async function sendGalleryReadyEmail(studio: StudioMail, input: {
  to: string;
  clientName: string;
  kind: "proof" | "final";
  url: string;
  accessCode: string | null;
  subject?: string;
  body?: string;
}) {
  const isProof = input.kind === "proof";
  const subject = input.subject ?? (isProof ? `Your proofs are ready` : `Your photos are ready`);
  const text =
    input.body ??
    `Hi ${input.clientName},\n\n${
      isProof
        ? "Your proofs are ready. Open the gallery, mark the ones you like as favorites, and leave a note on any photo if you want something changed."
        : "Your final photos are ready. You can download them one at a time or all at once."
    }\n\nGallery: ${input.url}${input.accessCode ? `\nAccess code: ${input.accessCode}` : ""}\n\n${studio.name}\n${studio.email}`;
  return sendEmail({
    to: input.to,
    subject,
    text,
    cta: { label: "Open gallery", url: input.url },
    replyTo: studio.email,
    fromName: studio.name,
    kind: isProof ? "gallery_proofs" : "gallery_final",
    studioId: studio.id,
  });
}

export async function sendPaymentLinkEmail(studio: StudioMail, input: { to: string; clientName: string; amount: string; title: string; url: string }) {
  return sendEmail({
    to: input.to,
    subject: `Payment for ${input.title}`,
    text: `Hi ${input.clientName},\n\nHere is the secure link to review the agreement and pay for ${input.title} (${input.amount}):\n\n${input.url}\n\n${studio.name}\n${studio.email}`,
    cta: { label: "Review and pay", url: input.url },
    replyTo: studio.email,
    fromName: studio.name,
    kind: "payment_link",
    studioId: studio.id,
  });
}

export async function sendReceiptEmail(studio: StudioMail, input: { to: string; clientName: string; amount: string; title: string; orderNumber: number }) {
  return sendEmail({
    to: input.to,
    subject: `Receipt: ${input.amount} for ${input.title}`,
    text: `Hi ${input.clientName},\n\nThank you. We received your payment of ${input.amount} for ${input.title} (order #${input.orderNumber}).\n\n${studio.name}\n${studio.email}`,
    replyTo: studio.email,
    fromName: studio.name,
    kind: "receipt",
    studioId: studio.id,
  });
}

export async function sendStoreDeliveryEmail(studio: StudioMail, input: { to: string; buyerName: string | null; amount: string; orderNumber: number; url: string }) {
  return sendEmail({
    to: input.to,
    subject: `Your download from ${studio.name}`,
    text: `Hi ${input.buyerName || "there"},\n\nThank you for your purchase (order #${input.orderNumber}, ${input.amount}). Download your files here:\n\n${input.url}\n\nThis link is yours to keep — come back any time within the download window.\n\n${studio.name}\n${studio.email}`,
    replyTo: studio.email,
    fromName: studio.name,
    kind: "store_delivery",
    studioId: studio.id,
  });
}

export async function sendInquiryNoticeEmail(studio: StudioMail, input: { name: string; email: string; message: string; url: string }) {
  return sendEmail({
    to: studio.email,
    subject: `New inquiry from ${input.name}`,
    text: `${input.name} <${input.email}> wrote:\n\n${input.message}\n\nReply from your studio:\n${input.url}`,
    cta: { label: "Open in studio", url: input.url },
    replyTo: input.email,
    kind: "inquiry_notice",
    studioId: studio.id,
  });
}
