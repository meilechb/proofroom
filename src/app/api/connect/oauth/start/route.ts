import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth";
import { oauthAuthorizeUrl, signConnectState } from "@/lib/connect";
import { appUrl } from "@/lib/env";

/** Sends the studio to Stripe to connect an EXISTING account (plan 7.3). */
export async function POST() {
  try {
    const { studio } = await requireStudio("owner");
    return NextResponse.redirect(oauthAuthorizeUrl(studio, signConnectState(studio.id)), { status: 303 });
  } catch {
    return NextResponse.redirect(`${appUrl()}/studio/settings/payments?error=stripe`, { status: 303 });
  }
}
