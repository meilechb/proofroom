import Link from "next/link";
import { entitlements, formatBytes, type BillingState } from "@/lib/plans";
import type { Studio } from "@/lib/types";
import type { CurrentUser } from "@/lib/auth";
import { ResendVerification } from "@/components/studio/resend-verification";

export function Banners({ user, studio, billing }: { user: CurrentUser; studio: Studio; billing: BillingState }) {
  const items: React.ReactNode[] = [];
  const ent = entitlements(billing.effectivePlan);
  const overCap = ent.storageBytes !== null && studio.storage_bytes >= ent.storageBytes;
  if (!user.email_verified_at) {
    items.push(
      <span key="verify">
        Confirm your email address to send galleries and payment links. <ResendVerification />
      </span>
    );
  }
  if (billing.status === "trialing") {
    items.push(
      <span key="trial">
        Pro trial: {billing.trialDaysLeft} day{billing.trialDaysLeft === 1 ? "" : "s"} left, then your studio moves to the Free plan. <Link href="/studio/billing" className="underline">Upgrade to Pro</Link> to keep your team and Pro features.
      </span>
    );
  }
  if (billing.status === "past_due") {
    items.push(
      <span key="past-due">
        Your last Pro payment failed. <Link href="/studio/billing" className="underline">Update your card</Link> to avoid moving to the Free plan.
      </span>
    );
  }
  if (overCap) {
    items.push(
      <span key="over-cap">
        You&apos;ve reached your {formatBytes(ent.storageBytes ?? 0)} Free storage limit, so new uploads are paused. <Link href="/studio/billing" className="underline">Upgrade to Pro</Link> for uncapped storage, or remove some photos.
      </span>
    );
  }
  if (studio.stripe_account_status !== "enabled") {
    items.push(
      <span key="connect">
        Connect Stripe to take deposits and balances online. <Link href="/studio/settings/payments" className="underline">Set up payments</Link>
      </span>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="border-b border-line bg-warning-bg text-warning text-sm">
      <div className="container-x py-2 flex flex-col gap-1">{items}</div>
    </div>
  );
}
