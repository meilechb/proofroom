import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db, one } from "@/lib/db";
import { applyAccountSnapshot, clearConnection, studioIdForAccount } from "@/lib/connect";
import { recordCheckoutFailed, recordCheckoutPaid, recordDispute, recordRefund } from "@/lib/payments";
import { markSalePaid, mintGrants, recordStoreDisputeByCharge, recordStoreRefundByCharge } from "@/lib/store";
import { storeSettings } from "@/lib/store-shared";
import { signLink } from "@/lib/tenant-tokens";
import { storeLibraryUrl } from "@/lib/tenant";
import { recordClientEvent } from "@/lib/clients";
import { sendReceiptEmail, sendStoreDeliveryEmail } from "@/lib/emails/studio";
import { sendPlatformEmail } from "@/lib/email";
import { APP_NAME, appUrl } from "@/lib/env";
import { formatMoney } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * Events from studios' connected accounts (plan 7.11). The endpoint is created
 * with "Events from: Connected accounts"; every event carries `account`. We only
 * record what happened. Refunds and disputes are the studio's to handle.
 */
export async function POST(request: NextRequest) {
  const secret = env.stripeConnectWebhookSecret();
  if (!secret) return new NextResponse("Webhook secret not configured", { status: 500 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    log.warn("stripe.connect_webhook_bad_signature", { error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("Bad signature", { status: 400 });
  }
  const fresh = await db()`insert into stripe_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
  if (fresh.length === 0) return NextResponse.json({ received: true, duplicate: true });
  try {
    await handle(event, event.account ?? null);
    await db()`update stripe_events set processed_at = now() where id = ${event.id}`;
  } catch (error) {
    log.error("stripe.connect_webhook_failed", { type: event.type, id: event.id, error: error instanceof Error ? error.message : String(error) });
    await db()`delete from stripe_events where id = ${event.id}`;
    return new NextResponse("Handler failed", { status: 500 });
  }
  return NextResponse.json({ received: true });
}

type OrderInfo = { id: string; order_number: number; title: string; currency: string; client_id: string; client_name: string; client_email: string; studio_id: string; studio_name: string; studio_email: string };

async function orderInfo(orderId: string) {
  return one<OrderInfo>(
    await db()`
      select o.id, o.order_number, o.title, o.currency, o.client_id, c.name as client_name, c.email as client_email, s.id as studio_id, s.name as studio_name, s.email as studio_email
      from orders o join clients c on c.id = o.client_id join studios s on s.id = o.studio_id where o.id = ${orderId}`
  );
}

async function notifyStudio(studioId: string, subject: string, text: string) {
  const owner = one<{ email: string }>(await db()`select u.email from memberships m join users u on u.id = m.user_id where m.studio_id = ${studioId} and m.role = 'owner' order by m.created_at limit 1`);
  if (owner) await sendPlatformEmail({ to: owner.email, kind: "payment_notice", subject, text: `${text}\n\n${appUrl()}/studio/sessions\n\n${APP_NAME}` }).catch(() => undefined);
}

/** A store sale's Checkout completed: mark paid once, mint download grants, email the buyer their library link, notify the studio. */
async function handleStorePaid(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return; // async methods: wait for async_payment_succeeded
  const saleId = session.metadata?.sale_id ?? session.client_reference_id;
  if (!saleId) return;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const result = await markSalePaid(saleId, { paymentIntentId: pi });
  if (!result || !result.firstTime) return;
  const { sale } = result;
  const studio = one<{ id: string; slug: string; name: string; email: string; custom_domain: string | null; custom_domain_verified_at: string | null; settings: Record<string, unknown> }>(
    await db()`select id, slug, name, email, custom_domain, custom_domain_verified_at, settings from studios where id = ${sale.studio_id}`
  );
  if (!studio) return;
  const settings = storeSettings(studio.settings ?? {});
  await mintGrants(sale, { maxDownloads: settings.downloadMaxCount, windowHours: settings.downloadWindowHours });
  const url = storeLibraryUrl(studio, signLink("download", sale.id));
  const amount = formatMoney(sale.total_cents, sale.currency);
  await sendStoreDeliveryEmail({ id: studio.id, name: studio.name, email: studio.email }, { to: sale.buyer_email, buyerName: sale.buyer_name, amount, orderNumber: sale.order_number, url }).catch(() => undefined);
  await notifyStudio(sale.studio_id, `New sale: ${amount}`, `${sale.buyer_email} bought from your store (order #${sale.order_number}, ${amount}). It is in your Stripe account.`);
  if (sale.buyer_client_id) await recordClientEvent(sale.studio_id, sale.buyer_client_id, "store.order_placed", "sale", sale.id, `Bought ${amount} from the store (order #${sale.order_number})`).catch(() => undefined);
}

async function handle(event: Stripe.Event, accountId: string | null) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (event.data.object.metadata?.kind === "store") {
        await handleStorePaid(event.data.object);
        return;
      }
      const payment = await recordCheckoutPaid(event.data.object, accountId);
      if (!payment) return;
      const info = await orderInfo(payment.order_id);
      if (!info) return;
      const amount = formatMoney(payment.amount_cents, payment.currency);
      await recordClientEvent(info.studio_id, info.client_id, "payment.received", "payment", payment.id, `Paid ${amount} (${payment.kind}) for session #${info.order_number}`);
      await sendReceiptEmail({ id: info.studio_id, name: info.studio_name, email: info.studio_email }, { to: info.client_email, clientName: info.client_name, amount, title: info.title, orderNumber: info.order_number }).catch(() => undefined);
      await notifyStudio(info.studio_id, `${info.client_name} paid ${amount}`, `${info.client_name} paid ${amount} (${payment.kind}) for "${info.title}" (session #${info.order_number}). It is in your Stripe account.`);
      return;
    }
    case "checkout.session.async_payment_failed": {
      const payment = await recordCheckoutFailed(event.data.object, "The bank payment did not go through.");
      if (!payment) return;
      const info = await orderInfo(payment.order_id);
      if (info) await notifyStudio(info.studio_id, `Payment failed for session #${info.order_number}`, `A payment of ${formatMoney(payment.amount_cents, payment.currency)} from ${info.client_name} did not go through. You may want to send the payment link again.`);
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
      const storeSale = await recordStoreRefundByCharge({ id: charge.id, paymentIntentId: pi, totalRefunded: charge.amount_refunded, receiptUrl: charge.receipt_url });
      if (storeSale) {
        await notifyStudio(storeSale.studio_id, `Refund on store order #${storeSale.order_number}`, `You refunded ${formatMoney(storeSale.refunded_cents, storeSale.currency)} on store order #${storeSale.order_number}. The buyer's downloads are ${storeSale.status === "refunded" ? "revoked" : "still available"}.`);
        return;
      }
      const payment = await recordRefund(charge);
      if (!payment) return;
      const info = await orderInfo(payment.order_id);
      if (info) await recordClientEvent(info.studio_id, info.client_id, "payment.refunded", "payment", payment.id, `Refunded ${formatMoney(payment.refunded_cents, payment.currency)} on session #${info.order_number}`);
      return;
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const dispute = event.data.object;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
      const dpi = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;
      const storeSale = await recordStoreDisputeByCharge(chargeId, dpi, dispute.status);
      if (storeSale) {
        if (event.type === "charge.dispute.created") await notifyStudio(storeSale.studio_id, "A store payment was disputed", `A card dispute (${dispute.reason}) was opened on store order #${storeSale.order_number}. Respond in your Stripe Dashboard: https://dashboard.stripe.com/disputes`);
        return;
      }
      const payment = await recordDispute(dispute);
      if (!payment) return;
      const info = await orderInfo(payment.order_id);
      if (info && event.type === "charge.dispute.created") {
        await recordClientEvent(info.studio_id, info.client_id, "payment.disputed", "payment", payment.id, `Payment disputed (${dispute.reason}) on session #${info.order_number}`);
        await notifyStudio(info.studio_id, `A payment was disputed`, `${info.client_name}'s card issuer opened a dispute (${dispute.reason}) on ${formatMoney(payment.amount_cents, payment.currency)} for session #${info.order_number}. Respond in your Stripe Dashboard: https://dashboard.stripe.com/disputes`);
      }
      return;
    }
    case "account.updated": {
      const account = event.data.object;
      const studioId = await studioIdForAccount(account.id);
      if (studioId) await applyAccountSnapshot(studioId, account);
      return;
    }
    case "account.application.deauthorized": {
      const studioId = await studioIdForAccount(accountId);
      if (!studioId) return;
      await clearConnection(studioId);
      await notifyStudio(studioId, "Stripe was disconnected", `Your Stripe account was disconnected from ${APP_NAME}. Payment links will not take cards until you connect again in Settings → Payments.`);
      return;
    }
    default:
      log.info("stripe.connect_webhook_ignored", { type: event.type });
  }
}
