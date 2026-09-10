import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth";
import { oauthAuthorizeUrl, signConnectState } from "@/lib/connect";
import { rememberConnectNext } from "@/lib/connect-next";
import { appUrl } from "@/lib/env";

/** Sends the studio to Stripe to connect an EXISTING account (plan 7.3). ?next= is where to come back to. */
export async function POST(request: NextRequest) {
  try {
    const { studio } = await requireStudio("owner");
    return rememberConnectNext(request, NextResponse.redirect(oauthAuthorizeUrl(studio, signConnectState(studio.id)), { status: 303 }));
  } catch {
    return NextResponse.redirect(`${appUrl()}/studio/settings/payments?error=stripe`, { status: 303 });
  }
}
