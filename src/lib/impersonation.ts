import "server-only";

import { cookies } from "next/headers";
import { hmac, safeEqual } from "@/lib/tokens";
import { env } from "@/lib/env";

/**
 * Read-only impersonation for platform admins (plan 19.4). A signed cookie names
 * the studio to view; getStudioContext honors it only for platform admins and
 * forces the context read-only. Nothing here grants write access.
 */

export const IMPERSONATE_COOKIE = "pr_impersonate";

function sign(studioId: string) {
  return hmac(env.appSecret() ?? "dev-secret", `impersonate.${studioId}`);
}

export function impersonationValue(studioId: string) {
  return `${studioId}.${sign(studioId)}`;
}

/** Returns the impersonated studio id when the cookie is present and valid. */
export async function readImpersonation(): Promise<string | null> {
  const raw = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  return safeEqual(sig, sign(id)) ? id : null;
}
