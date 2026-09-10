import "server-only";

import { db, one, rows } from "@/lib/db";
import { assetPath } from "@/lib/storage";
import { downloadBlob, makeWebVersion, putJpeg, PREVIEW_MAX_EDGE, THUMB_MAX_EDGE } from "@/lib/images";
import { addBytes } from "@/lib/usage";

/**
 * The public portfolio (plan 15.5). Each item points at an asset and carries a
 * category, caption, featured flag and publish flag. Order is a per-studio
 * sort_order. Deleting an item never deletes the underlying asset.
 */

export type PortfolioItem = {
  id: string;
  studio_id: string;
  asset_id: string;
  category: string;
  caption: string | null;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  // joined from assets
  thumb: string;
  url: string;
  alt: string;
  filename: string;
};

export async function listPortfolio(studioId: string) {
  return rows<PortfolioItem>(
    await db()`
      select pi.*, coalesce(a.thumb_url, a.web_url, a.url) as thumb, a.url as url, a.alt as alt, a.filename as filename
      from portfolio_items pi join assets a on a.id = pi.asset_id
      where pi.studio_id = ${studioId}
      order by pi.sort_order, pi.created_at`
  );
}

export async function portfolioCategories(studioId: string) {
  const r = (await db()`select distinct category from portfolio_items where studio_id = ${studioId} order by category`) as { category: string }[];
  return r.map((x) => x.category);
}

/** Add assets to the portfolio, skipping ones already in it (plan 15.5). */
export async function addAssetsToPortfolio(studioId: string, assetIds: string[], category: string) {
  const clean = (category || "headshots").trim().slice(0, 60) || "headshots";
  const start = one<{ n: number }>(await db()`select coalesce(max(sort_order), 0) as n from portfolio_items where studio_id = ${studioId}`);
  let order = (start?.n ?? 0) + 1;
  let added = 0;
  for (const assetId of assetIds) {
    const inserted = await db()`
      insert into portfolio_items (studio_id, asset_id, category, sort_order)
      values (${studioId}, ${assetId}, ${clean}, ${order})
      on conflict (studio_id, asset_id) do nothing
      returning id`;
    if (inserted.length) { added++; order++; }
  }
  return added;
}

export async function updatePortfolioItem(studioId: string, id: string, patch: { caption?: string | null; category?: string; is_featured?: boolean; is_published?: boolean }) {
  const category = patch.category !== undefined ? (patch.category.trim().slice(0, 60) || "headshots") : undefined;
  return one<PortfolioItem>(
    await db()`
      update portfolio_items set
        caption = case when ${patch.caption !== undefined} then ${patch.caption ?? null} else caption end,
        category = coalesce(${category ?? null}, category),
        is_featured = coalesce(${patch.is_featured ?? null}, is_featured),
        is_published = coalesce(${patch.is_published ?? null}, is_published)
      where id = ${id} and studio_id = ${studioId} returning *`
  );
}

export async function removePortfolioItem(studioId: string, id: string) {
  await db()`delete from portfolio_items where id = ${id} and studio_id = ${studioId}`;
}

export async function reorderPortfolio(studioId: string, orderedIds: string[]) {
  let position = 1;
  for (const id of orderedIds) {
    await db()`update portfolio_items set sort_order = ${position++} where id = ${id} and studio_id = ${studioId}`;
  }
  await db()`
    update portfolio_items set sort_order = sub.rn + ${orderedIds.length}
    from (select id, row_number() over (order by sort_order, created_at) as rn from portfolio_items where studio_id = ${studioId} and id <> all(${orderedIds}::uuid[])) sub
    where portfolio_items.id = sub.id and portfolio_items.studio_id = ${studioId}`;
}

/**
 * Galleries a studio may pull portfolio photos from (plan 15.6): only those whose
 * order recorded the client's portfolio consent (`contract_portfolio_ok`).
 */
export type ImportableGallery = { id: string; title: string; kind: string; client_name: string; photo_count: number };
export async function importableGalleries(studioId: string) {
  return rows<ImportableGallery>(
    await db()`
      select g.id, g.title, g.kind, c.name as client_name,
        (select count(*)::int from photos p where p.gallery_id = g.id) as photo_count
      from galleries g
      join orders o on o.id = g.order_id and o.contract_portfolio_ok is true
      join clients c on c.id = g.client_id
      where g.studio_id = ${studioId} and g.status <> 'archived'
        and exists (select 1 from photos p where p.gallery_id = g.id)
      order by g.created_at desc`
  );
}

export type ImportablePhoto = { id: string; thumb: string; filename: string };
export async function galleryPhotosForImport(studioId: string, galleryId: string) {
  const consented = one<{ id: string }>(
    await db()`select g.id from galleries g join orders o on o.id = g.order_id and o.contract_portfolio_ok is true where g.id = ${galleryId} and g.studio_id = ${studioId}`
  );
  if (!consented) return [];
  return rows<ImportablePhoto>(
    await db()`select id, coalesce(thumb_url, preview_url) as thumb, filename from photos where gallery_id = ${galleryId} and studio_id = ${studioId} and preview_url <> '' order by sort_order, created_at`
  );
}

/** Copy chosen gallery photos into the public asset store and add them to the portfolio (plan 15.6). */
export async function importPhotosToPortfolio(studioId: string, photoIds: string[], category: string) {
  if (!photoIds.length) return 0;
  const photos = rows<{ id: string; preview_url: string; original_url: string; filename: string }>(
    await db()`
      select p.id, p.preview_url, p.original_url, p.filename
      from photos p
      join galleries g on g.id = p.gallery_id
      join orders o on o.id = g.order_id and o.contract_portfolio_ok is true
      where p.studio_id = ${studioId} and p.id = any(${photoIds}::uuid[])`
  );
  const newAssetIds: string[] = [];
  for (const photo of photos) {
    try {
      const source = await downloadBlob(photo.preview_url, "galleries");
      const [web, thumb] = await Promise.all([
        makeWebVersion(source, PREVIEW_MAX_EDGE),
        makeWebVersion(source, THUMB_MAX_EDGE, 80),
      ]);
      const asset = one<{ id: string }>(
        await db()`
          insert into assets (studio_id, kind, url, filename, content_type, size_bytes, folder)
          values (${studioId}, 'image', ${`pending:import`}, ${photo.filename}, 'image/jpeg', 0, 'portfolio')
          returning id`
      );
      if (!asset) continue;
      const webBlob = await putJpeg("assets", assetPath(studioId, `${asset.id}-web.jpg`), web.buffer);
      const thumbBlob = await putJpeg("assets", assetPath(studioId, `${asset.id}-thumb.jpg`), thumb.buffer);
      const totalBytes = web.buffer.length + thumb.buffer.length;
      await db()`
        update assets set url = ${webBlob.url}, web_url = ${webBlob.url}, thumb_url = ${thumbBlob.url},
          width = ${web.width}, height = ${web.height}, size_bytes = ${totalBytes}
        where id = ${asset.id} and studio_id = ${studioId}`;
      await addBytes(studioId, totalBytes);
      newAssetIds.push(asset.id);
    } catch {
      // Skip a photo we could not copy; the rest still import.
    }
  }
  if (newAssetIds.length) await addAssetsToPortfolio(studioId, newAssetIds, category);
  return newAssetIds.length;
}

export async function renamePortfolioCategory(studioId: string, from: string, to: string) {
  const clean = to.trim().slice(0, 60);
  if (!clean) return 0;
  const updated = await db()`update portfolio_items set category = ${clean} where studio_id = ${studioId} and category = ${from} returning id`;
  return updated.length;
}
