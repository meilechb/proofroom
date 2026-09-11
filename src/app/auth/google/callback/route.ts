import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForProfile, findOrCreateGoogleUser, OAUTH_COOKIE } from "@/lib/google-oauth";
import { createSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { captureAtSignup } from "@/lib/referrals-server";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

function safeNext(next: string) {
  return next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : "/studio";
}

/** Completes Google sign-in: verifies state, exchanges the code, signs the user in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (why: string) => NextResponse.redirect(new URL(`/login?error=${why}`, origin));

  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE);

  if (url.searchParams.get("error")) return fail("google");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !raw) return fail("google");

  let cookieData: { n: string; next?: string; ref?: string };
  try { cookieData = JSON.parse(raw); } catch { return fail("google"); }
  if (cookieData.n !== state) return fail("google"); // CSRF

  const profile = await exchangeCodeForProfile(code);
  if (!profile) return fail("google");
  if (!profile.emailVerified) return fail("google_unverified");

  const { userId, studioId, isNew } = await findOrCreateGoogleUser(profile);
  await createSession(userId, studioId);
  await audit({ actorUserId: userId, studioId: studioId ?? undefined, action: isNew ? "studio.created" : "user.login" });
  if (isNew && studioId && cookieData.ref) {
    await captureAtSignup(studioId, cookieData.ref, profile.email).catch((error) => log.warn("google.referral_failed", { error: error instanceof Error ? error.message : String(error) }));
  }
  log.info("google.signin", { isNew });
  return NextResponse.redirect(new URL(isNew ? "/studio/welcome" : safeNext(cookieData.next ?? ""), origin));
}
