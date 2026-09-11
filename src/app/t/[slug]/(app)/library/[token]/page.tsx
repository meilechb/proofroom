import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { signLink, verifyLink } from "@/lib/tenant-tokens";
import { digitalFileNames, getSaleById, grantToken, listGrantsForSale, listPaidSalesForBuyer, listSaleItems } from "@/lib/store";
import { formatDate, formatMoney, storeLicenseLabels, storeResolutionLabels, type DownloadGrant } from "@/lib/types";
import { ResendForm } from "../resend-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function LibraryPage({ params }: PageProps<"/t/[slug]/library/[token]">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const saleId = verifyLink("download", token);
  const sale = saleId ? await getSaleById(saleId) : null;
  if (!saleId || !sale || sale.studio_id !== studio.id) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>This link has expired</h1>
        <p className="mt-3 text-[var(--site-ink-2)]">Enter your email to get a fresh link to your latest order.</p>
        <div className="mt-4 text-left"><ResendForm slug={slug} /></div>
      </div>
    );
  }

  const items = (await listSaleItems(sale.id)).filter((it) => it.kind !== "gift_card" && it.kind !== "voucher");
  const grants = await listGrantsForSale(sale.id);
  // A digital product mints one grant per file, so group grants by item rather
  // than assuming one each; image/photo items still have exactly one.
  const grantsByItem = new Map<string, DownloadGrant[]>();
  for (const g of grants) {
    if (!g.sale_item_id) continue;
    (grantsByItem.get(g.sale_item_id) ?? grantsByItem.set(g.sale_item_id, []).get(g.sale_item_id)!).push(g);
  }
  const fileNames = await digitalFileNames(studio.id, grants.map((g) => g.file_id).filter((x): x is string => !!x));
  const cur = sale.currency;
  const otherOrders = (await listPaidSalesForBuyer(studio.id, sale.buyer_email)).filter((s) => s.id !== sale.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-10">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Your downloads</h1>
      <p className="mt-1 text-[var(--site-ink-2)]">
        Order #{sale.order_number} · {formatMoney(sale.total_cents, cur)}
        {sale.paid_at ? ` · ${formatDate(sale.paid_at)}` : ""}
      </p>
      {sale.status === "paid" || sale.status === "partially_refunded" ? (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a href={`/license/${signLink("license", sale.id)}`} className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">View your licence &amp; print release →</a>
          {sale.receipt_url ? <a href={sale.receipt_url} className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]" target="_blank" rel="noreferrer">View receipt →</a> : null}
        </p>
      ) : null}

      {sale.status !== "paid" && sale.status !== "partially_refunded" ? (
        <p className="mt-6 text-[var(--site-ink-2)]">We&apos;re still confirming your payment. Refresh in a moment — your files appear here once it clears.</p>
      ) : (
        <>
          {grants.length > 1 ? (
            <p className="mt-6">
              <a href={`/api/store/library/${token}/zip`} className="inline-flex items-center rounded-lg border border-[var(--site-line)] px-3 h-9 text-sm hover:bg-[var(--site-bg-2)]">Download all (ZIP)</a>
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-[var(--site-line)] border-y border-[var(--site-line)]">
          {items.map((it) => {
            const gs = grantsByItem.get(it.id) ?? [];
            // Digital: one downloadable row per uploaded file, labelled by filename.
            if (it.kind === "digital") {
              return gs.map((g) => {
                const left = Math.max(0, g.max_downloads - g.downloads_used);
                const href = left > 0 ? `/api/store/download/${grantToken(g.id)}` : null;
                return (
                  <li key={g.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{(g.file_id && fileNames.get(g.file_id)) || "Download"}</p>
                      <p className="text-xs text-[var(--site-ink-2)]">{left} download{left === 1 ? "" : "s"} left</p>
                    </div>
                    {href ? (
                      <a href={href} className="inline-flex items-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-3 h-9 text-sm">Download</a>
                    ) : (
                      <span className="text-xs text-[var(--site-ink-2)]">Limit reached</span>
                    )}
                  </li>
                );
              });
            }
            const g = gs[0];
            const left = g ? Math.max(0, g.max_downloads - g.downloads_used) : 0;
            const href = g && left > 0 ? `/api/store/download/${grantToken(g.id)}` : null;
            return (
              <li key={it.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{storeResolutionLabels[it.resolution]}</p>
                  <p className="text-xs text-[var(--site-ink-2)]">
                    {storeLicenseLabels[it.license]}
                    {g ? ` · ${left} download${left === 1 ? "" : "s"} left` : ""}
                  </p>
                </div>
                {href ? (
                  <a href={href} className="inline-flex items-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-3 h-9 text-sm">Download</a>
                ) : (
                  <span className="text-xs text-[var(--site-ink-2)]">{g ? "Limit reached" : "Preparing…"}</span>
                )}
              </li>
            );
          })}
          </ul>
        </>
      )}

      {otherOrders.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-[var(--site-ink-2)]">Your other orders</h2>
          <ul className="mt-3 divide-y divide-[var(--site-line)] border-y border-[var(--site-line)]">
            {otherOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">Order #{o.order_number}</p>
                  <p className="text-xs text-[var(--site-ink-2)]">
                    {formatMoney(o.total_cents, o.currency)}
                    {o.paid_at ? ` · ${formatDate(o.paid_at)}` : ""}
                  </p>
                </div>
                <a href={`/library/${signLink("download", o.id)}`} className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">Open →</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
