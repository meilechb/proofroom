import "server-only";

import { decodeJwt } from "jose";
import { db, one } from "@/lib/db";
import { env, appUrl } from "@/lib/env";
import { createStudioForUser, slugAvailable } from "@/lib/account";
import { normalizeSlug } from "@/lib/slug";

/**
 * Google sign-in (design handoff: login/signup lead with "Continue with Google").
 * Standard OAuth 2.0 authorization-code flow. The id_token is read straight from
 * Google's token endpoint over TLS, so its claims are trusted without a second
 * signature check. Gated on GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Short-lived cookie holding the CSRF nonce and post-login redirect. */
export const OAUTH_COOKIE = "g_oauth";

export function googleRedirectUri() {
  return `${appUrl()}/auth/google/callback`;
}

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.googleClientId() ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string };

/** Exchanges the one-time code for the user's verified profile, or null on any failure. */
export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId() ?? "",
      client_secret: env.googleClientSecret() ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;
  const claims = decodeJwt(data.id_token) as {
    sub?: string; email?: string; email_verified?: boolean | string; name?: string; given_name?: string;
  };
  if (!claims.sub || !claims.email) return null;
  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: (claims.name || claims.given_name || claims.email.split("@")[0]).slice(0, 120),
  };
}

/** A studio slug that isn't taken, derived from the person's name or email. */
async function uniqueSlug(base: string) {
  const root = normalizeSlug(base) || "studio";
  if (await slugAvailable(root)) return root;
  for (let i = 2; i < 100; i++) {
    const candidate = `${root}-${i}`;
    if (await slugAvailable(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Resolves a Google profile to a user: sign in a known account, link a matching
 * email, or create a brand-new user with their first studio.
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<{ userId: string; studioId: string | null; isNew: boolean }> {
  const bySub = one<{ id: string }>(await db()`select id from users where google_sub = ${profile.sub} limit 1`);
  if (bySub) return { userId: bySub.id, studioId: null, isNew: false };

  const byEmail = one<{ id: string; google_sub: string | null }>(await db()`select id, google_sub from users where lower(email) = ${profile.email} limit 1`);
  if (byEmail) {
    if (!byEmail.google_sub) {
      await db()`update users set google_sub = ${profile.sub}, email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = ${byEmail.id}`;
    }
    return { userId: byEmail.id, studioId: null, isNew: false };
  }

  const created = one<{ id: string }>(
    await db()`insert into users (email, name, google_sub, email_verified_at) values (${profile.email}, ${profile.name}, ${profile.sub}, now()) returning id`
  );
  const userId = created!.id;
  const first = profile.name.trim().split(/\s+/)[0] || profile.email.split("@")[0];
  const studio = await createStudioForUser(userId, { studioName: `${first}'s studio`, slug: await uniqueSlug(profile.name || profile.email.split("@")[0]), email: profile.email });
  return { userId, studioId: studio.id, isNew: true };
}
