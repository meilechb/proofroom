import "server-only";

import { db, one, rows } from "@/lib/db";
import { generateApiToken, hashToken } from "@/lib/tokens";

/** Lightroom plugin tokens (plan 18.1, 9.5.6). The raw token is returned once at creation. */

export type ApiTokenRow = { id: string; name: string; token_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string; created_by_name: string | null };

export async function createApiToken(studioId: string, userId: string | null, name: string) {
  const { token, prefix, hash } = generateApiToken();
  const row = one<{ id: string }>(
    await db()`insert into api_tokens (studio_id, created_by, name, token_hash, token_prefix) values (${studioId}, ${userId}, ${name.trim().slice(0, 80) || "Lightroom"}, ${hash}, ${prefix}) returning id`
  );
  return { id: row!.id, token, prefix };
}

export async function listApiTokens(studioId: string) {
  return rows<ApiTokenRow>(
    await db()`
      select t.id, t.name, t.token_prefix, t.last_used_at, t.revoked_at, t.created_at, u.name as created_by_name
      from api_tokens t left join users u on u.id = t.created_by
      where t.studio_id = ${studioId} order by t.revoked_at nulls first, t.created_at desc`
  );
}

export async function revokeApiToken(studioId: string, id: string) {
  await db()`update api_tokens set revoked_at = now() where id = ${id} and studio_id = ${studioId} and revoked_at is null`;
}

/** Resolves a bearer token to its studio; touches last_used_at. Null when unknown or revoked. */
export async function studioIdForToken(rawToken: string) {
  if (!rawToken.startsWith("pr_live_")) return null;
  const row = one<{ id: string; studio_id: string }>(
    await db()`select id, studio_id from api_tokens where token_hash = ${hashToken(rawToken)} and revoked_at is null limit 1`
  );
  if (!row) return null;
  await db()`update api_tokens set last_used_at = now() where id = ${row.id}`;
  return row.studio_id;
}
