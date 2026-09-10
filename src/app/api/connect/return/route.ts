import { NextResponse, type NextRequest } from "next/server";
import { getStudioContext } from "@/lib/auth";
import { refreshAccountStatus } from "@/lib/connect";
import { clearConnectNext, connectReturnUrl } from "@/lib/connect-next";
import { appUrl } from "@/lib/env";

/** Stripe sends the studio back here after hosted onboarding; we re-read the account (plan 7.7). */
export async function GET(request: NextRequest) {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.redirect(`${appUrl()}/login?next=/studio/settings/payments`, { status: 303 });
  let query = "";
  if (ctx.studio.stripe_account_id) {
    try {
      const snap = await refreshAccountStatus(ctx.studio.id, ctx.studio.stripe_account_id);
      if (snap.stripe_charges_enabled) query = "connected=1";
    } catch {
      // Status refresh failed; the page re-reads on load.
    }
  }
  return clearConnectNext(NextResponse.redirect(connectReturnUrl(request, query), { status: 303 }));
}
