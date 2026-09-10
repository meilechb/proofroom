import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { verifySvixSignature, applyResendEvent } from "@/lib/email-events";
import { log } from "@/lib/logger";

/** Resend delivery and domain webhooks (plan 16.5). Verifies the Svix signature, then mirrors the event. */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const secret = env.resendWebhookSecret();

  if (secret) {
    const ok = verifySvixSignature(secret, {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    }, body);
    if (!ok) return new NextResponse("Invalid signature", { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    // Never accept unsigned webhooks in production.
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  let event: { type?: string } | null = null;
  try {
    event = JSON.parse(body) as { type?: string };
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }
  if (!event?.type) return new NextResponse("Missing type", { status: 400 });

  try {
    await applyResendEvent(event as Parameters<typeof applyResendEvent>[0]);
  } catch (error) {
    log.error("resend_webhook.failed", { type: event.type, error: error instanceof Error ? error.message : String(error) });
    // 200 so Resend does not retry a payload we already received; the error is logged.
  }
  return NextResponse.json({ ok: true });
}
