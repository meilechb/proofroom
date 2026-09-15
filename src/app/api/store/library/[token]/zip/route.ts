import { NextResponse, type NextRequest } from "next/server";
import { db, rows } from "@/lib/db";
import { verifyLink } from "@/lib/tenant-tokens";
import { getSaleById, listGrantsForSale, listSaleItems, recordGrantDownload } from "@/lib/store";
import { resolveGrantFile } from "@/lib/store-delivery";
import { safeFilename } from "@/lib/storage";
import { zipStream } from "@/lib/zip";
import { clientIp, limited } from "@/lib/rate-limit";
import type { SaleItem } from "@/lib/types";

/** The archive entry name: the source filename, forced to .jpg for a rendered tier. */
function entryName(filename: string | undefined, resolution: string) {
  const safe = safeFilename(filename ?? "photo.jpg", "photo.jpg");
  return resolution === "original" ? safe : `${safe.replace(/\.[^.]+$/, "")}.jpg`;
}

/**
 * "Download all" — one ZIP of every still-downloadable file on a paid sale,
 * entered through the buyer's library token. Each included grant counts as one
 * download (grants at their cap or expired are skipped). Files are rendered
 * lazily as the archive streams, so a large order never sits in memory at once.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rl = await limited("store_download", clientIp(request.headers));
  if (!rl.ok) return new NextResponse("Too many downloads. Try again shortly.", { status: 429 });

  const saleId = verifyLink("download", token);
  const sale = saleId ? await getSaleById(saleId) : null;
  if (!sale || (sale.status !== "paid" && sale.status !== "partially_refunded")) return new NextResponse(null, { status: 404 });

  const items = new Map((await listSaleItems(sale.id)).map((it) => [it.id, it]));
  const now = new Date();
  const usable = (await listGrantsForSale(sale.id)).filter(
    (g) => !g.revoked && g.downloads_used < g.max_downloads && (!g.expires_at || new Date(g.expires_at) > now) && g.sale_item_id && items.has(g.sale_item_id)
  );
  if (usable.length === 0) return new NextResponse("Nothing left to download.", { status: 410 });

  // Cheap filename lookup (no rendering) so the archive's name list is ready at stream start.
  const photoIds = usable.map((g) => items.get(g.sale_item_id!)!.photo_id).filter((x): x is string => !!x);
  const assetIds = usable.map((g) => items.get(g.sale_item_id!)!.asset_id).filter((x): x is string => !!x);
  const fileIds = usable.map((g) => g.file_id).filter((x): x is string => !!x);
  const names = new Map<string, string>();
  if (photoIds.length) for (const r of rows<{ id: string; filename: string }>(await db()`select id, filename from photos where studio_id = ${sale.studio_id} and id = any(${photoIds}::uuid[])`)) names.set(r.id, r.filename);
  if (assetIds.length) for (const r of rows<{ id: string; filename: string }>(await db()`select id, filename from assets where studio_id = ${sale.studio_id} and id = any(${assetIds}::uuid[])`)) names.set(r.id, r.filename);
  const fileNames = new Map<string, string>();
  if (fileIds.length) for (const r of rows<{ id: string; filename: string }>(await db()`select id, filename from digital_files where studio_id = ${sale.studio_id} and id = any(${fileIds}::uuid[])`)) fileNames.set(r.id, r.filename);

  const meta = { ip: clientIp(request.headers), ua: request.headers.get("user-agent") };
  const entries = usable.map((g) => {
    const item = items.get(g.sale_item_id!) as SaleItem;
    return {
      // Digital files keep their real name (no .jpg forcing); images use the tier-aware name.
      name: g.file_id ? safeFilename(fileNames.get(g.file_id) ?? "download", "download") : entryName(names.get(item.photo_id ?? item.asset_id ?? ""), g.resolution),
      read: async () => {
        const file = await resolveGrantFile(g, item);
        if (!file) throw new Error("missing file");
        await recordGrantDownload(g, { ...meta, bytes: file.bytes });
        return file.body;
      },
    };
  });

  return new NextResponse(zipStream(entries) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="order-${sale.order_number}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
