import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { configured } from "@/lib/env";
import { googleAuthUrl, OAUTH_COOKIE } from "@/lib/google-oauth";
import { randomToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Begins the Google sign-in flow: sets a CSRF cookie and redirects to Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!configured.google()) return NextResponse.redirect(new URL("/login?error=google_unconfigured", url.origin));

  const nonce = randomToken(16);
  const payload = JSON.stringify({ n: nonce, next: url.searchParams.get("next") || "", ref: url.searchParams.get("ref") || "" });
  (await cookies()).set(OAUTH_COOKIE, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(nonce));
}
