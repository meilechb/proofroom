import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdminPage } from "@/lib/auth";
import { studioForAdmin, studioState, type StudioState } from "@/lib/admin";
import { formatBytes } from "@/lib/assets-shared";
import { Card, Badge } from "@/components/ui";
import { StudioControls } from "./controls";

export const metadata: Metadata = { title: "Studio · Admin" };

const STATE_TONE: Record<StudioState, "neutral" | "success" | "warning" | "danger" | "brand"> = {
  trial: "brand", active: "success", past_due: "warning", comped: "brand", suspended: "danger", read_only: "warning", deleted: "danger",
};

export default async function AdminStudioDetail({ params }: PageProps<"/admin/studios/[id]">) {
  await requirePlatformAdminPage();
  const { id } = await params;
  const data = await studioForAdmin(id);
  if (!data) notFound();
  const { studio, counts } = data;
  const state = studioState(studio);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-ink">← Studios</Link>
          <h1 className="text-[28px] leading-tight font-normal mt-1 flex items-center gap-3">{studio.name} <Badge tone={STATE_TONE[state]}>{state.replace("_", " ")}</Badge></h1>
          <p className="mt-1 text-sm text-ink-2">{studio.slug} · owner {studio.owner_email ?? "—"}</p>
        </div>
      </div>

      <Card>
        <h2 className="text-lg font-medium mb-3">Overview</h2>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div><dt className="text-muted text-xs">Clients</dt><dd>{counts.clients}</dd></div>
          <div><dt className="text-muted text-xs">Sessions</dt><dd>{counts.orders}</dd></div>
          <div><dt className="text-muted text-xs">Galleries</dt><dd>{counts.galleries}</dd></div>
          <div><dt className="text-muted text-xs">Photos</dt><dd>{counts.photos}</dd></div>
          <div><dt className="text-muted text-xs">Storage</dt><dd>{formatBytes(Number(studio.storage_bytes))}</dd></div>
          <div><dt className="text-muted text-xs">Trial ends</dt><dd>{studio.trial_ends_at ? new Date(studio.trial_ends_at).toLocaleDateString() : "—"}</dd></div>
          <div><dt className="text-muted text-xs">Subscription</dt><dd>{studio.subscription_status ?? "—"}</dd></div>
          <div><dt className="text-muted text-xs">Stripe account</dt><dd className="font-mono text-xs">{studio.stripe_account_id ?? "—"}</dd></div>
          <div><dt className="text-muted text-xs">Created</dt><dd>{new Date(studio.created_at).toLocaleDateString()}</dd></div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-medium mb-3">Actions</h2>
        <StudioControls
          id={studio.id}
          flags={{ suspended: Boolean(studio.suspended_at), comped: studio.plan_override === "comped", readOnly: Boolean(studio.read_only_since), purging: Boolean(studio.purge_at) }}
        />
      </Card>
    </div>
  );
}
