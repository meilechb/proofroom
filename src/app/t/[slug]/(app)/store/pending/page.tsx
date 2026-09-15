import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { getSale } from "@/lib/store";
import { storeSettings } from "@/lib/store-shared";
import { formatMoney } from "@/lib/types";

export const metadata = { robots: { index: false, follow: false } };

export default async function StorePendingPage({ params, searchParams }: PageProps<"/t/[slug]/store/pending">) {
  const { slug } = await params;
  const sp = await searchParams;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const saleId = typeof sp?.sale === "string" ? sp.sale : "";
  const sale = saleId ? await getSale(studio.id, saleId) : null;
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);

  return (
    <div className="mx-auto w-full max-w-md px-5 py-20">
      <h1 className="text-2xl font-semibold text-center" style={{ fontFamily: "var(--site-font-heading)" }}>Order placed</h1>
      {sale ? <p className="mt-2 text-center text-[var(--site-ink-2)]">Order #{sale.order_number} · {formatMoney(sale.total_cents, sale.currency)}</p> : null}
      <div className="mt-6 rounded-xl border border-[var(--site-line)] p-4 text-sm text-[var(--site-ink-2)] whitespace-pre-wrap">
        {settings.manualInstructions || `Thank you! ${studio.name} will be in touch about payment. You'll receive your download link once payment is confirmed.`}
      </div>
      {settings.manualPaymentLink ? (
        <a href={settings.manualPaymentLink} className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] h-11 text-sm font-medium">Pay now</a>
      ) : null}
    </div>
  );
}
