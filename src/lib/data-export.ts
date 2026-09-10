import "server-only";

import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import type { ZipEntry } from "@/lib/zip";

/**
 * A studio's data as a zip of JSON files plus a clients CSV (plan 17.7). Photos
 * and documents are excluded (they are large binaries the studio already holds);
 * this is the records export.
 */
const encoder = new TextEncoder();
const json = (value: unknown) => encoder.encode(JSON.stringify(value, null, 2));

async function table(studioId: string, name: string, sql: Promise<unknown>): Promise<ZipEntry> {
  const data = (await sql) as unknown[];
  return { name: `${name}.json`, read: async () => json(data) };
}

export async function studioExportEntries(studioId: string): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  entries.push(await table(studioId, "studio", db()`select id, name, legal_name, email, phone, timezone, currency, slug, custom_domain, created_at from studios where id = ${studioId}`));
  entries.push(await table(studioId, "clients", db()`select id, name, email, phone, company, stage, tags, source, created_at from clients where studio_id = ${studioId} order by created_at`));
  entries.push(await table(studioId, "orders", db()`select id, order_number, client_id, title, amount_cents, currency, status, shoot_date, scheduled_at, paid_at, created_at from orders where studio_id = ${studioId} order by order_number`));
  entries.push(await table(studioId, "payments", db()`select id, order_id, kind, amount_cents, currency, status, method, created_at from payments where studio_id = ${studioId} order by created_at`));
  entries.push(await table(studioId, "galleries", db()`select id, order_id, client_id, slug, title, kind, status, expires_at, created_at from galleries where studio_id = ${studioId} order by created_at`));
  entries.push(await table(studioId, "inquiries", db()`select id, name, email, phone, message, source, status, created_at from inquiries where studio_id = ${studioId} order by created_at`));
  entries.push(await table(studioId, "packages", db()`select id, name, price_cents, deposit_cents, is_active, created_at from packages where studio_id = ${studioId} order by sort_order`));

  const clients = (await db()`select name, email, phone, company, stage, tags, source, created_at from clients where studio_id = ${studioId} order by created_at`) as Array<Record<string, unknown>>;
  const header = ["Name", "Email", "Phone", "Company", "Stage", "Tags", "Source", "Created"];
  const rows = clients.map((c) => [c.name, c.email, c.phone ?? "", c.company ?? "", c.stage, Array.isArray(c.tags) ? c.tags.join(" ") : "", c.source ?? "", String(c.created_at).slice(0, 10)]);
  const csv = toCsv([header, ...rows] as string[][]);
  entries.push({ name: "clients.csv", read: async () => encoder.encode(csv) });

  const readme = `Data export for studio ${studioId}\nGenerated ${new Date().toISOString()}\n\nEach .json file is one table. clients.csv is a spreadsheet-friendly copy of your clients. Photos and documents are not included; download those from their galleries.`;
  entries.push({ name: "README.txt", read: async () => encoder.encode(readme) });
  return entries;
}
