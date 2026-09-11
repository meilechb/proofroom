import { requireStudioPage } from "@/lib/auth";
import { canTakeCardPayments } from "@/lib/connect";
import { storeSettings } from "@/lib/store-shared";
import { shopUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { StoreSettingsForm } from "./settings-form";
import { ShareShop } from "./share-shop";

export const metadata = { title: "Store settings" };

export default async function StoreSettingsPage() {
  const ctx = await requireStudioPage("admin");
  if (!ctx.entitlements.store) {
    return (
      <>
        <PageHeader title="Store settings" description="Sell your photos, packages and licences online." />
        <UpgradeLock title="Online store">Sell individual images, packages and whole-gallery unlocks, paid straight into your own Stripe.</UpgradeLock>
      </>
    );
  }
  const settings = storeSettings((ctx.studio.settings ?? {}) as Record<string, unknown>);
  const stripeReady = canTakeCardPayments(ctx.studio);
  const url = shopUrl(ctx.studio);
  const label = `Shop ${ctx.studio.name}`.slice(0, 60).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const snippet = `<a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111;color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none">${label}</a>`;
  return (
    <>
      <PageHeader title="Store settings" description="How buyers pay, and how purchased files are delivered." />
      <StoreSettingsForm settings={settings} stripeReady={stripeReady} />
      {settings.enabled ? <ShareShop shopUrl={url} snippet={snippet} /> : null}
    </>
  );
}
