import type { Metadata } from "next";
import Link from "next/link";
import { requireStudioPage } from "@/lib/auth";
import { listImports } from "@/lib/imports";
import { IMPORT_SOURCES, type ImportSource } from "@/lib/imports/sources";
import { PageHeader, Card, Badge } from "@/components/ui";
import { formatDate } from "@/lib/types";
import { newImportAction } from "./actions";

export const metadata: Metadata = { title: "Import" };

const STATUS_TONE: Record<string, "brand" | "success" | "warning" | "neutral"> = { uploading: "warning", scanning: "warning", review: "brand", running: "brand", done: "success", failed: "neutral", cancelled: "neutral" };

/** Short marks and blurbs shown on the source cards (design handoff C11). */
const SOURCE_META: Record<ImportSource, { mark: string; blurb: string }> = {
  pixieset: { mark: "Px", blurb: "Galleries and clients from your Pixieset account." },
  pictime: { mark: "Pt", blurb: "Bring collections and contacts across." },
  shootproof: { mark: "Sp", blurb: "Import galleries and your client list." },
  zip: { mark: "Z", blurb: "Upload exported gallery zips, up to 5 GB each." },
  csv: { mark: "Cs", blurb: "A spreadsheet of names and emails." },
};

const IMPORT_STEPS = ["How to export", "Upload zips or CSV", "Scanning your files", "Review & assign clients", "Importing → finished"];

/** Import hub: start a new import or pick up a recent one (plan 21.1). */
export default async function ImportPage() {
  const ctx = await requireStudioPage("admin");
  const imports = await listImports(ctx.studio.id);

  return (
    <>
      <PageHeader title="Import" description="Bring galleries and clients over from another tool. Files are processed in the background." />

      <h2 className="font-display text-xl mb-3">Start a new import</h2>
      <form action={newImportAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(IMPORT_SOURCES) as [ImportSource, (typeof IMPORT_SOURCES)[ImportSource]][]).map(([key, s]) => (
          <button key={key} name="source" value={key} type="submit" className="text-left rounded-[var(--radius-card)] border-[1.5px] border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-brand transition flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand text-brand-ink font-display text-lg" aria-hidden>{SOURCE_META[key].mark}</span>
              {!s.verified ? <Badge tone="warning">Steps unverified</Badge> : null}
            </div>
            <span className="font-medium">{s.name}</span>
            <span className="text-[13px] leading-snug text-muted">{SOURCE_META[key].blurb}</span>
          </button>
        ))}
      </form>

      <h2 className="font-display text-xl mt-9 mb-3">How it works</h2>
      <Card>
        <ol className="flex flex-wrap items-start gap-2">
          {IMPORT_STEPS.map((label, i) => (
            <li key={label} className="flex min-w-[130px] flex-1 flex-col items-center gap-2 text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-ink text-[13px] font-semibold">{i + 1}</span>
              <span className="text-[13px] font-medium leading-snug text-ink-2">{label}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink-2">
        <div className="rounded-[12px] border border-line bg-surface-2 px-5 py-4"><b className="text-ink">Client list (CSV)</b> — At least a name and email column. We match existing clients by email so nothing is duplicated.</div>
        <div className="rounded-[12px] border border-line bg-surface-2 px-5 py-4"><b className="text-ink">Zip files</b> — Up to 5 GB each. Runs in the background; you can leave this page and we&rsquo;ll email you when it&rsquo;s done.</div>
      </div>

      {imports.length ? (
        <Card className="mt-6">
          <h2 className="font-medium">Recent imports</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {imports.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5">
                <Link href={`/studio/import/${i.id}`} className="font-medium hover:underline">{IMPORT_SOURCES[i.source]?.name ?? i.source}</Link>
                <span className="flex items-center gap-3 text-muted">
                  <span>{i.processed_count}/{i.photo_count} photos · {i.gallery_count} galleries</span>
                  <span>{formatDate(i.created_at, { month: "short", day: "numeric" })}</span>
                  <Badge tone={STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
