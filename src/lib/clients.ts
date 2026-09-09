import "server-only";

import { db, one, rows } from "@/lib/db";
import type { Client, ClientStage } from "@/lib/types";

/** CRM: clients, stages, tags, merge, archive, search, and the timeline events other modules record. */

export type ClientInput = { name: string; email: string; phone?: string | null; company?: string | null; notes?: string | null; stage?: ClientStage; tags?: string[]; source?: string | null };

export async function findClientByEmail(studioId: string, email: string) {
  return one<Client>(await db()`select * from clients where studio_id = ${studioId} and lower(email) = lower(${email}) limit 1`);
}

/** Creates a client, or returns the existing one with the same email (no duplicates per studio). */
export async function createClient(studioId: string, input: ClientInput): Promise<{ client: Client; created: boolean }> {
  const existing = await findClientByEmail(studioId, input.email);
  if (existing) return { client: existing, created: false };
  const client = one<Client>(
    await db()`
      insert into clients (studio_id, name, email, phone, company, notes, stage, tags, source, last_activity_at)
      values (${studioId}, ${input.name.trim()}, ${input.email.trim().toLowerCase()}, ${input.phone ?? null}, ${input.company ?? null}, ${input.notes ?? null}, ${input.stage ?? "lead"}, ${input.tags ?? []}, ${input.source ?? null}, now())
      on conflict (studio_id, lower(email)) do update set updated_at = now()
      returning *`
  );
  if (!client) throw new Error("Could not create the client.");
  await recordClientEvent(studioId, client.id, "client.created", null, null, `Added${input.source ? ` from ${input.source}` : ""}`);
  return { client, created: true };
}

export async function updateClient(studioId: string, id: string, patch: Partial<ClientInput>) {
  const current = one<Client>(await db()`select * from clients where id = ${id} and studio_id = ${studioId}`);
  if (!current) throw new Error("Not found");
  return one<Client>(
    await db()`
      update clients set
        name = ${patch.name?.trim() ?? current.name},
        email = ${patch.email?.trim().toLowerCase() ?? current.email},
        phone = ${patch.phone === undefined ? current.phone : patch.phone},
        company = ${patch.company === undefined ? current.company : patch.company},
        notes = ${patch.notes === undefined ? current.notes : patch.notes},
        tags = ${patch.tags ?? current.tags},
        source = ${patch.source === undefined ? current.source : patch.source}
      where id = ${id} and studio_id = ${studioId}
      returning *`
  );
}

export async function setStage(studioId: string, id: string, stage: ClientStage) {
  const client = one<Client>(await db()`update clients set stage = ${stage}, last_activity_at = now() where id = ${id} and studio_id = ${studioId} returning *`);
  if (client) await recordClientEvent(studioId, id, "client.stage", null, null, `Stage set to ${stage.replace("_", " ")}`);
  return client;
}

export async function addTag(studioId: string, id: string, tag: string) {
  const t = tag.trim().toLowerCase().slice(0, 40);
  if (!t) return;
  await db()`update clients set tags = array_append(array_remove(tags, ${t}), ${t}) where id = ${id} and studio_id = ${studioId}`;
}

export async function removeTag(studioId: string, id: string, tag: string) {
  await db()`update clients set tags = array_remove(tags, ${tag.trim().toLowerCase()}) where id = ${id} and studio_id = ${studioId}`;
}

export async function listTags(studioId: string) {
  return rows<{ tag: string; count: number }>(await db()`select unnest(tags) as tag, count(*)::int as count from clients where studio_id = ${studioId} group by 1 order by 2 desc, 1`);
}

export async function archiveClient(studioId: string, id: string, archive = true) {
  return one<Client>(await db()`update clients set archived = ${archive}, archived_at = ${archive ? new Date().toISOString() : null}, stage = case when ${archive} then 'archived' else case when stage = 'archived' then 'lead' else stage end end where id = ${id} and studio_id = ${studioId} returning *`);
}

/** Moves everything from `dropId` onto `keepId`, then deletes the duplicate (plan 3.58 merge). */
export async function mergeClients(studioId: string, keepId: string, dropId: string) {
  if (keepId === dropId) throw new Error("Pick two different clients.");
  const keep = one<Client>(await db()`select * from clients where id = ${keepId} and studio_id = ${studioId}`);
  const drop = one<Client>(await db()`select * from clients where id = ${dropId} and studio_id = ${studioId}`);
  if (!keep || !drop) throw new Error("Not found");
  const sql = db();
  await sql.transaction([
    sql`update orders set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update galleries set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update inquiries set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update tasks set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update client_notes set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update client_events set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update documents set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update booking_slots set client_id = ${keepId} where client_id = ${dropId} and studio_id = ${studioId}`,
    sql`update clients set
          phone = coalesce(phone, ${drop.phone}), company = coalesce(company, ${drop.company}),
          notes = case when ${drop.notes} is null then notes else concat_ws(E'\n\n', notes, ${drop.notes}) end,
          tags = (select array_agg(distinct t) from unnest(tags || ${drop.tags}) t),
          last_activity_at = greatest(last_activity_at, ${drop.last_activity_at})
        where id = ${keepId}`,
    sql`delete from clients where id = ${dropId} and studio_id = ${studioId}`,
  ]);
  await recordClientEvent(studioId, keepId, "client.merged", "client", dropId, `Merged ${drop.name} (${drop.email}) into this client`);
  return keep;
}

export type ClientFilter = { q?: string; stage?: ClientStage | "all"; tag?: string; archived?: boolean };

export async function searchClients(studioId: string, filter: ClientFilter, limit = 50, cursor?: string | null) {
  const q = filter.q?.trim() ? `%${filter.q.trim()}%` : null;
  const stage = filter.stage && filter.stage !== "all" ? filter.stage : null;
  const tag = filter.tag?.trim() || null;
  const archived = filter.archived ?? false;
  return rows<Client & { balance_due_cents: number }>(
    await db()`
      select c.*,
        coalesce((select sum(greatest(0, o.amount_cents - o.discount_cents - coalesce((select sum(p.amount_cents - p.refunded_cents) from payments p where p.order_id = o.id and p.status in ('paid','partially_refunded')), 0)))
                  from orders o where o.client_id = c.id and o.status not in ('cancelled','draft')), 0)::int as balance_due_cents
      from clients c
      where c.studio_id = ${studioId}
        and c.archived = ${archived}
        and (${q}::text is null or c.name ilike ${q} or c.email ilike ${q} or coalesce(c.company, '') ilike ${q})
        and (${stage}::text is null or c.stage = ${stage})
        and (${tag}::text is null or ${tag} = any(c.tags))
        and (${cursor ?? null}::timestamptz is null or c.created_at < ${cursor ?? null}::timestamptz)
      order by c.created_at desc
      limit ${limit}`
  );
}

/** Timeline entry written by the system (gallery sent, payment received, email sent). */
export async function recordClientEvent(studioId: string, clientId: string, kind: string, refType: string | null, refId: string | null, summary: string, meta: Record<string, unknown> = {}) {
  await db()`insert into client_events (studio_id, client_id, kind, ref_type, ref_id, summary, meta) values (${studioId}, ${clientId}, ${kind}, ${refType}, ${refId}, ${summary}, ${JSON.stringify(meta)}::jsonb)`;
  await db()`update clients set last_activity_at = now() where id = ${clientId}`;
}
