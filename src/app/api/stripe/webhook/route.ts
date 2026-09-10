import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { applySubscription, applySubscriptionDeleted, invoiceSubscriptionId, isFirstPaidInvoice, studioIdForCustomer } from "@/lib/billing";
import { onFirstPaidInvoice, markQueuedRewardApplied, pendingRewardFor, voidForRefund } from "@/lib/referrals-server";
import { sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from "@/lib/emails/billing";
import { log } from "@/lib/logger";

/**
 * Platform account events: the $40/month subscription (plan 6.5). Verified
 * with STRIPE_WEBHOOK_SECRET; each event id is processed once (stripe_events).
 */
export async function POST(request: NextRequest) {
  const secret = env.stripeWebhookSecret();
  if (!secret) return new NextResponse("Webhook secret not configured", { status: 500 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    log.warn("stripe.webhook_bad_signature", { error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("Bad signature", { status: 400 });
  }
  const fresh = await db()`insert into stripe_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
  if (fresh.length === 0) return NextResponse.json({ received: true, duplicate: true });
  try {
    await handle(event);
    await db()`update stripe_events set processed_at = now() where id = ${event.id}`;
  } catch (error) {
    log.error("stripe.webhook_failed", { type: event.type, id: event.id, error: error instanceof Error ? error.message : String(error) });
    await db()`delete from stripe_events where id = ${event.id}`; // let Stripe retry
    return new NextResponse("Handler failed", { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function ownerEmail(studioId: string) {
  const row = (await db()`select u.email, s.name, s.current_period_end from memberships m join users u on u.id = m.user_id join studios s on s.id = m.studio_id where m.studio_id = ${studioId} and m.role = 'owner' order by m.created_at limit 1`)[0] as { email: string; name: string; current_period_end: string | null } | undefined;
  return row ?? null;
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!subId) return;
      const sub = await stripe().subscriptions.retrieve(subId);
      const studioId = await applySubscription(sub);
      if (studioId) {
        const pending = await pendingRewardFor(studioId);
        if (pending) await markQueuedRewardApplied(pending.id); // coupon was applied at checkout
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await applySubscription(event.data.object);
      return;
    case "customer.subscription.deleted": {
      const studioId = await applySubscriptionDeleted(event.data.object);
      if (studioId) {
        const owner = await ownerEmail(studioId);
        if (owner) await sendSubscriptionCancelledEmail(owner.email, owner.name, null).catch(() => undefined);
      }
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      const studioId = (invoice.parent?.subscription_details?.metadata?.studio_id as string | undefined) ?? (await studioIdForCustomer(customer));
      if (!studioId) return;
      const subId = invoiceSubscriptionId(invoice);
      if (subId) await applySubscription(await stripe().subscriptions.retrieve(subId));
      if (isFirstPaidInvoice(invoice)) await onFirstPaidInvoice(studioId, invoice.id);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      const studioId = await studioIdForCustomer(customer);
      if (!studioId) return;
      await db()`update studios set subscription_status = 'past_due' where id = ${studioId} and subscription_status in ('active', 'trialing')`;
      const owner = await ownerEmail(studioId);
      if (owner) await sendPaymentFailedEmail(owner.email, owner.name).catch(() => undefined);
      return;
    }
    case "charge.refunded":
    case "charge.dispute.created": {
      // Void a referral reward if the referred studio's first invoice is refunded or disputed (plan 20.8).
      let customer: string | null = null;
      if (event.type === "charge.refunded") {
        const charge = event.data.object;
        customer = typeof charge.customer === "string" ? charge.customer : null;
      } else {
        const dispute = event.data.object;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        if (chargeId) {
          const charge = await stripe().charges.retrieve(chargeId);
          customer = typeof charge.customer === "string" ? charge.customer : null;
        }
      }
      const studioId = await studioIdForCustomer(customer);
      if (studioId) await voidForRefund(studioId).catch((e) => log.warn("referral.void_failed", { studio: studioId, error: e instanceof Error ? e.message : String(e) }));
      return;
    }
    default:
      log.info("stripe.webhook_ignored", { type: event.type });
  }
}
