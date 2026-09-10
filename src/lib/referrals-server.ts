import "server-only";

import type Stripe from "stripe";
import { db, one, rows } from "@/lib/db";
import { referralCouponId, stripe } from "@/lib/stripe";
import { normalizeReferralCode, generateReferralCode, REFERRAL_CAP_PER_YEAR } from "@/lib/referrals";
import { sendReferralFriendJoinedEmail, sendReferralRewardEmail } from "@/lib/emails/billing";
import { log } from "@/lib/logger";

/**
 * Referral rewards (plan 3.84 to 3.86). 10% off for 12 months for both the
 * referrer and the referred studio, granted when the referred studio's first
 * paid invoice succeeds. Applied as a Stripe coupon on each subscription; if
 * a subscription already carries a discount, the reward waits in reward_queue
 * until that discount ends (or until the studio subscribes).
 */

export { REFERRAL_CAP_PER_YEAR };
export const REFERRAL_VOID_WINDOW_DAYS = 30;

type StudioRow = { id: string; name: string; email: string; referral_code: string | null; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string | null; created_at: string };

/** Signup with ?ref=CODE: link the new studio to the referrer (plan 5.5). Silently ignores bad or self codes. */
export async function captureAtSignup(newStudioId: string, rawCode: string | null | undefined, newOwnerEmail: string) {
  if (!rawCode) return null;
  const code = normalizeReferralCode(rawCode);
  const referrer = one<StudioRow>(await db()`select id, name, email, referral_code, stripe_customer_id, stripe_subscription_id, subscription_status, created_at from studios where referral_code = ${code} and deleted_at is null`);
  if (!referrer || referrer.id === newStudioId) return null;
  if (referrer.email.toLowerCase() === newOwnerEmail.toLowerCase()) return null; // self-referral by email
  await db()`update studios set referred_by_code = ${code} where id = ${newStudioId} and referred_by_code is null`;
  const referral = one<{ id: string }>(
    await db()`
      insert into referrals (referrer_studio_id, code, referred_studio_id, referred_email, status, signed_up_at)
      values (${referrer.id}, ${code}, ${newStudioId}, ${newOwnerEmail.toLowerCase()}, 'signed_up', now())
      on conflict (referred_studio_id) where referred_studio_id is not null do nothing
      returning id`
  );
  if (referral) {
    const newStudio = one<{ name: string }>(await db()`select name from studios where id = ${newStudioId}`);
    await sendReferralFriendJoinedEmail(referrer.email, referrer.name, newStudio?.name ?? "A new studio").catch(() => undefined);
  }
  return referral?.id ?? null;
}

/** Card fingerprint of the customer's default payment method, for the same-card check. */
async function cardFingerprint(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const customer = (await stripe().customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] })) as Stripe.Customer;
    const pm = customer.invoice_settings?.default_payment_method;
    if (pm && typeof pm !== "string") return pm.card?.fingerprint ?? null;
    if (typeof pm === "string") {
      const method = await stripe().paymentMethods.retrieve(pm);
      return method.card?.fingerprint ?? null;
    }
  } catch (error) {
    log.warn("referrals.fingerprint_failed", { customer: customerId, error: error instanceof Error ? error.message : String(error) });
  }
  return null;
}

export type FraudVerdict = { ok: true } | { ok: false; reason: string };

/** Pure part of the fraud rules (plan 3.85), so it can be tested without Stripe. */
export function fraudVerdict(input: { referrerEmail: string; referredEmail: string; referrerFingerprint: string | null; referredFingerprint: string | null; rewardsThisYear: number }): FraudVerdict {
  const a = input.referrerEmail.toLowerCase();
  const b = input.referredEmail.toLowerCase();
  if (a === b) return { ok: false, reason: "same_email" };
  const domainOf = (e: string) => e.split("@")[1] ?? "";
  const PUBLIC = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "live.com", "me.com"]);
  if (domainOf(a) && domainOf(a) === domainOf(b) && !PUBLIC.has(domainOf(a))) return { ok: false, reason: "same_business_domain" };
  if (input.referrerFingerprint && input.referredFingerprint && input.referrerFingerprint === input.referredFingerprint) return { ok: false, reason: "same_card" };
  if (input.rewardsThisYear >= REFERRAL_CAP_PER_YEAR) return { ok: false, reason: "yearly_cap" };
  return { ok: true };
}

/** Called from the platform webhook when a studio's first paid invoice succeeds (plan 6.7, 20.4). */
export async function onFirstPaidInvoice(referredStudioId: string, invoiceId: string) {
  const referral = one<{ id: string; referrer_studio_id: string; status: string }>(
    await db()`select id, referrer_studio_id, status from referrals where referred_studio_id = ${referredStudioId} and status = 'signed_up'`
  );
  if (!referral) return null;
  const referrer = one<StudioRow>(await db()`select id, name, email, referral_code, stripe_customer_id, stripe_subscription_id, subscription_status, created_at from studios where id = ${referral.referrer_studio_id}`);
  const referred = one<StudioRow>(await db()`select id, name, email, referral_code, stripe_customer_id, stripe_subscription_id, subscription_status, created_at from studios where id = ${referredStudioId}`);
  if (!referrer || !referred) return null;
  const rewardsThisYear = Number((one<{ n: number }>(await db()`select count(*)::int as n from referrals where referrer_studio_id = ${referrer.id} and status = 'rewarded' and rewarded_at > now() - interval '1 year'`))?.n ?? 0);
  const verdict = fraudVerdict({
    referrerEmail: referrer.email,
    referredEmail: referred.email,
    referrerFingerprint: await cardFingerprint(referrer.stripe_customer_id),
    referredFingerprint: await cardFingerprint(referred.stripe_customer_id),
    rewardsThisYear,
  });
  if (!verdict.ok) {
    await db()`update referrals set status = 'void', void_reason = ${verdict.reason}, invoice_id = ${invoiceId} where id = ${referral.id}`;
    log.info("referrals.void", { referral: referral.id, reason: verdict.reason });
    return { rewarded: false, reason: verdict.reason };
  }
  const referredState = await applyReward(referred, referral.id, "referred");
  const referrerState = await applyReward(referrer, referral.id, "referrer");
  await db()`
    update referrals set status = 'rewarded', rewarded_at = now(), invoice_id = ${invoiceId},
      referred_reward_state = ${referredState}, referrer_reward_state = ${referrerState}
    where id = ${referral.id}`;
  await sendReferralRewardEmail(referrer.email, referrer.name, referrerState === "applied").catch(() => undefined);
  await sendReferralRewardEmail(referred.email, referred.name, referredState === "applied").catch(() => undefined);
  return { rewarded: true, referrerState, referredState };
}

type RewardState = "applied" | "queued" | "pending";

/**
 * Puts the coupon on the studio's subscription. No subscription yet → pending
 * (applied at checkout, see billing.createSubscriptionCheckout). Already
 * discounted → queued until that discount ends.
 */
export async function applyReward(studio: StudioRow, referralId: string, reason: string): Promise<RewardState> {
  const coupon = referralCouponId();
  if (!coupon) throw new Error("STRIPE_REFERRAL_COUPON_ID is not set.");
  if (!studio.stripe_subscription_id) {
    await db()`insert into reward_queue (studio_id, coupon_id, reason, referral_id) values (${studio.id}, ${coupon}, ${reason}, ${referralId})`;
    return "pending";
  }
  const sub = await stripe().subscriptions.retrieve(studio.stripe_subscription_id, { expand: ["discounts"] });
  const active = (sub.discounts ?? []).filter((d): d is Stripe.Discount => typeof d !== "string" && (!d.end || d.end * 1000 > Date.now()));
  if (active.length > 0) {
    const applyAfter = Math.max(...active.map((d) => d.end ?? 0));
    await db()`insert into reward_queue (studio_id, coupon_id, reason, referral_id, apply_after) values (${studio.id}, ${coupon}, ${reason}, ${referralId}, ${applyAfter ? new Date(applyAfter * 1000).toISOString() : null})`;
    return "queued";
  }
  await stripe().subscriptions.update(studio.stripe_subscription_id, { discounts: [{ coupon }] });
  return "applied";
}

/** Whether a studio has a reward waiting to be used at checkout. */
export async function pendingRewardFor(studioId: string) {
  return one<{ id: string; coupon_id: string }>(await db()`select id, coupon_id from reward_queue where studio_id = ${studioId} and applied_at is null and apply_after is null order by created_at limit 1`);
}

export async function markQueuedRewardApplied(id: string) {
  await db()`update reward_queue set applied_at = now() where id = ${id}`;
}

/** Cron: apply queued rewards whose wait is over and whose subscription is active (plan 20.5). */
export async function applyDueRewards() {
  const due = rows<{ id: string; studio_id: string; coupon_id: string; stripe_subscription_id: string | null }>(
    await db()`
      select q.id, q.studio_id, q.coupon_id, s.stripe_subscription_id
      from reward_queue q join studios s on s.id = q.studio_id
      where q.applied_at is null and q.apply_after is not null and q.apply_after <= now()
        and s.stripe_subscription_id is not null and s.subscription_status in ('active', 'trialing')`
  );
  let applied = 0;
  for (const r of due) {
    try {
      await stripe().subscriptions.update(r.stripe_subscription_id!, { discounts: [{ coupon: r.coupon_id }] });
      await markQueuedRewardApplied(r.id);
      applied++;
    } catch (error) {
      log.warn("referrals.apply_queued_failed", { reward: r.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return applied;
}

/** Refund or dispute of the referred studio's first invoice within 30 days voids the referral (plan 20.8). */
export async function voidForRefund(referredStudioId: string) {
  const referral = one<{ id: string; referrer_studio_id: string; rewarded_at: string | null }>(
    await db()`select id, referrer_studio_id, rewarded_at from referrals where referred_studio_id = ${referredStudioId} and status = 'rewarded' and rewarded_at > now() - (${REFERRAL_VOID_WINDOW_DAYS} || ' days')::interval`
  );
  if (!referral) return false;
  for (const studioId of [referredStudioId, referral.referrer_studio_id]) {
    const studio = one<{ stripe_subscription_id: string | null }>(await db()`select stripe_subscription_id from studios where id = ${studioId}`);
    if (studio?.stripe_subscription_id) {
      try {
        await stripe().subscriptions.update(studio.stripe_subscription_id, { discounts: "" });
      } catch (error) {
        log.warn("referrals.remove_discount_failed", { studio: studioId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    await db()`update reward_queue set applied_at = now() where studio_id = ${studioId} and referral_id = ${referral.id} and applied_at is null`;
  }
  await db()`update referrals set status = 'void', void_reason = 'refund_or_dispute', referrer_reward_state = 'reversed', referred_reward_state = 'reversed' where id = ${referral.id}`;
  return true;
}

export async function referralStats(studioId: string) {
  const counts = one<{ invited: number; signed_up: number; rewarded: number }>(
    await db()`
      select count(*) filter (where status = 'invited')::int as invited,
             count(*) filter (where status = 'signed_up')::int as signed_up,
             count(*) filter (where status = 'rewarded')::int as rewarded
      from referrals where referrer_studio_id = ${studioId}`
  );
  const list = rows<{ id: string; status: string; referred_email: string | null; referred_name: string | null; created_at: string; rewarded_at: string | null }>(
    await db()`
      select r.id, r.status, r.referred_email, s.name as referred_name, r.created_at, r.rewarded_at
      from referrals r left join studios s on s.id = r.referred_studio_id
      where r.referrer_studio_id = ${studioId} order by r.created_at desc limit 100`
  );
  return { counts: counts ?? { invited: 0, signed_up: 0, rewarded: 0 }, list };
}

/** "Invite by email": records an invited row so the studio sees who they asked (plan 20.2). */
/** The studio's own referral code, generating and storing one on first use. */
export async function ensureReferralCode(studioId: string): Promise<string> {
  const existing = one<{ referral_code: string | null }>(await db()`select referral_code from studios where id = ${studioId}`);
  if (existing?.referral_code) return existing.referral_code;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode();
    try {
      await db()`update studios set referral_code = ${code} where id = ${studioId} and referral_code is null`;
    } catch {
      // unique collision: try another code
      continue;
    }
    const row = one<{ referral_code: string | null }>(await db()`select referral_code from studios where id = ${studioId}`);
    if (row?.referral_code) return row.referral_code;
  }
  throw new Error("Could not allocate a referral code.");
}

export async function recordInvite(studioId: string, code: string, email: string) {
  await db()`insert into referrals (referrer_studio_id, code, referred_email, status) values (${studioId}, ${code}, ${email.trim().toLowerCase()}, 'invited')`;
}
