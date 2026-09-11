import { NextResponse, type NextRequest } from "next/server";
import { db, isUuid, one, rows } from "@/lib/db";
import { createStoreCheckout } from "@/lib/payments";
import { canTakeCardPayments } from "@/lib/connect";
import { clientIp, limited } from "@/lib/rate-limit";
import { billingState, entitlements } from "@/lib/plans";
import { bundleTotal, cleanRmUsage, discountAmount, giftCardSpend, parseVolumeTiers, resolveStorePrice, RM_DIMENSIONS, storeSettings } from "@/lib/store-shared";
import { attachSaleSession, createSale, findUsableGiftCard, findValidDiscount, fulfillPaidStoreSale, getProduct, listProductPrices, markSalePaid } from "@/lib/store";
import { createClient } from "@/lib/clients";
import { storeLicenseLabels, storeResolutionLabels, type StoreLicense, type StoreResolution, type Studio } from "@/lib/types";
import { signLink } from "@/lib/tenant-tokens";
import { storeLibraryUrl, studioBaseUrl } from "@/lib/tenant";
import { track } from "@/lib/analytics";
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
  const settings = storeSettings((studio.settings ?? {}) as Record<string, unknown>);
  if (!settings.enabled) return new NextResponse("This store is not open.", { status: 403 });
  const manual = settings.paymentMode === "manual";
  if (!manual && !canTakeCardPayments(studio)) return new NextResponse("This store does not take card payments online.", { status: 409 });

  const product = await getProduct(studio.id, productId);
  if (!product || !product.is_active) return new NextResponse("Not found", { status: 404 });
  // Rights-managed licences carry a usage scope; the price is recomputed from it server-side.
  const usage = license === "rm" ? cleanRmUsage(Object.fromEntries(RM_DIMENSIONS.map((d) => [d.key, form.get(`u_${d.key}`)]))) : {};
  const prices = await listProductPrices(studio.id, productId);
  const priced = resolveStorePrice(prices, resolution, license, usage);
  if (priced == null) return new NextResponse("That option is not for sale.", { status: 409 });
  if ("quote" in priced) return new NextResponse("This licence is priced on request — please contact the studio for a quote.", { status: 409 });
  const amount = priced.amountCents;

  // Build the sale items (one per delivered photo) and the order subtotal, then
  // apply the discount/gift card to that subtotal.
  let items: Parameters<typeof createSale>[1]["items"];
  if (product.kind === "bundle" && product.gallery_id) {
    // Pick-any bundle: the chosen photos, priced per photo; validated against the gallery.
    const priceRow = prices.find((p) => p.is_active && p.resolution === resolution && p.license === license);
    let ids: string[];
    try {
      const parsed = JSON.parse(String(form.get("photoIds") ?? "[]")) as unknown;
      ids = Array.isArray(parsed) ? [...new Set(parsed.map(String))].filter((x) => isUuid(x)) : [];
    } catch {
      return new NextResponse("Bad request", { status: 400 });
    }
    const min = priceRow?.min_pick ?? 1;
    const max = priceRow?.max_pick ?? ids.length;
    if (ids.length === 0 || ids.length < min || ids.length > max) return new NextResponse(`Please pick between ${min} and ${max} photos.`, { status: 409 });
    const valid = rows<{ id: string }>(await db()`select id from photos where studio_id = ${studio.id} and gallery_id = ${product.gallery_id} and deleted_at is null and id = any(${ids}::uuid[])`);
    if (valid.length !== ids.length) return new NextResponse("One of the chosen photos is no longer available.", { status: 409 });
    // Volume pricing: with tiers, the per-photo price falls as the count rises.
    const tiers = parseVolumeTiers(priceRow?.volume_tiers);
    const unit = tiers.length ? Math.round(bundleTotal(valid.length, tiers) / valid.length) : amount;
    items = valid.map((ph) => ({ productId: product.id, photoId: ph.id, assetId: null, kind: "bundle", resolution, license, usageScope: usage, qty: 1, unitAmountCents: unit, amountCents: unit }));
  } else if (product.kind === "gallery_unlock" && product.gallery_id) {
    const photos = rows<{ id: string }>(await db()`select id from photos where gallery_id = ${product.gallery_id} and studio_id = ${studio.id} and deleted_at is null and preview_url <> '' order by sort_order, created_at`);
    if (photos.length === 0) return new NextResponse("This gallery has no photos to sell yet.", { status: 409 });
    items = photos.map((ph, i) => ({ productId: product.id, photoId: ph.id, assetId: null, kind: "gallery_unlock", resolution, license, usageScope: usage, qty: 1, unitAmountCents: i === 0 ? amount : 0, amountCents: i === 0 ? amount : 0 }));
  } else if (product.kind === "collection_unlock" && product.collection_id) {
    // Every ready asset in the collection; the first line carries the price, the rest are 0.
    const assets = rows<{ id: string }>(await db()`select ci.asset_id as id from store_collection_items ci join assets a on a.id = ci.asset_id and a.studio_id = ci.studio_id where ci.studio_id = ${studio.id} and ci.collection_id = ${product.collection_id} and ci.asset_id is not null and a.url not like 'pending:%' order by ci.sort_order, ci.created_at`);
    if (assets.length === 0) return new NextResponse("This collection has no images to sell yet.", { status: 409 });
    items = assets.map((as, i) => ({ productId: product.id, photoId: null, assetId: as.id, kind: "collection_unlock", resolution, license, usageScope: usage, qty: 1, unitAmountCents: i === 0 ? amount : 0, amountCents: i === 0 ? amount : 0 }));
  } else {
    items = [{ productId: product.id, photoId: product.photo_id, assetId: product.asset_id, kind: product.kind, resolution, license, usageScope: usage, qty: 1, unitAmountCents: amount, amountCents: amount }];
  }
  const subtotal = items.reduce((s, it) => s + it.amountCents, 0);

  // Optional discount code (validated against the order subtotal).
  const codeStr = String(form.get("code") ?? "").trim();
  let discountCents = 0;
  let discountCode: string | null = null;
  if (codeStr) {
    const dc = await findValidDiscount(studio.id, codeStr, subtotal);
    if (!dc) return new NextResponse("That code is not valid for this order.", { status: 409 });
    discountCents = discountAmount(subtotal, { kind: dc.kind, value: dc.value, min_subtotal_cents: dc.min_subtotal_cents });
    discountCode = dc.code;
  }
  const afterDiscount = Math.max(0, subtotal - discountCents);
  if (afterDiscount <= 0) return new NextResponse("That code makes this order free — please contact the studio to arrange it.", { status: 409 });

  // Optional gift card: it draws down at fulfilment, reducing what the card is charged.
  const giftStr = String(form.get("gift") ?? "").trim();
  let giftCardId: string | null = null;
  let giftCardCents = 0;
  if (giftStr) {
    const card = await findUsableGiftCard(studio.id, giftStr);
    if (!card) return new NextResponse("That gift card is not valid.", { status: 409 });
    if (card.currency !== studio.currency) return new NextResponse("That gift card can't be used in this store's currency.", { status: 409 });
    giftCardId = card.id;
    giftCardCents = giftCardSpend(afterDiscount, card.balance_cents);
  }
  const netCharge = Math.max(0, afterDiscount - giftCardCents);

  const { client } = await createClient(studio.id, { name: name || email.split("@")[0], email, source: "store" });

  const sale = await createSale(studio.id, {
    buyerEmail: email,
    buyerName: name || null,
    buyerClientId: client.id,
    currency: studio.currency,
    paymentMode: manual ? "manual" : "connected",
    discountCents,
    discountCode,
    giftCardId,
    giftCardCents,
    items,
  });
  await track(studio.id, "checkout_start", product.id).catch(() => undefined);

  const base = studioBaseUrl(studio);

  // Gift card covers the order in full: nothing to charge — settle and deliver now.
  if (netCharge <= 0 && giftCardCents > 0) {
    const paid = await markSalePaid(sale.id, {});
    if (paid?.firstTime) await fulfillPaidStoreSale(sale.id).catch((error) => log.error("store.free_fulfil_failed", { sale: sale.id, error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.redirect(storeLibraryUrl(studio, signLink("download", sale.id)), { status: 303 });
  }

  if (manual) return NextResponse.redirect(`${base}/store/pending?sale=${sale.id}`, { status: 303 });

  const urls = { successUrl: `${base}/store/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}/shop/${product.slug}?cancelled=1` };
  const desc = [storeLicenseLabels[license], discountCode ? `code ${discountCode}` : null, giftCardCents > 0 ? "gift card applied" : null].filter(Boolean).join(" · ");
  try {
    const { url, sessionId } = await createStoreCheckout(
      studio,
      sale,
      [{ name: `${storeResolutionLabels[resolution]} — ${product.title}`, description: desc, amountCents: netCharge, quantity: 1 }],
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
