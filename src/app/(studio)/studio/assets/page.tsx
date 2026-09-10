import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listAssets, countAssets, type AssetSort } from "@/lib/assets";
import { getUsage } from "@/lib/usage";
import { PageHeader, EmptyState, Card } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { AssetsUploader } from "./assets-uploader";
import { AssetsFilters } from "./assets-filters";
import { AssetsBrowser } from "./assets-browser";

export const metadata: Metadata = { title: "Assets" };

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** The studio asset library (plan 15.1, 15.4, 15.7). */
export default async function AssetsPage({ searchParams }: PageProps<"/studio/assets">) {
  const ctx = await requireStudioPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const folder = typeof sp.folder === "string" ? sp.folder : undefined;
  const sort = (typeof sp.sort === "string" ? sp.sort : "recent") as AssetSort;
  const [assets, total, usage] = await Promise.all([
    listAssets(ctx.studio.id, { q, folder, sort }),
    countAssets(ctx.studio.id),
    getUsage(ctx.studio.id),
  ]);
  const filtering = Boolean(q || folder);

  return (
    <div>
      <PageHeader
        title="Assets"
        description="Photos and images for your website, portfolio and emails. These are public."
        actions={<span className="text-sm text-muted">{total} asset{total === 1 ? "" : "s"} · {formatBytes(usage.storageBytes)} stored</span>}
      />

      <Card className="mb-6">
        <AssetsUploader />
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <SearchInput placeholder="Search by name, tag or alt text" className="w-full sm:w-80" />
        <AssetsFilters />
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title={filtering ? "No matching assets" : "No assets yet"}
          description={filtering ? "Try a different search or folder." : "Upload photos above to use them on your website and in your portfolio."}
        />
      ) : (
        <AssetsBrowser assets={assets} />
      )}
    </div>
  );
}
