import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { invoiceSubscriptionId, isFirstPaidInvoice, remainingTrialEnd, subscriptionSnapshot } from "@/lib/billing";

const now = new Date("2026-09-09T12:00:00Z");

describe("remainingTrialEnd", () => {
  it("returns a unix timestamp when more than 48 hours remain", () => {
    const end = new Date(now.getTime() + 5 * 86400000);
    expect(remainingTrialEnd(end.toISOString(), now)).toBe(Math.floor(end.getTime() / 1000));
  });
  it("returns undefined when less than 48 hours remain or no trial", () => {
    expect(remainingTrialEnd(new Date(now.getTime() + 47 * 3600000).toISOString(), now)).toBeUndefined();
    expect(remainingTrialEnd(null, now)).toBeUndefined();
  });
});

describe("subscriptionSnapshot", () => {
  it("maps status, period end from the item, cancel flag and customer id", () => {
    const sub = {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: true,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as unknown as Stripe.Subscription;
    expect(subscriptionSnapshot(sub)).toEqual({
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      subscription_status: "active",
      current_period_end: new Date(1_800_000_000 * 1000).toISOString(),
      cancel_at_period_end: true,
    });
  });
  it("tolerates an expanded customer and missing items", () => {
    const sub = { id: "sub_2", status: "past_due", customer: { id: "cus_2" }, cancel_at_period_end: false } as unknown as Stripe.Subscription;
    const snap = subscriptionSnapshot(sub);
    expect(snap.stripe_customer_id).toBe("cus_2");
    expect(snap.current_period_end).toBeNull();
  });
});

describe("invoices", () => {
  it("reads the subscription id from the invoice parent", () => {
    const inv = { parent: { subscription_details: { subscription: "sub_9" } } } as unknown as Stripe.Invoice;
    expect(invoiceSubscriptionId(inv)).toBe("sub_9");
    expect(invoiceSubscriptionId({ parent: null } as unknown as Stripe.Invoice)).toBeNull();
  });
  it("recognises the first paid invoice and ignores $0 trial invoices", () => {
    expect(isFirstPaidInvoice({ billing_reason: "subscription_create", amount_paid: 4000 } as unknown as Stripe.Invoice)).toBe(true);
    expect(isFirstPaidInvoice({ billing_reason: "subscription_create", amount_paid: 0 } as unknown as Stripe.Invoice)).toBe(false);
    expect(isFirstPaidInvoice({ billing_reason: "subscription_cycle", amount_paid: 4000 } as unknown as Stripe.Invoice)).toBe(false);
  });
});
