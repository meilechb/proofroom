import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { signLink, verifyLink } from "@/lib/tenant-tokens";
import { getSaleById, grantToken, listGrantsForSale, listSaleItems } from "@/lib/store";
import { formatDate, formatMoney, storeLicenseLabels, storeResolutionLabels } from "@/lib/types";

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
        <p className="mt-3 text-[var(--site-ink-2)]">Ask {studio.name} to resend your download link.</p>
      </div>
    );
  }

  const items = await listSaleItems(sale.id);
  const grants = await listGrantsForSale(sale.id);
  const grantByItem = new Map(grants.map((g) => [g.sale_item_id, g]));
  const cur = sale.currency;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 py-10">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Your downloads</h1>
      <p className="mt-1 text-[var(--site-ink-2)]">
        Order #{sale.order_number} · {formatMoney(sale.total_cents, cur)}
        {sale.paid_at ? ` · ${formatDate(sale.paid_at)}` : ""}
      </p>
      {sale.status === "paid" ? (
        <p className="mt-2">
          <a href={`/license/${signLink("license", sale.id)}`} className="text-sm underline text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">View your licence &amp; print release →</a>
        </p>
      ) : null}

      {sale.status !== "paid" ? (
        <p className="mt-6 text-[var(--site-ink-2)]">We&apos;re still confirming your payment. Refresh in a moment — your files appear here once it clears.</p>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--site-line)] border-y border-[var(--site-line)]">
          {items.map((it) => {
            const g = grantByItem.get(it.id);
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
      )}
    </div>
  );
}
