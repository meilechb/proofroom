import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/auth";
import { createOnboardingLink } from "@/lib/connect";
import { appUrl } from "@/lib/env";

/** Stripe's refresh_url: the link expired or was reused, so mint a fresh one (plan 7.8). */
export async function GET() {
  const ctx = await getStudioContext();
  if (!ctx?.studio.stripe_account_id) return NextResponse.redirect(`${appUrl()}/studio/settings/payments`, { status: 303 });
  try {
    return NextResponse.redirect(await createOnboardingLink(ctx.studio.stripe_account_id), { status: 303 });
  } catch {
    return NextResponse.redirect(`${appUrl()}/studio/settings/payments?error=stripe`, { status: 303 });
  }
}
