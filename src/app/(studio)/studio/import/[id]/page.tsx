import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { getImport } from "@/lib/imports";
import { IMPORT_SOURCES } from "@/lib/imports/sources";
import { db, rows } from "@/lib/db";
import { PageHeader, Card, Badge, ButtonLink } from "@/components/ui";
import { ImportUploader } from "./import-uploader";
import { CsvUploader } from "./csv-uploader";
import { MappingEditor } from "./mapping-editor";
import { RunningView } from "./running-view";
import { CancelImport } from "./cancel-import";

export const metadata: Metadata = { title: "Import" };

export default async function ImportWizardPage({ params }: PageProps<"/studio/import/[id]">) {
  const ctx = await requireStudioPage("admin");
  const { id } = await params;
  const imp = await getImport(ctx.studio.id, id);
  if (!imp) notFound();
  const src = IMPORT_SOURCES[imp.source];
  const errors = imp.log.filter((l) => /could not|skipped|failed/i.test(l));

  return (
    <>
      <PageHeader
        eyebrow="Import"
        title={src?.name ?? imp.source}
        actions={imp.status === "uploading" || imp.status === "scanning" || imp.status === "review" || imp.status === "running" ? <CancelImport importId={imp.id} /> : <ButtonLink href="/studio/import" variant="ghost">All imports</ButtonLink>}
      />

      {imp.status === "uploading" ? (
        <div className="space-y-6">
          <Card>
            <h2 className="font-medium">How to export from {src?.name}</h2>
            {src && !src.verified ? <p className="mt-1 text-xs text-warning">These steps are our best understanding and not confirmed against {src.name}. Check as you go.</p> : null}
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">{src?.instructions.map((line, i) => <li key={i}>{line}</li>)}</ol>
          </Card>
          {imp.source === "csv" ? (
            <Card><h2 className="font-medium">Upload your contacts CSV</h2><p className="mt-1 text-sm text-ink-2">At least a name and email column. We match existing clients by email so nothing is duplicated.</p><div className="mt-4"><CsvUploader importId={imp.id} /></div></Card>
          ) : (
            <Card>
              <h2 className="font-medium">Upload your zip files</h2>
              <p className="mt-1 text-sm text-ink-2">{imp.file_count} file{imp.file_count === 1 ? "" : "s"} uploaded so far. Add all the zips, then scan.</p>
              <div className="mt-4"><ImportUploader importId={imp.id} fileCount={imp.file_count} /></div>
            </Card>
          )}
        </div>
      ) : null}

      {imp.status === "scanning" ? <Card><p className="text-sm text-ink-2">Scanning your files…</p></Card> : null}

      {imp.status === "review" ? (
        <MappingEditor importId={imp.id} galleries={imp.mapping.galleries} clients={await clientOptions(ctx.studio.id)} />
      ) : null}

      {imp.status === "running" ? <RunningView importId={imp.id} processed={imp.processed_count} total={imp.photo_count} galleries={imp.gallery_count} log={imp.log} /> : null}

      {imp.status === "done" ? (
        <Card>
          <div className="flex items-center gap-2"><Badge tone="success">Finished</Badge></div>
          <p className="mt-3 text-sm">
            {imp.source === "csv"
              ? `${imp.processed_count} new client${imp.processed_count === 1 ? "" : "s"} imported.`
              : `${imp.gallery_count} galleries and ${imp.processed_count} photos were created as drafts.`}
          </p>
          {errors.length ? (
            <details className="mt-3 text-sm"><summary className="cursor-pointer text-warning">{errors.length} issue{errors.length === 1 ? "" : "s"} during import</summary><ul className="mt-2 space-y-1 text-xs text-muted">{errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}</ul></details>
          ) : null}
          <div className="mt-5 flex gap-2">
            <ButtonLink href={imp.source === "csv" ? "/studio/clients" : "/studio/galleries"}>{imp.source === "csv" ? "Open clients" : "Open galleries"}</ButtonLink>
            <ButtonLink href="/studio/import" variant="secondary">New import</ButtonLink>
          </div>
        </Card>
      ) : null}

      {imp.status === "failed" || imp.status === "cancelled" ? (
        <Card><p className="text-sm text-ink-2">This import was {imp.status}. <Link href="/studio/import" className="underline">Start a new one</Link>.</p></Card>
      ) : null}
    </>
  );
}

async function clientOptions(studioId: string) {
  return rows<{ id: string; name: string; email: string }>(await db()`select id, name, email from clients where studio_id = ${studioId} and not archived order by name limit 1000`);
}
