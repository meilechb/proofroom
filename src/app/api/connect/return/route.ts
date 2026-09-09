import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/auth";
import { refreshAccountStatus } from "@/lib/connect";
import { appUrl } from "@/lib/env";

/** Stripe sends the studio back here after hosted onboarding; we re-read the account (plan 7.7). */
export async function GET() {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.redirect(`${appUrl()}/login?next=/studio/settings/payments`, { status: 303 });
  if (ctx.studio.stripe_account_id) {
    try {
      const snap = await refreshAccountStatus(ctx.studio.id, ctx.studio.stripe_account_id);
      return NextResponse.redirect(`${appUrl()}/studio/settings/payments${snap.stripe_charges_enabled ? "?connected=1" : ""}`, { status: 303 });
    } catch {
      // fall through
    }
  }
  return NextResponse.redirect(`${appUrl()}/studio/settings/payments`, { status: 303 });
}
