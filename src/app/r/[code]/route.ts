import { NextResponse, type NextRequest } from "next/server";
import { isReferralCodeShape, normalizeReferralCode } from "@/lib/referrals";
import { appUrl } from "@/lib/env";

/** Referral link target: remembers the code for 30 days, then continues to signup. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/r/[code]">) {
  const { code } = await params;
  const normalized = normalizeReferralCode(code);
  const target = new URL("/signup", appUrl());
  if (!isReferralCodeShape(normalized)) return NextResponse.redirect(target);
  target.searchParams.set("ref", normalized);
  const res = NextResponse.redirect(target);
  res.cookies.set("ref", normalized, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  return res;
}
