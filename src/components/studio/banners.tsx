import Link from "next/link";
import type { BillingState } from "@/lib/plans";
import type { Studio } from "@/lib/types";
import type { CurrentUser } from "@/lib/auth";
import { ResendVerification } from "@/components/studio/resend-verification";

export function Banners({ user, studio, billing }: { user: CurrentUser; studio: Studio; billing: BillingState }) {
  const items: React.ReactNode[] = [];
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
        Free trial: {billing.trialDaysLeft} day{billing.trialDaysLeft === 1 ? "" : "s"} left. <Link href="/studio/billing" className="underline">Start your subscription</Link> to keep everything running.
      </span>
    );
  }
  if (billing.status === "past_due") {
    items.push(
      <span key="past-due">
        Your last subscription payment failed. <Link href="/studio/billing" className="underline">Update your card</Link>.
      </span>
    );
  }
  if (billing.status === "read_only" || billing.status === "locked") {
    items.push(
      <span key="read-only">
        Your trial has ended and the studio is read-only{billing.status === "locked" ? "; client galleries are locked" : ""}. <Link href="/studio/billing" className="underline">Subscribe</Link> to continue.
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
