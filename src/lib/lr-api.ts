import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { db, one } from "@/lib/db";
import { studioIdForToken } from "@/lib/api-tokens";
import { hashToken } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { billingState } from "@/lib/plans";
import { log } from "@/lib/logger";
import type { Studio } from "@/lib/types";
import { ApiError, LR_API_VERSION } from "@/lib/lr-api-shared";

/**
 * The Lightroom plugin API (plan 18.1). Every route is wrapped by withApi, which
 * turns a bearer token into a studio, enforces a per-token rate limit, blocks
 * writes on a read-only studio, and returns JSON errors with stable codes. The
 * plugin reads the X-LR-Api-Version header and the /ping minimum version. Pure
 * helpers and constants live in lr-api-shared.
 */

export { ApiError, bodyString, bodyOptString, LR_API_VERSION, LR_MIN_PLUGIN_VERSION } from "@/lib/lr-api-shared";

export type ApiContext = { studio: Studio; request: NextRequest; params: Record<string, string>; body: unknown };
type Handler = (ctx: ApiContext) => Promise<unknown> | unknown;

const headers = { "X-LR-Api-Version": LR_API_VERSION };

export function withApi(handler: Handler, opts: { write?: boolean } = {}) {
  return async (request: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => {
    try {
      const auth = request.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!token) throw new ApiError(401, "unauthorized", "Provide your studio token as a bearer token.");

      const rl = await rateLimit(`lr:${hashToken(token).slice(0, 16)}`, 120, 60);
      if (!rl.ok) throw new ApiError(429, "rate_limited", `Too many requests. Try again in ${rl.retryAfterSeconds}s.`);

      const studioId = await studioIdForToken(token);
      if (!studioId) throw new ApiError(401, "unauthorized", "That token is invalid or has been revoked.");
      const studio = one<Studio>(await db()`select * from studios where id = ${studioId} and deleted_at is null`);
      if (!studio) throw new ApiError(401, "unauthorized", "The studio for this token no longer exists.");
      if (opts.write && !billingState(studio).canWrite) throw new ApiError(402, "read_only", "This studio is read-only. Update billing to publish.");

      const params = ctx?.params ? await ctx.params : {};
      let body: unknown = null;
      // Parse JSON bodies only; binary uploads (the photo data PUT) are read by the handler.
      if (request.method !== "GET" && request.method !== "DELETE" && (request.headers.get("content-type") ?? "").includes("application/json")) {
        body = await request.json().catch(() => null);
      }

      const data = await handler({ studio, request, params, body });
      return NextResponse.json(data ?? { ok: true }, { headers });
    } catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
      log.error("lr_api.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500, headers });
    }
  };
}
