import "server-only";

import type Stripe from "stripe";
import { db, one, rows } from "@/lib/db";
import { onAccount, stripe } from "@/lib/stripe";
import { canTakeCardPayments } from "@/lib/connect";
import { payUrl } from "@/lib/tenant";
import { orderMoney, type Order, type Payment, type PaymentKind, type PaymentStatus, type Studio } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * Client payments. Every charge is a direct charge on the studio's own Stripe
 * account (Stripe-Account header), with no application fee. The platform only
 * records what happened so the order shows the right state.
 */

export type CheckoutKind = Exclude<PaymentKind, "manual">;

type PayStudio = Pick<Studio, "id" | "slug" | "name" | "currency" | "custom_domain" | "custom_domain_verified_at" | "stripe_account_id" | "stripe_charges_enabled">;

export async function listPayments(orderId: string) {
  return rows<Payment>(await db()`select * from payments where order_id = ${orderId} order by created_at asc`);
}

/** Amount for a checkout kind, or null when nothing is due for it. */
export function amountForKind(order: Pick<Order, "amount_cents" | "deposit_cents" | "included_finals" | "extra_final_cents">, payments: Pick<Payment, "amount_cents" | "status" | "refunded_cents">[], picks: number, kind: CheckoutKind) {
  const money = orderMoney(order, payments, picks);
  if (kind === "deposit") return money.deposit_due_cents > 0 ? money.deposit_due_cents : null;
  return money.due_cents > 0 ? money.due_cents : null;
}

/**
 * Creates a Stripe Checkout Session on the studio's account and a pending
 * payment row. Returns the Checkout URL.
 */
export async function createOrderCheckout(
  studio: PayStudio,
  order: Order,
  client: { name: string; email: string },
  kind: CheckoutKind,
  amountCents: number,
  urls: { successUrl: string; cancelUrl: string }
) {
  if (!canTakeCardPayments(studio) || !studio.stripe_account_id) throw new Error("This studio is not set up for card payments yet.");
  if (amountCents <= 0) throw new Error("Nothing is due.");
  const label = kind === "deposit" ? "Retainer" : kind === "balance" ? "Balance" : "Session fee";
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: order.id,
      customer_email: client.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: studio.currency || order.currency || "usd",
            unit_amount: amountCents,
            product_data: { name: `${label}: ${order.title}`, description: `Order #${order.order_number} with ${studio.name}` },
          },
        },
      ],
      payment_intent_data: { description: `Order #${order.order_number} ${label.toLowerCase()} for ${client.name}` },
      metadata: { order_id: order.id, studio_id: studio.id, kind },
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
    },
    onAccount(studio.stripe_account_id)
  );
  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  await db()`
    insert into payments (studio_id, order_id, kind, amount_cents, currency, status, method, stripe_account_id, stripe_checkout_session_id)
    values (${studio.id}, ${order.id}, ${kind}, ${amountCents}, ${session.currency ?? "usd"}, 'pending', 'card', ${studio.stripe_account_id}, ${session.id})
    on conflict (stripe_checkout_session_id) do nothing`;
  return session.url;
}

export function defaultPayUrls(studio: PayStudio, orderId: string) {
  const base = payUrl(studio, orderId);
  return { successUrl: `${base}/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}?cancelled=1` };
}

function idOf(v: string | { id: string } | null | undefined) {
  return typeof v === "string" ? v : v?.id ?? null;
}

/** checkout.session.completed / async_payment_succeeded on the studio's account. */
export async function recordCheckoutPaid(session: Stripe.Checkout.Session, accountId: string | null) {
  if (session.mode !== "payment") return null;
  if (session.payment_status !== "paid") return null; // async methods: wait for async_payment_succeeded
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  const studioId = session.metadata?.studio_id;
  const kind = (session.metadata?.kind as CheckoutKind | undefined) ?? "full";
  const paymentIntent = idOf(session.payment_intent);
  const updated = one<Payment>(
    await db()`
      update payments set status = 'paid', paid_at = coalesce(paid_at, now()), stripe_payment_intent_id = ${paymentIntent}
      where stripe_checkout_session_id = ${session.id}
      returning *`
  );
  let payment = updated;
  if (!payment) {
    if (!orderId || !studioId) {
      log.warn("payments.completed_without_order", { session: session.id });
      return null;
    }
    payment = one<Payment>(
      await db()`
        insert into payments (studio_id, order_id, kind, amount_cents, currency, status, method, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id, paid_at)
        values (${studioId}, ${orderId}, ${kind}, ${session.amount_total ?? 0}, ${session.currency ?? "usd"}, 'paid', 'card', ${accountId}, ${session.id}, ${paymentIntent}, now())
        on conflict (stripe_checkout_session_id) do update set status = 'paid', paid_at = coalesce(payments.paid_at, now())
        returning *`
    );
  }
  if (!payment) return null;
  await syncOrderPaymentState(payment.order_id);
  return payment;
}

export async function recordCheckoutFailed(session: Stripe.Checkout.Session, message = "Payment failed") {
  const payment = one<Payment>(
    await db()`update payments set status = 'failed', failure_message = ${message} where stripe_checkout_session_id = ${session.id} and status = 'pending' returning *`
  );
  return payment;
}

export function statusAfterRefund(amountCents: number, amountRefunded: number): PaymentStatus {
  if (amountRefunded <= 0) return "paid";
  return amountRefunded >= amountCents ? "refunded" : "partially_refunded";
}

/** charge.refunded on the studio's account. Refunds are issued in the studio's Dashboard, never here. */
export async function recordRefund(charge: Stripe.Charge) {
  const paymentIntent = idOf(charge.payment_intent);
  const existing = one<Payment>(
    await db()`select * from payments where stripe_charge_id = ${charge.id} or (stripe_payment_intent_id = ${paymentIntent} and ${paymentIntent} is not null) limit 1`
  );
  if (!existing) {
    log.warn("payments.refund_without_payment", { charge: charge.id });
    return null;
  }
  const status = statusAfterRefund(existing.amount_cents, charge.amount_refunded);
  const payment = one<Payment>(
    await db()`
      update payments set refunded_cents = ${charge.amount_refunded}, status = ${status}, stripe_charge_id = coalesce(stripe_charge_id, ${charge.id}), receipt_url = coalesce(receipt_url, ${charge.receipt_url})
      where id = ${existing.id} returning *`
  );
  await syncOrderPaymentState(existing.order_id);
  return payment;
}

/** charge.dispute.created / closed. The studio responds in its own Dashboard. */
export async function recordDispute(dispute: Stripe.Dispute) {
  const paymentIntent = idOf(dispute.payment_intent);
  const chargeId = idOf(dispute.charge);
  const payment = one<Payment>(
    await db()`
      update payments set dispute_status = ${dispute.status}, disputed_at = coalesce(disputed_at, now()),
        status = case when ${dispute.status} in ('lost') then 'disputed' when status = 'disputed' and ${dispute.status} in ('won', 'warning_closed') then 'paid' else status end
      where stripe_charge_id = ${chargeId} or (stripe_payment_intent_id = ${paymentIntent} and ${paymentIntent} is not null)
      returning *`
  );
  if (payment) await syncOrderPaymentState(payment.order_id);
  return payment;
}

/** Cash, transfer or other payment recorded by the studio. */
export async function recordManualPayment(studioId: string, orderId: string, amountCents: number, method: string, note: string | null, userId: string | null) {
  if (amountCents <= 0) throw new Error("Amount must be more than zero.");
  const payment = one<Payment>(
    await db()`
      insert into payments (studio_id, order_id, kind, amount_cents, currency, status, method, paid_at, failure_message)
      select ${studioId}, ${orderId}, 'manual', ${amountCents}, currency, 'paid', ${method}, now(), ${note}
      from orders where id = ${orderId} and studio_id = ${studioId}
      returning *`
  );
  if (!payment) throw new Error("Order not found.");
  await db()`insert into audit_log (studio_id, user_id, action, target_type, target_id, meta) values (${studioId}, ${userId}, 'payment.manual', 'order', ${orderId}, ${JSON.stringify({ amountCents, method })}::jsonb)`;
  await syncOrderPaymentState(orderId);
  return payment;
}

/** Manual payments can be undone within 24 hours; card payments never (refund in Stripe instead). */
export async function undoManualPayment(studioId: string, paymentId: string) {
  const removed = one<Payment>(
    await db()`delete from payments where id = ${paymentId} and studio_id = ${studioId} and kind = 'manual' and created_at > now() - interval '24 hours' returning *`
  );
  if (!removed) throw new Error("This payment cannot be undone.");
  await syncOrderPaymentState(removed.order_id);
  return removed;
}

/** Recomputes paid_at and moves a pending order forward once the deposit or total is covered. */
export async function syncOrderPaymentState(orderId: string) {
  const order = one<Order>(await db()`select * from orders where id = ${orderId}`);
  if (!order) return null;
  const payments = await listPayments(orderId);
  const picks = one<{ n: number }>(await db()`select count(*)::int as n from photo_selections ps join galleries g on g.id = ps.gallery_id where g.order_id = ${orderId} and ps.selected`);
  const money = orderMoney(order, payments, picks?.n ?? 0);
  const paidAt = money.fully_paid && money.total_cents > 0 ? payments.filter((p) => p.status === "paid" || p.status === "partially_refunded").map((p) => p.paid_at).filter(Boolean).sort().at(-1) ?? new Date().toISOString() : null;
  const nextStatus = order.status === "pending_payment" && (money.deposit_paid || money.fully_paid) ? (order.shoot_date ? "scheduled" : "paid") : order.status;
  await db()`update orders set paid_at = ${paidAt}, status = ${nextStatus} where id = ${orderId}`;
  return money;
}

/**
 * Store checkout. Like createOrderCheckout, a direct charge on the studio's own
 * account with no application fee, but for a store `sale` (metadata.kind =
 * "store") rather than a session order. Returns the Checkout URL and session id.
 */
export async function createStoreCheckout(
  studio: PayStudio,
  sale: { id: string; order_number: number; currency: string },
  lineItems: { name: string; description?: string; amountCents: number; quantity: number }[],
  buyerEmail: string,
  urls: { successUrl: string; cancelUrl: string }
) {
  if (!canTakeCardPayments(studio) || !studio.stripe_account_id) throw new Error("This studio is not set up for card payments yet.");
  if (lineItems.length === 0) throw new Error("Nothing to buy.");
  const currency = studio.currency || sale.currency || "usd";
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: sale.id,
      customer_email: buyerEmail,
      line_items: lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: { currency, unit_amount: li.amountCents, product_data: { name: li.name, ...(li.description ? { description: li.description } : {}) } },
      })),
      payment_intent_data: { description: `Store order #${sale.order_number} with ${studio.name}` },
      metadata: { sale_id: sale.id, studio_id: studio.id, kind: "store" },
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
    },
    onAccount(studio.stripe_account_id)
  );
  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return { url: session.url, sessionId: session.id };
}
