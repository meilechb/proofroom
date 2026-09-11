import { NextResponse, type NextRequest } from "next/server";
import { db, isUuid, one } from "@/lib/db";
import { createStoreCheckout } from "@/lib/payments";
import { canTakeCardPayments } from "@/lib/connect";
import { clientIp, limited } from "@/lib/rate-limit";
import { billingState, entitlements } from "@/lib/plans";
import { discountAmount, selectPrice, storeSettings } from "@/lib/store-shared";
import { attachSaleSession, createSale, findValidDiscount, getProduct, listProductPrices } from "@/lib/store";
import { createClient } from "@/lib/clients";
import { storeLicenseLabels, storeResolutionLabels, type StoreLicense, type StoreResolution, type Studio } from "@/lib/types";
import { studioBaseUrl } from "@/lib/tenant";
import { log } from "@/lib/logger";

const RES = ["web", "standard", "original"];
const LIC = ["personal", "rf", "rm", "extended"];

/**
 * Tenant-side "buy now": creates a store sale and a Checkout Session on the
 * studio's own account, then redirects the buyer to Stripe. Store fulfilment
 * happens in the connected webhook.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "");
  const productId = String(form.get("productId") ?? "");
  const resolution = String(form.get("resolution") ?? "") as StoreResolution;
  const license = String(form.get("license") ?? "") as StoreLicense;
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (!slug || !isUuid(productId) || !RES.includes(resolution) || !LIC.includes(license)) return new NextResponse("Bad request", { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return new NextResponse("Enter a valid email address.", { status: 400 });

  const rl = await limited("store_checkout", `${slug}:${clientIp(request.headers)}`);
  if (!rl.ok) return new NextResponse("Too many attempts. Try again in a few minutes.", { status: 429 });

  const studio = one<Studio>(await db()`select * from studios where slug = ${slug} and deleted_at is null`);
  if (!studio) return new NextResponse("Not found", { status: 404 });
  const bs = billingState(studio);
  if (!bs.publicLive) return new NextResponse("This store is not open right now.", { status: 403 });
  if (!entitlements(bs.effectivePlan).store) return new NextResponse("Store not available.", { status: 403 });
  if (!storeSettings((studio.settings ?? {}) as Record<string, unknown>).enabled) return new NextResponse("This store is not open.", { status: 403 });
  if (!canTakeCardPayments(studio)) return new NextResponse("This store does not take card payments online.", { status: 409 });

  const product = await getProduct(studio.id, productId);
  if (!product || !product.is_active) return new NextResponse("Not found", { status: 404 });
  const amount = selectPrice(await listProductPrices(studio.id, productId), resolution, license);
  if (amount == null || amount <= 0) return new NextResponse("That option is not for sale.", { status: 409 });

  // Optional discount code.
  const codeStr = String(form.get("code") ?? "").trim();
  let discountCents = 0;
  let discountCode: string | null = null;
  if (codeStr) {
    const dc = await findValidDiscount(studio.id, codeStr, amount);
    if (!dc) return new NextResponse("That code is not valid for this order.", { status: 409 });
    discountCents = discountAmount(amount, { kind: dc.kind, value: dc.value, min_subtotal_cents: dc.min_subtotal_cents });
    discountCode = dc.code;
  }
  const charged = Math.max(0, amount - discountCents);
  if (charged <= 0) return new NextResponse("That code makes this order free — please contact the studio to arrange it.", { status: 409 });

  const { client } = await createClient(studio.id, { name: name || email.split("@")[0], email, source: "store" });

  const sale = await createSale(studio.id, {
    buyerEmail: email,
    buyerName: name || null,
    buyerClientId: client.id,
    currency: studio.currency,
    paymentMode: "connected",
    discountCents,
    discountCode,
    items: [{ productId: product.id, photoId: product.photo_id, assetId: product.asset_id, kind: product.kind, resolution, license, qty: 1, unitAmountCents: amount, amountCents: amount }],
  });

  const base = studioBaseUrl(studio);
  const urls = { successUrl: `${base}/store/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}/shop/${product.slug}?cancelled=1` };
  try {
    const { url, sessionId } = await createStoreCheckout(
      studio,
      sale,
      [{ name: `${storeResolutionLabels[resolution]} — ${product.title}`, description: discountCode ? `${storeLicenseLabels[license]} · code ${discountCode}` : storeLicenseLabels[license], amountCents: charged, quantity: 1 }],
      email,
      urls
    );
    await attachSaleSession(sale.id, sessionId, studio.stripe_account_id);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    log.error("store.checkout_failed", { studio: studio.id, error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("Could not start the purchase. Please try again.", { status: 502 });
  }
}
