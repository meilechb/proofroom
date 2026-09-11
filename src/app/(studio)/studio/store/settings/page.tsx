import { requireStudioPage } from "@/lib/auth";
import { canTakeCardPayments } from "@/lib/connect";
import { storeSettings } from "@/lib/store-shared";
import { PageHeader } from "@/components/ui";
import { UpgradeLock } from "@/components/studio/upgrade-lock";
import { StoreSettingsForm } from "./settings-form";

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
  return (
    <>
      <PageHeader title="Store settings" description="How buyers pay, and how purchased files are delivered." />
      <StoreSettingsForm settings={settings} stripeReady={stripeReady} />
    </>
  );
}
