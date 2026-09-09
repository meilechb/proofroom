import "server-only";

import { db, one, rows } from "@/lib/db";
import { normalizeSlug } from "@/lib/slug";
import type { Package } from "@/lib/types";

export type PackageInput = { name: string; description?: string | null; priceCents: number; depositCents: number; includedFinals: number; extraFinalCents: number; includes?: string[]; turnaround?: string | null; isFeatured?: boolean; isActive?: boolean; showOnSite?: boolean; durationMinutes?: number | null };

export async function listPackages(studioId: string, onlyActive = false) {
  return rows<Package>(
    onlyActive
      ? await db()`select * from packages where studio_id = ${studioId} and is_active order by sort_order, created_at`
      : await db()`select * from packages where studio_id = ${studioId} order by sort_order, created_at`
  );
}

export async function createPackage(studioId: string, input: PackageInput) {
  const base = normalizeSlug(input.name) || "package";
  let slug = base;
  for (let i = 2; (await db()`select 1 from packages where studio_id = ${studioId} and slug = ${slug}`).length > 0; i++) slug = `${base}-${i}`;
  const next = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) + 1 as n from packages where studio_id = ${studioId}`);
  return one<Package>(
    await db()`
      insert into packages (studio_id, slug, name, description, price_cents, deposit_cents, included_finals, extra_final_cents, includes, turnaround, is_featured, is_active, sort_order)
      values (${studioId}, ${slug}, ${input.name.trim()}, ${input.description ?? null}, ${input.priceCents}, ${input.depositCents}, ${input.includedFinals}, ${input.extraFinalCents}, ${input.includes ?? []}, ${input.turnaround ?? null}, ${input.isFeatured ?? false}, ${input.isActive ?? true}, ${next?.n ?? 1})
      returning *`
  );
}

export async function updatePackage(studioId: string, id: string, input: Partial<PackageInput>) {
  const current = one<Package>(await db()`select * from packages where id = ${id} and studio_id = ${studioId}`);
  if (!current) throw new Error("Not found");
  return one<Package>(
    await db()`
      update packages set
        name = ${input.name?.trim() ?? current.name},
        description = ${input.description === undefined ? current.description : input.description},
        price_cents = ${input.priceCents ?? current.price_cents},
        deposit_cents = ${input.depositCents ?? current.deposit_cents},
        included_finals = ${input.includedFinals ?? current.included_finals},
        extra_final_cents = ${input.extraFinalCents ?? current.extra_final_cents},
        includes = ${input.includes ?? current.includes},
        turnaround = ${input.turnaround === undefined ? current.turnaround : input.turnaround},
        is_featured = ${input.isFeatured ?? current.is_featured},
        is_active = ${input.isActive ?? current.is_active}
      where id = ${id} and studio_id = ${studioId}
      returning *`
  );
}

/** Packages are never deleted (orders reference them); archiving hides them from new sessions and the site. */
export async function archivePackage(studioId: string, id: string) {
  return one<Package>(await db()`update packages set is_active = false where id = ${id} and studio_id = ${studioId} returning *`);
}

export async function reorderPackages(studioId: string, orderedIds: string[]) {
  let i = 1;
  for (const id of orderedIds) await db()`update packages set sort_order = ${i++} where id = ${id} and studio_id = ${studioId}`;
}
