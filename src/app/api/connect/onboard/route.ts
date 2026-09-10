import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth";
import { startOnboarding } from "@/lib/connect";
import { rememberConnectNext } from "@/lib/connect-next";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/logger";

/** Creates a new Standard-equivalent account (or reuses the pending one) and redirects to Stripe's hosted onboarding (plan 7.6). */
export async function POST(request: NextRequest) {
  try {
    const { studio, user } = await requireStudio("owner");
    const url = await startOnboarding(studio);
    await audit({ studioId: studio.id, actorUserId: user.id, action: "stripe.onboarding_started" });
    return rememberConnectNext(request, NextResponse.redirect(url, { status: 303 }));
  } catch (error) {
    log.warn("connect.onboard_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(`${appUrl()}/studio/settings/payments?error=stripe`, { status: 303 });
  }
}
