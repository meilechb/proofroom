import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth";
import { createSubscriptionCheckout } from "@/lib/billing";
import { pendingRewardFor } from "@/lib/referrals-server";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/logger";

/** Starts the $40/month subscription in Stripe Checkout (plan 6.2). */
export async function POST() {
  try {
    const { studio, role } = await requireStudio("admin");
    if (role !== "owner" && role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const pending = await pendingRewardFor(studio.id);
    const url = await createSubscriptionCheckout(
      studio,
      { successUrl: `${appUrl()}/studio/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${appUrl()}/studio/billing?cancelled=1` },
      { applyReferralCoupon: Boolean(pending) }
    );
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    log.error("billing.checkout_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(`${appUrl()}/studio/billing?error=checkout`, { status: 303 });
  }
}
