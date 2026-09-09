import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth";
import { createPortalSession } from "@/lib/billing";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/logger";

/** Opens Stripe's Customer Portal: update card, cancel, invoices (plan 6.3). */
export async function POST() {
  try {
    const { studio } = await requireStudio("admin");
    const url = await createPortalSession(studio, `${appUrl()}/studio/billing`);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    log.error("billing.portal_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(`${appUrl()}/studio/billing?error=portal`, { status: 303 });
  }
}
