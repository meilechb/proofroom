import { requireStudioPage } from "@/lib/auth";
import { listPackages } from "@/lib/packages";
import { formatMoney } from "@/lib/types";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { PackageDialog } from "./package-dialog";
import { archivePackageAction } from "./actions";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
  const ctx = await requireStudioPage("admin");
  const packages = await listPackages(ctx.studio.id);
  const cur = ctx.studio.currency;

  return (
    <>
      <PageHeader title="Packages" description="What you offer and what it costs. Sessions and your booking page start from these." actions={<PackageDialog trigger="add" />} />
      {packages.length === 0 ? (
        <EmptyState title="No packages yet" description="Add your first package: a name, a price, a deposit and how many finished photos are included." action={<PackageDialog trigger="add" />} />
      ) : (
        <ul className="space-y-3">
          {packages.map((p) => (
            <li key={p.id} className="card card-pad flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{p.name}</h2>
                  {p.is_featured ? <Badge tone="brand">Featured</Badge> : null}
                  {!p.is_active ? <Badge>Archived</Badge> : null}
                </div>
                {p.description ? <p className="mt-0.5 text-sm text-ink-2 line-clamp-1">{p.description}</p> : null}
                <p className="mt-1 text-xs text-muted">
                  {formatMoney(p.price_cents, cur)}
                  {p.deposit_cents > 0 ? ` · ${formatMoney(p.deposit_cents, cur)} deposit` : ""}
                  {p.included_finals > 0 ? ` · ${p.included_finals} included` : ""}
                  {p.extra_final_cents > 0 ? ` · ${formatMoney(p.extra_final_cents, cur)}/extra` : ""}
                  {p.turnaround ? ` · ${p.turnaround}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PackageDialog pkg={p} trigger="edit" />
                <form action={archivePackageAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={p.is_active ? "false" : "true"} />
                  <button className="text-xs text-muted hover:text-ink">{p.is_active ? "Archive" : "Restore"}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
