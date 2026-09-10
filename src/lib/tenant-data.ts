import "server-only";

import { headers } from "next/headers";
import { db, one } from "@/lib/db";
import type { Gallery, Studio } from "@/lib/types";
import { parseSite, type Site } from "@/lib/site/schema";
import { defaultSite } from "@/lib/site/defaults";

/** Loads a studio for a tenant page by its slug (proxy already resolved the host). */
export async function studioBySlug(slug: string) {
  return one<Studio>(await db()`select * from studios where slug = ${slug} and deleted_at is null`);
}

/** The slug the proxy stamped on the request, for pages that don't take it as a param. */
export async function tenantSlug() {
  return (await headers()).get("x-tenant-slug");
}

export function siteOf(studio: Studio): Site {
  return parseSite(studio.site, defaultSite(studio.name));
}

export async function galleryBySlug(studioId: string, gslug: string) {
  return one<Gallery>(await db()`select * from galleries where studio_id = ${studioId} and slug = ${gslug} and status <> 'archived'`);
}
