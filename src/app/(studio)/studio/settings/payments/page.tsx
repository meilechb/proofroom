import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { configured, env } from "@/lib/env";
import { isTestMode } from "@/lib/stripe";
import { refreshAccountStatus } from "@/lib/connect";
import { Badge, Card, Notice } from "@/components/ui";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { ManualPaymentsForm } from "./manual-form";
import { disconnectStripeAction } from "./actions";

export const metadata: Metadata = { title: "Payments" };

/** Three states: not connected, connecting, connected (plan 7.1). */
export default async function PaymentsSettingsPage({ searchParams }: PageProps<"/studio/settings/payments">) {
  const ctx = await requireStudioPage("admin");
  const sp = await searchParams;
  let studio = ctx.studio;
  if (studio.stripe_account_id && configured.stripe() && (sp.refresh === "1" || !studio.stripe_charges_enabled)) {
    try {
      await refreshAccountStatus(studio.id, studio.stripe_account_id);
      studio = { ...studio, ...(await (await import("@/lib/db")).db()`select stripe_charges_enabled, stripe_details_submitted, stripe_account_status from studios where id = ${studio.id}`)[0] as Partial<typeof studio> };
    } catch {
      // show what we have
    }
  }
  const stripeReady = configured.stripe();
  const oauthReady = Boolean(env.stripeConnectClientId());
  const connected = Boolean(studio.stripe_account_id);
  const enabled = connected && studio.stripe_charges_enabled;
  return (
    <div className="max-w-3xl space-y-6">
      {sp.connected === "1" ? <Notice tone="success">Stripe is connected. Payment links now take cards.</Notice> : null}
      {sp.error ? <Notice tone="danger">{describeError(String(sp.error))}</Notice> : null}
      {isTestMode() && stripeReady ? <Notice tone="warning">This deployment uses Stripe test keys. Use test cards; no real money moves.</Notice> : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Card payments</h2>
            <p className="mt-1 text-sm text-ink-2 max-w-xl">
              Payments go straight to <strong>your</strong> Stripe account. We never hold your money and never take a cut. Refunds and disputes are handled in your own Stripe Dashboard, and Stripe bills you its normal card fees directly.
            </p>
          </div>
          {enabled ? <Badge tone="success">Connected</Badge> : connected ? <Badge tone="warning">Finish setup</Badge> : <Badge>Not connected</Badge>}
        </div>

        {!connected ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-4">
              <h3 className="font-medium text-sm">Already use Stripe?</h3>
              <p className="mt-1 text-xs text-ink-2">Connect the account you have. Stripe asks you to sign in and approve the connection.</p>
              <form action="/api/connect/oauth/start" method="post" className="mt-3">
                <button className="btn-primary btn-sm" disabled={!stripeReady || !oauthReady}>Connect existing Stripe account</button>
              </form>
              {!oauthReady && stripeReady ? <p className="hint text-warning">Connect OAuth is not configured yet (STRIPE_CONNECT_CLIENT_ID).</p> : null}
            </div>
            <div className="rounded-lg border border-line p-4">
              <h3 className="font-medium text-sm">New to Stripe?</h3>
              <p className="mt-1 text-xs text-ink-2">Create a free Stripe account in a few minutes. Stripe collects your details and pays out to your bank.</p>
              <form action="/api/connect/onboard" method="post" className="mt-3">
                <button className="btn-secondary btn-sm" disabled={!stripeReady}>Create a Stripe account</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3 text-sm">
            <dl className="grid gap-2 sm:grid-cols-3">
              <div><dt className="text-muted">Account</dt><dd className="font-mono text-xs">{studio.stripe_account_id}</dd></div>
              <div><dt className="text-muted">Card payments</dt><dd>{studio.stripe_charges_enabled ? "Enabled" : "Not yet enabled"}</dd></div>
              <div><dt className="text-muted">Connected via</dt><dd>{studio.stripe_connect_method === "oauth" ? "Existing account" : "New account"}</dd></div>
            </dl>
            {!enabled ? (
              <Notice tone="warning">
                Stripe still needs some details before this account can take payments.
                <form action="/api/connect/onboard" method="post" className="mt-2"><button className="btn-primary btn-sm">Finish setup in Stripe</button></form>
              </Notice>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Open your Stripe Dashboard</a>
              <a href="/studio/settings/payments?refresh=1" className="btn-ghost btn-sm">Refresh status</a>
              <form action={disconnectStripeAction}>
                <ConfirmButton variant="ghost" size="sm" confirm="Disconnect Stripe? Existing payment records stay. New payment links will not take cards until you connect again.">Disconnect</ConfirmButton>
              </form>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-medium">Collect payment yourself instead</h2>
        <p className="mt-1 text-sm text-ink-2">For studios that prefer cash, transfer or their own payment link. Sessions are marked paid by hand.</p>
        <div className="mt-4">
          <ManualPaymentsForm enabled={studio.stripe_connect_method === "manual" || Boolean(studio.manual_payment_instructions || studio.manual_payment_link)} instructions={studio.manual_payment_instructions ?? ""} link={studio.manual_payment_link ?? ""} />
        </div>
      </Card>
    </div>
  );
}

function describeError(code: string) {
  switch (code) {
    case "access_denied": return "You declined the connection in Stripe. Nothing changed.";
    case "state": return "That connection link expired. Start again from this page.";
    case "stripe": return "Stripe returned an error. Try again in a moment.";
    default: return "Something went wrong connecting Stripe. Try again.";
  }
}
