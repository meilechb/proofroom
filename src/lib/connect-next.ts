import type { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/env";

/**
 * Where to send the studio after Stripe hands them back (plan 9.5.4). The
 * onboarding wizard passes ?next=/studio/welcome?step=5 to the start routes,
 * which remember it in a short-lived cookie; the return routes consume it.
 * Only same-site studio paths are accepted.
 */
const COOKIE = "pr_connect_next";
const DEFAULT = "/studio/settings/payments";

export function safeStudioPath(value: string | null | undefined) {
  return value && /^\/studio(\/[\w\-/?=&%.]*)?$/.test(value) && !value.startsWith("//") ? value : null;
}

export function rememberConnectNext(request: NextRequest, response: NextResponse) {
  const next = safeStudioPath(request.nextUrl.searchParams.get("next"));
  if (next) response.cookies.set(COOKIE, next, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
  return response;
}

/** Absolute URL to land on, with `query` appended, and the cookie cleared on the response. */
export function connectReturnUrl(request: NextRequest, query: string) {
  const next = safeStudioPath(request.cookies.get(COOKIE)?.value) ?? DEFAULT;
  const url = new URL(next, appUrl());
  for (const [k, v] of new URLSearchParams(query)) url.searchParams.set(k, v);
  return url.toString();
}

export function clearConnectNext(response: NextResponse) {
  response.cookies.delete(COOKIE);
  return response;
}
