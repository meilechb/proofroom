import Link from "next/link";
import type { Entitlements } from "@/lib/plans";
import type { Studio } from "@/lib/types";
import type { CurrentUser } from "@/lib/auth";
import { ResendVerification } from "@/components/studio/resend-verification";

export function Banners({ user, studio, entitlements }: { user: CurrentUser; studio: Studio; entitlements: Entitlements }) {
  const items: React.ReactNode[] = [];
  if (!user.email_verified_at) {
    items.push(
      <span key="verify">
        Confirm your email address to send galleries and payment links. <ResendVerification />
      </span>
    );
  }
  if (entitlements.trialing) {
    items.push(
      <span key="trial">
        Pro trial: {entitlements.trialDaysLeft} day{entitlements.trialDaysLeft === 1 ? "" : "s"} left. <Link href="/studio/billing" className="underline">Choose a plan</Link>
      </span>
    );
  }
  if (entitlements.delinquent) {
    items.push(
      <span key="delinquent">
        Your last subscription payment failed. <Link href="/studio/billing" className="underline">Update your card</Link> to keep uploading.
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
