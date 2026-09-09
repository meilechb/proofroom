import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { applySubscription } from "@/lib/billing";
import { configured } from "@/lib/env";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Subscription started" };

/** Landing after Checkout (plan 6.4). The webhook is the source of truth; this just syncs early for a snappy page. */
export default async function BillingSuccessPage({ searchParams }: PageProps<"/studio/billing/success">) {
  const ctx = await requireStudioPage("admin");
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  if (sessionId && configured.stripe()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
      if (session.client_reference_id === ctx.studio.id && session.subscription && typeof session.subscription !== "string") await applySubscription(session.subscription);
    } catch {
      // the webhook will catch up
    }
  }
  return (
    <div className="max-w-xl">
      <Card>
        <h1 className="text-xl font-semibold">You are all set</h1>
        <p className="mt-2 text-sm text-ink-2">Your subscription is active. Everything stays exactly as it is; there is nothing to move or re-enable. Invoices appear on the billing page and are emailed by Stripe.</p>
        <div className="mt-5 flex gap-2">
          <ButtonLink href="/studio">Back to the dashboard</ButtonLink>
          <ButtonLink href="/studio/billing" variant="secondary">Billing</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
