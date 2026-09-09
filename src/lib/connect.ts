import "server-only";

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { appUrl, env, requireEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { hmac, randomToken, safeEqual } from "@/lib/tokens";
import { studioBaseUrl } from "@/lib/tenant";
import type { Studio } from "@/lib/types";
import { log } from "@/lib/logger";

/**
 * The studio's own Stripe account. Two ways in:
 *   - OAuth: connects an EXISTING Stripe account (Standard). Stripe's OAuth
 *     reference: GET https://connect.stripe.com/oauth/authorize, then
 *     POST /oauth/token with the code to get stripe_user_id.
 *   - Onboarding: creates a new account with Stripe's default controller
 *     properties (equivalent to Standard: the account pays its own fees, Stripe
 *     is liable for negative balances, full Dashboard) and sends the studio to
 *     a Stripe-hosted Account Link.
 * Either way the platform holds no funds and takes no fee.
 */

type ConnectStudio = Pick<Studio, "id" | "name" | "email" | "slug" | "custom_domain" | "custom_domain_verified_at" | "stripe_account_id">;

const STATE_TTL_MS = 30 * 60 * 1000;

/** Signed, time-limited state for the OAuth round trip (CSRF protection). */
export function signConnectState(studioId: string, now = Date.now(), secret = requireEnv("APP_SECRET")) {
  const exp = now + STATE_TTL_MS;
  const nonce = randomToken(12);
  const payload = `${studioId}.${exp}.${nonce}`;
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifyConnectState(state: string | null, now = Date.now(), secret = requireEnv("APP_SECRET")): { studioId: string } | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [studioId, expRaw, nonce, sig] = parts;
  const payload = `${studioId}.${expRaw}.${nonce}`;
  if (!safeEqual(hmac(secret, payload), sig)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return null;
  return { studioId };
}

export function oauthRedirectUri() {
  return `${appUrl()}/api/connect/oauth/callback`;
}

/** The URL that sends the studio to Stripe to connect an existing account. */
export function oauthAuthorizeUrl(studio: ConnectStudio, state: string) {
  const clientId = env.stripeConnectClientId();
  if (!clientId) throw new Error("STRIPE_CONNECT_CLIENT_ID is not set. See docs/BUILD-PLAN.md Appendix A.");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: oauthRedirectUri(),
    state,
    "stripe_user[email]": studio.email,
    "stripe_user[business_name]": studio.name,
    "stripe_user[url]": studioBaseUrl(studio),
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/** Exchanges the one-time code for the connected account id and stores it. */
export async function completeOauth(studioId: string, code: string) {
  const res = await stripe().oauth.token({ grant_type: "authorization_code", code });
  const accountId = res.stripe_user_id;
  if (!accountId) throw new Error("Stripe did not return an account id.");
  await db()`
    update studios set
      stripe_account_id = ${accountId},
      stripe_connect_method = 'oauth',
      stripe_connected_at = now()
    where id = ${studioId}`;
  await refreshAccountStatus(studioId, accountId);
  return accountId;
}

/** Creates a new account with Stripe's defaults (Standard-equivalent) and returns the hosted onboarding URL. */
export async function startOnboarding(studio: ConnectStudio) {
  let accountId = studio.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create({
      email: studio.email,
      business_profile: { name: studio.name, url: studioBaseUrl(studio) },
      metadata: { studio_id: studio.id, studio_slug: studio.slug },
    });
    accountId = account.id;
    await db()`
      update studios set
        stripe_account_id = ${accountId},
        stripe_connect_method = 'onboarding',
        stripe_account_status = 'pending'
      where id = ${studio.id}`;
  }
  return createOnboardingLink(accountId);
}

export async function createOnboardingLink(accountId: string) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${appUrl()}/api/connect/return`,
    refresh_url: `${appUrl()}/api/connect/refresh`,
  });
  return link.url;
}

/** Maps a Stripe account to the studio's connection columns. Pure, for tests. */
export function accountSnapshot(account: Pick<Stripe.Account, "charges_enabled" | "details_submitted" | "requirements">) {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const status: Studio["stripe_account_status"] = account.charges_enabled
    ? "enabled"
    : account.details_submitted
      ? "restricted"
      : "pending";
  return {
    stripe_charges_enabled: Boolean(account.charges_enabled),
    stripe_details_submitted: Boolean(account.details_submitted),
    stripe_account_status: status,
    currentlyDue,
  };
}

export async function refreshAccountStatus(studioId: string, accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  return applyAccountSnapshot(studioId, account);
}

export async function applyAccountSnapshot(studioId: string, account: Stripe.Account) {
  const snap = accountSnapshot(account);
  await db()`
    update studios set
      stripe_charges_enabled = ${snap.stripe_charges_enabled},
      stripe_details_submitted = ${snap.stripe_details_submitted},
      stripe_account_status = ${snap.stripe_account_status},
      stripe_connected_at = coalesce(stripe_connected_at, case when ${snap.stripe_charges_enabled} then now() else null end)
    where id = ${studioId}`;
  return snap;
}

/** Studio id for a connected account id (webhooks carry the account, not our id). */
export async function studioIdForAccount(accountId: string | null | undefined) {
  if (!accountId) return null;
  const rows = await db()`select id from studios where stripe_account_id = ${accountId} limit 1`;
  return (rows[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Disconnects. OAuth connections are revoked at Stripe (the account keeps
 * working on its own); onboarding-created accounts are simply forgotten here,
 * the studio still owns them at dashboard.stripe.com.
 */
export async function disconnectAccount(studio: Pick<Studio, "id" | "stripe_account_id" | "stripe_connect_method">) {
  if (studio.stripe_account_id && studio.stripe_connect_method === "oauth") {
    const clientId = env.stripeConnectClientId();
    if (clientId) {
      try {
        await stripe().oauth.deauthorize({ client_id: clientId, stripe_user_id: studio.stripe_account_id });
      } catch (error) {
        log.warn("connect.deauthorize_failed", { studio: studio.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  await clearConnection(studio.id);
}

export async function clearConnection(studioId: string) {
  await db()`
    update studios set
      stripe_account_id = null,
      stripe_connect_method = case when stripe_connect_method = 'manual' then 'manual' else 'none' end,
      stripe_account_status = 'none',
      stripe_charges_enabled = false,
      stripe_details_submitted = false,
      stripe_connected_at = null
    where id = ${studioId}`;
}

/** True when the studio can take card payments through the app right now. */
export function canTakeCardPayments(studio: Pick<Studio, "stripe_account_id" | "stripe_charges_enabled">) {
  return Boolean(studio.stripe_account_id && studio.stripe_charges_enabled);
}
