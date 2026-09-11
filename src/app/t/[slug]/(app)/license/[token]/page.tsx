import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { getSaleById, saleLicenseLines } from "@/lib/store";
import { RM_DIMENSIONS } from "@/lib/store-shared";
import { formatDate, formatMoney, storeLicenseLabels, storeResolutionLabels, type StoreLicense } from "@/lib/types";
import { PrintButton } from "./print-button";

function usageText(scope: Record<string, unknown>): string {
  return RM_DIMENSIONS.map((d) => {
    const opt = d.options.find((o) => o.value === scope[d.key]);
    return opt ? `${d.label}: ${opt.label}` : null;
  }).filter(Boolean).join(" · ");
}

export const metadata = { robots: { index: false, follow: false } };

const licenseGrant: Record<StoreLicense, string> = {
  personal: "a non-exclusive, non-transferable licence to use the image(s) for personal, non-commercial purposes, including personal prints and sharing. Resale and commercial use are not permitted.",
  rf: "a non-exclusive, royalty-free licence to use the image(s) for commercial and personal purposes at the purchased resolution. Redistribution or resale of the file itself is not permitted.",
  rm: "a licence limited to the usage recorded at the time of purchase. Any other use requires a new licence.",
  extended: "an extended commercial licence as agreed with the studio.",
};

export default async function LicensePage({ params }: PageProps<"/t/[slug]/license/[token]">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const saleId = verifyLink("license", token);
  const sale = saleId ? await getSaleById(saleId) : null;
  if (!saleId || !sale || sale.studio_id !== studio.id) notFound();
  const lines = await saleLicenseLines(studio.id, sale.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 print:py-0">
      <div className="flex justify-end mb-6"><PrintButton /></div>
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Licence &amp; print release</h1>
      <p className="mt-1 text-sm text-[var(--site-ink-2)]">
        {studio.name} · Order #{sale.order_number}{sale.paid_at ? ` · ${formatDate(sale.paid_at)}` : ""}
      </p>
      <p className="mt-4 text-sm">
        Issued to <strong>{sale.buyer_name || sale.buyer_email}</strong> ({sale.buyer_email}) for a purchase of {formatMoney(sale.total_cents, sale.currency)}.
      </p>

      <div className="mt-6 space-y-5">
        {lines.map((l, i) => (
          <div key={i} className="border-t border-[var(--site-line)] pt-4">
            <p className="text-sm font-medium">
              {l.title} — {storeResolutionLabels[l.resolution]}
              {l.count > 1 ? ` · ${l.count} images` : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--site-ink-2)]">
              {storeLicenseLabels[l.license]}: {studio.name} grants the buyer {licenseGrant[l.license]}
            </p>
            {l.license === "rm" && usageText(l.usage_scope) ? (
              <p className="mt-1 text-sm"><strong>Permitted use:</strong> {usageText(l.usage_scope)}.</p>
            ) : null}
            {l.license_text ? <p className="mt-2 text-sm whitespace-pre-wrap">{l.license_text}</p> : null}
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-[var(--site-ink-2)]">
        Copyright in the image(s) remains with {studio.name}. This document is the buyer&apos;s proof of the licence purchased.
      </p>
    </div>
  );
}
