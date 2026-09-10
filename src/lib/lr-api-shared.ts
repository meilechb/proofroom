/**
 * Pure Lightroom-API helpers and constants (plan 18.1, 18.10). Kept free of
 * next/server and the database so they can be unit-tested and reused.
 */

export const LR_API_VERSION = "1";
export const LR_MIN_PLUGIN_VERSION = "1.0.0";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** A required string from a JSON body, trimmed and capped; throws ApiError(400) if absent. */
export function bodyString(body: unknown, key: string, max = 500): string {
  const v = (body as Record<string, unknown> | null)?.[key];
  if (typeof v !== "string" || !v.trim()) throw new ApiError(400, "invalid", `Missing "${key}".`);
  return v.trim().slice(0, max);
}

export function bodyOptString(body: unknown, key: string, max = 500): string | null {
  const v = (body as Record<string, unknown> | null)?.[key];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
