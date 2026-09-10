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

/** Import hub: start a new import or pick up a recent one (plan 21.1). */
export default async function ImportPage() {
  const ctx = await requireStudioPage("admin");
  const imports = await listImports(ctx.studio.id);

  return (
    <>
      <PageHeader title="Import" description="Bring galleries and clients over from another tool. Files are processed in the background." />

      <Card>
        <h2 className="font-medium">Start a new import</h2>
        <form action={newImportAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(IMPORT_SOURCES) as [ImportSource, (typeof IMPORT_SOURCES)[ImportSource]][]).map(([key, s]) => (
            <button key={key} name="source" value={key} type="submit" className="text-left rounded-xl border border-line p-4 hover:border-ink-2 transition">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                {!s.verified ? <Badge tone="neutral">Steps unverified</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted">{key === "csv" ? "Upload a contacts CSV." : "Upload zip exports. Each folder or zip becomes a gallery."}</p>
            </button>
          ))}
        </form>
      </Card>

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
