import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hasRole, listMemberships } from "@/lib/auth";
import { completeOauth, verifyConnectState } from "@/lib/connect";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/logger";

/** Stripe redirects here with ?code&state, or ?error=access_denied (plan 7.4, 7.5). */
export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/studio/settings/payments?${q}`, { status: 303 });
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(`error=${encodeURIComponent(params.get("error") ?? "stripe")}`);
  const state = verifyConnectState(params.get("state"));
  if (!state) return back("error=state");
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login?next=/studio/settings/payments`, { status: 303 });
  const membership = (await listMemberships(user.id)).find((m) => m.studio_id === state.studioId);
  if (!membership || !hasRole(membership.role, "owner")) return back("error=state");
  try {
    const accountId = await completeOauth(state.studioId, params.get("code") ?? "");
    await audit({ studioId: state.studioId, actorUserId: user.id, action: "stripe.connected", metadata: { method: "oauth", account: accountId } });
    return back("connected=1");
  } catch (error) {
    log.warn("connect.oauth_failed", { error: error instanceof Error ? error.message : String(error) });
    return back("error=stripe");
  }
}
