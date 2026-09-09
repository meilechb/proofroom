import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "@/lib/env";

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Neon serverless (HTTP) client. Use as a tagged template so values are always
 * bound parameters:  await db()`select * from clients where id = ${id}`
 */
export function db() {
  if (!client) {
    const url = env.databaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set.");
    client = neon(url);
  }
  return client;
}

export function dbConfigured() {
  return Boolean(env.databaseUrl());
}

type Row = Record<string, unknown>;

/** Normalizes driver output (Date -> ISO string) so rows can cross to client components. */
export function rows<T>(result: Row[]): T[] {
  return result.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
    return out as T;
  });
}

export function one<T>(result: Row[]): T | null {
  return rows<T>(result)[0] ?? null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
