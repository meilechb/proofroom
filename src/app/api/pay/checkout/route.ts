import { NextResponse, type NextRequest } from "next/server";
import { db, isUuid, one } from "@/lib/db";
import { amountForKind, createOrderCheckout, defaultPayUrls, listPayments, type CheckoutKind } from "@/lib/payments";
import { canTakeCardPayments } from "@/lib/connect";
import { clientIp, limited } from "@/lib/rate-limit";
import { billingState } from "@/lib/plans";
import type { Order, Studio } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * Tenant-side: creates a Checkout Session on the studio's own account and
 * redirects the client to Stripe (plan 7.18). The order must belong to the
 * studio that owns the host this request arrived on.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const orderId = String(form.get("orderId") ?? "");
  const kind = String(form.get("kind") ?? "full") as CheckoutKind;
  if (!isUuid(orderId) || !["deposit", "balance", "full"].includes(kind)) return new NextResponse("Bad request", { status: 400 });
  const rl = await limited("pay_checkout", `${orderId}:${clientIp(request.headers)}`);
  if (!rl.ok) return new NextResponse("Too many attempts. Try again in a few minutes.", { status: 429 });

  const slug = request.headers.get("x-tenant-slug");
  const order = one<Order>(await db()`select * from orders where id = ${orderId}`);
  if (!order) return new NextResponse("Not found", { status: 404 });
  const studio = one<Studio>(await db()`select * from studios where id = ${order.studio_id} and deleted_at is null`);
  if (!studio || (slug && studio.slug !== slug)) return new NextResponse("Not found", { status: 404 });
  if (!billingState(studio).publicLive) return new NextResponse("This studio is not accepting payments right now.", { status: 403 });
  if (order.status === "cancelled") return new NextResponse("This session was cancelled.", { status: 410 });
  if (!canTakeCardPayments(studio)) return new NextResponse("This studio does not take card payments online.", { status: 409 });

  const client = one<{ name: string; email: string }>(await db()`select name, email from clients where id = ${order.client_id}`);
  if (!client) return new NextResponse("Not found", { status: 404 });
  const payments = await listPayments(order.id);
  const picks = one<{ n: number }>(await db()`select count(*)::int as n from photo_selections ps join galleries g on g.id = ps.gallery_id where g.order_id = ${order.id} and ps.selected`);
  const amount = amountForKind(order, payments, picks?.n ?? 0, kind);
  if (!amount) return NextResponse.redirect(defaultPayUrls(studio, order.id).cancelUrl.replace("?cancelled=1", "?paid=1"), { status: 303 });
  try {
    const url = await createOrderCheckout(studio, order, client, kind, amount, defaultPayUrls(studio, order.id));
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    log.error("pay.checkout_failed", { order: order.id, error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("Could not start the payment. Please try again.", { status: 502 });
  }
}
