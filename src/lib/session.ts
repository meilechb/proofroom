import "server-only";

import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/tokens";
import { clientIp } from "@/lib/rate-limit";

/**
 * Database-backed sessions. The cookie holds an opaque random token; only its
 * SHA-256 hash is stored, so a database leak does not yield usable sessions.
 * Sessions are revocable (sign out everywhere, password reset) and record the
 * active studio for users who belong to more than one.
 */

export const SESSION_COOKIE = "pr_session";
const SESSION_DAYS = 30;
const ROLL_AFTER_MS = 24 * 60 * 60 * 1000;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string, studioId: string | null) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  const h = await headers();
  await db()`
    insert into sessions (user_id, token_hash, studio_id, user_agent, ip, expires_at)
    values (${userId}, ${hashToken(token)}, ${studioId}, ${(h.get("user-agent") ?? "").slice(0, 300)},
            ${clientIp(h)}, ${expires.toISOString()})`;
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expires));
}

export type SessionRow = {
  id: string;
  user_id: string;
  studio_id: string | null;
  expires_at: string;
  last_seen_at: string;
};

/** Reads and validates the current session, touching last_seen at most daily. */
export async function readSession(): Promise<SessionRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await db()`
    select id, user_id, studio_id, expires_at, last_seen_at
    from sessions where token_hash = ${hashToken(token)} and expires_at > now() limit 1`;
  const row = result[0] as SessionRow | undefined;
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > ROLL_AFTER_MS) {
    // Fire and forget; a failed touch must not break the request.
    db()`update sessions set last_seen_at = now(), expires_at = now() + interval '30 days' where id = ${row.id}`.catch(
      () => undefined
    );
  }
  return row;
}

export async function setSessionStudio(sessionId: string, studioId: string) {
  await db()`update sessions set studio_id = ${studioId} where id = ${sessionId}`;
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db()`delete from sessions where token_hash = ${hashToken(token)}`;
  store.delete(SESSION_COOKIE);
}

/** Sign out every device (password reset, security). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  if (exceptSessionId) {
    await db()`delete from sessions where user_id = ${userId} and id <> ${exceptSessionId}`;
  } else {
    await db()`delete from sessions where user_id = ${userId}`;
  }
}
