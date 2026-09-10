import "server-only";

import { db, one, rows } from "@/lib/db";
import { recordClientEvent } from "@/lib/clients";
import { agreementToPlainText, renderAgreement, type AgreementVars } from "@/lib/agreements";
import { formatMoney, type Order, type Package } from "@/lib/types";

/** Sessions (orders): numbered per studio, priced from a package, signed agreement, schedule. */

export type OrderInput = { clientId: string; packageId?: string | null; title?: string; scheduledAt?: string | null; location?: string | null; notes?: string | null; amountCents?: number; depositCents?: number; includedFinals?: number; extraFinalCents?: number; discountCents?: number };

/**
 * Creates the order with the next number in one statement: the update on
 * studios locks the row, so two simultaneous creates cannot get the same number.
 */
export async function createOrder(studioId: string, input: OrderInput) {
  const pkg = input.packageId ? one<Package>(await db()`select * from packages where id = ${input.packageId} and studio_id = ${studioId}`) : null;
  const title = input.title?.trim() || pkg?.name || "Session";
  const amount = input.amountCents ?? pkg?.price_cents ?? 0;
  const deposit = input.depositCents ?? pkg?.deposit_cents ?? 0;
  const included = input.includedFinals ?? pkg?.included_finals ?? 0;
  const extra = input.extraFinalCents ?? pkg?.extra_final_cents ?? 0;
  const scheduled = input.scheduledAt ?? null;
  const order = one<Order>(
    await db()`
      with n as (
        update studios set next_order_number = next_order_number + 1 where id = ${studioId} returning next_order_number - 1 as num
      )
      insert into orders (studio_id, order_number, client_id, package_id, title, description, amount_cents, deposit_cents, included_finals, extra_final_cents, discount_cents, status, shoot_date, scheduled_at, location, notes)
      select ${studioId}, n.num, ${input.clientId}, ${pkg?.id ?? null}, ${title}, ${pkg?.description ?? null}, ${amount}, ${deposit}, ${included}, ${extra}, ${input.discountCents ?? 0},
             ${amount > 0 ? "pending_payment" : scheduled ? "scheduled" : "paid"}, ${scheduled ? scheduled.slice(0, 10) : null}, ${scheduled}, ${input.location ?? null}, ${input.notes ?? null}
      from n
      returning *`
  );
  if (!order) throw new Error("Could not create the session.");
  await recordClientEvent(studioId, input.clientId, "order.created", "order", order.id, `Session #${order.order_number} created: ${title} (${formatMoney(amount, order.currency)})`);
  return order;
}

export async function getOrder(studioId: string, id: string) {
  return one<Order>(await db()`select * from orders where id = ${id} and studio_id = ${studioId}`);
}

export async function listOrders(studioId: string, filter: { clientId?: string; status?: Order["status"] | "upcoming" | "unpaid" | "past" | "all" } = {}) {
  const status = filter.status ?? "all";
  return rows<Order & { client_name: string; client_email: string; paid_cents: number }>(
    await db()`
      select o.*, c.name as client_name, c.email as client_email,
        coalesce((select sum(p.amount_cents - p.refunded_cents) from payments p where p.order_id = o.id and p.status in ('paid','partially_refunded')), 0)::int as paid_cents
      from orders o join clients c on c.id = o.client_id
      where o.studio_id = ${studioId}
        and (${filter.clientId ?? null}::uuid is null or o.client_id = ${filter.clientId ?? null}::uuid)
        and case ${status}
              when 'upcoming' then o.scheduled_at >= now() and o.status not in ('cancelled','completed')
              when 'past' then o.scheduled_at < now() or o.status in ('completed','cancelled')
              when 'unpaid' then o.paid_at is null and o.status not in ('cancelled','draft')
              when 'all' then true
              else o.status = ${status}
            end
      order by coalesce(o.scheduled_at, o.created_at) desc`
  );
}

export type OrderPatch = Partial<Pick<Order, "title" | "notes" | "location" | "scheduled_at" | "discount_cents" | "amount_cents" | "deposit_cents" | "included_finals" | "extra_final_cents" | "status">>;

/** Money fields cannot change once a payment exists; the caller shows a warning instead. */
export async function updateOrder(studioId: string, id: string, patch: OrderPatch) {
  const current = await getOrder(studioId, id);
  if (!current) throw new Error("Not found");
  const hasPayments = (await db()`select 1 from payments where order_id = ${id} and status in ('paid','partially_refunded') limit 1`).length > 0;
  const moneyChanged = ["amount_cents", "deposit_cents", "included_finals", "extra_final_cents"].some((k) => patch[k as keyof OrderPatch] !== undefined && patch[k as keyof OrderPatch] !== current[k as keyof Order]);
  if (hasPayments && moneyChanged) throw new Error("This session already has payments. Add a discount or a manual adjustment instead of changing the price.");
  const scheduled = patch.scheduled_at === undefined ? current.scheduled_at : patch.scheduled_at;
  const order = one<Order>(
    await db()`
      update orders set
        title = ${patch.title ?? current.title},
        notes = ${patch.notes === undefined ? current.notes : patch.notes},
        location = ${patch.location === undefined ? current.location : patch.location},
        scheduled_at = ${scheduled},
        shoot_date = ${scheduled ? scheduled.slice(0, 10) : null},
        discount_cents = ${patch.discount_cents ?? current.discount_cents},
        amount_cents = ${patch.amount_cents ?? current.amount_cents},
        deposit_cents = ${patch.deposit_cents ?? current.deposit_cents},
        included_finals = ${patch.included_finals ?? current.included_finals},
        extra_final_cents = ${patch.extra_final_cents ?? current.extra_final_cents},
        status = ${patch.status ?? current.status}
      where id = ${id} and studio_id = ${studioId}
      returning *`
  );
  if (order && patch.scheduled_at !== undefined && patch.scheduled_at !== current.scheduled_at) {
    await recordClientEvent(studioId, order.client_id, "order.rescheduled", "order", id, `Session #${order.order_number} rescheduled`);
  }
  return order;
}

export async function cancelOrder(studioId: string, id: string, reason: string | null) {
  const order = one<Order>(await db()`update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = ${reason} where id = ${id} and studio_id = ${studioId} returning *`);
  if (order) {
    // Free any booking slot this session holds so the time opens up again (plan 21.13).
    await db()`update booking_slots set status = 'cancelled', hold_expires_at = null where order_id = ${id} and studio_id = ${studioId} and status in ('held', 'confirmed')`;
    await recordClientEvent(studioId, order.client_id, "order.cancelled", "order", id, `Session #${order.order_number} cancelled${reason ? `: ${reason}` : ""}`);
  }
  return order;
}

/** Renders the studio's active agreement for this order. */
export async function agreementForOrder(studioId: string, order: Order, extra: { studioName: string; studioEmail: string; clientName: string; retentionDays?: number }) {
  const template = one<{ version: number; body_md: string }>(await db()`select version, body_md from agreement_templates where studio_id = ${studioId} and is_active order by version desc limit 1`);
  if (!template) throw new Error("No agreement template");
  const vars: AgreementVars = {
    studio_name: extra.studioName,
    studio_email: extra.studioEmail,
    client_name: extra.clientName,
    session_title: order.title,
    session_date: order.scheduled_at ? new Date(order.scheduled_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "a date agreed in writing",
    price: formatMoney(order.amount_cents - order.discount_cents, order.currency),
    deposit: formatMoney(order.deposit_cents, order.currency),
    balance: formatMoney(Math.max(0, order.amount_cents - order.discount_cents - order.deposit_cents), order.currency),
    included_finals: String(order.included_finals),
    extra_final_price: formatMoney(order.extra_final_cents, order.currency),
    retention_days: String(extra.retentionDays ?? 90),
  };
  const markdown = renderAgreement(template.body_md, vars);
  return { version: `v${template.version}`, markdown, text: agreementToPlainText(markdown) };
}

export async function signAgreement(studioId: string, id: string, input: { name: string; ip: string; version: string; portfolioOk: boolean }) {
  const order = one<Order>(
    await db()`
      update orders set contract_version = ${input.version}, contract_signed_at = now(), contract_signed_name = ${input.name.trim()}, contract_signed_ip = ${input.ip}, contract_portfolio_ok = ${input.portfolioOk}
      where id = ${id} and studio_id = ${studioId} and contract_signed_at is null
      returning *`
  );
  if (order) await recordClientEvent(studioId, order.client_id, "order.signed", "order", id, `Agreement signed by ${input.name.trim()}`);
  return order;
}
