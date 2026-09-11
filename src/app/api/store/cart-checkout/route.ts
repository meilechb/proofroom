import { NextResponse, type NextRequest } from "next/server";
import { db, isUuid, one, rows } from "@/lib/db";
import { createStoreCheckout } from "@/lib/payments";
import { canTakeCardPayments } from "@/lib/connect";
import { clientIp, limited } from "@/lib/rate-limit";
import { billingState, entitlements } from "@/lib/plans";
import { discountAmount, giftCardSpend, selectPrice, storeSettings } from "@/lib/store-shared";
import { attachSaleSession, createSale, findUsableGiftCard, findValidDiscount, fulfillPaidStoreSale, getProduct, listProductPrices, markSalePaid } from "@/lib/store";
import { createClient } from "@/lib/clients";
import { storeLicenseLabels, storeResolutionLabels, type StoreLicense, type StoreResolution, type Studio } from "@/lib/types";
import { signLink } from "@/lib/tenant-tokens";
import { storeLibraryUrl, studioBaseUrl } from "@/lib/tenant";
import { log } from "@/lib/logger";

const RES = ["web", "standard", "original"];
const LIC = ["personal", "rf", "rm", "extended"];
type CartLine = { productId: string; resolution: StoreResolution; license: StoreLicense };

/**
 * Multi-item cart checkout. Mirrors the single-item route but over a list of
 * lines: every price is recomputed server-side from the catalogue (the client
 * supplies only product + option selections, never amounts), so payment
 * integrity matches the single-item flow. Gallery-unlock lines expand into one
 * sale item per photo priced on the first, as a single Stripe line.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (!slug) return new NextResponse("Bad request", { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return new NextResponse("Enter a valid email address.", { status: 400 });

  let cart: CartLine[];
  try {
    const parsed = JSON.parse(String(form.get("cart") ?? "[]")) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return new NextResponse("Your cart is empty.", { status: 400 });
    cart = parsed.slice(0, 50).map((r) => {
      const row = r as { productId?: unknown; resolution?: unknown; license?: unknown };
      return { productId: String(row.productId ?? ""), resolution: String(row.resolution ?? "") as StoreResolution, license: String(row.license ?? "") as StoreLicense };
    });
  } catch {
    return new NextResponse("Could not read your cart.", { status: 400 });
  }
  if (cart.some((l) => !isUuid(l.productId) || !RES.includes(l.resolution) || !LIC.includes(l.license))) return new NextResponse("Your cart has an invalid item.", { status: 400 });

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

  // Build sale items + one Stripe line per cart line, all priced from the catalogue.
  const items: Parameters<typeof createSale>[1]["items"] = [];
  const lineItems: { name: string; description: string; amountCents: number; quantity: number }[] = [];
  let subtotal = 0;
  for (const line of cart) {
    const product = await getProduct(studio.id, line.productId);
    if (!product || !product.is_active) return new NextResponse("An item in your cart is no longer available.", { status: 409 });
    const amount = selectPrice(await listProductPrices(studio.id, line.productId), line.resolution, line.license);
    if (amount == null || amount <= 0) return new NextResponse(`"${product.title}" is not available in that option.`, { status: 409 });
    if (product.kind === "gallery_unlock" && product.gallery_id) {
      const photos = rows<{ id: string }>(await db()`select id from photos where gallery_id = ${product.gallery_id} and studio_id = ${studio.id} and deleted_at is null and preview_url <> '' order by sort_order, created_at`);
      if (photos.length === 0) return new NextResponse(`"${product.title}" has no photos to sell yet.`, { status: 409 });
      photos.forEach((ph, i) => items.push({ productId: product.id, photoId: ph.id, assetId: null, kind: "gallery_unlock", resolution: line.resolution, license: line.license, qty: 1, unitAmountCents: i === 0 ? amount : 0, amountCents: i === 0 ? amount : 0 }));
    } else {
      items.push({ productId: product.id, photoId: product.photo_id, assetId: product.asset_id, kind: product.kind, resolution: line.resolution, license: line.license, qty: 1, unitAmountCents: amount, amountCents: amount });
    }
    lineItems.push({ name: `${storeResolutionLabels[line.resolution]} — ${product.title}`, description: storeLicenseLabels[line.license], amountCents: amount, quantity: 1 });
    subtotal += amount;
  }
  if (subtotal <= 0) return new NextResponse("Your cart total is zero.", { status: 409 });

  // Optional discount code (validated against the whole-cart subtotal).
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

  // Optional gift card.
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

  const base = studioBaseUrl(studio);

  // Gift card covers the order in full: settle and deliver now, no Stripe.
  if (netCharge <= 0 && giftCardCents > 0) {
    const paid = await markSalePaid(sale.id, {});
    if (paid?.firstTime) await fulfillPaidStoreSale(sale.id).catch((error) => log.error("store.free_fulfil_failed", { sale: sale.id, error: error instanceof Error ? error.message : String(error) }));
    return NextResponse.redirect(storeLibraryUrl(studio, signLink("download", sale.id)), { status: 303 });
  }

  if (manual) return NextResponse.redirect(`${base}/store/pending?sale=${sale.id}`, { status: 303 });

  // Stripe line amounts can't be negative, so when a discount or gift card
  // applies, collapse to a single summary line equal to netCharge. Without an
  // adjustment the itemised lines already sum to netCharge.
  const adjustment = subtotal - netCharge;
  let stripeLines = lineItems;
  if (adjustment > 0) {
    const bits = [discountCode ? `code ${discountCode}` : null, giftCardCents > 0 ? "gift card" : null].filter(Boolean).join(" + ");
    stripeLines = [{ name: `Your order — ${cart.length} item${cart.length > 1 ? "s" : ""}`, description: bits ? `after ${bits}` : "", amountCents: netCharge, quantity: 1 }];
  }

  const urls = { successUrl: `${base}/store/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}/shop/cart?cancelled=1` };
  try {
    const { url, sessionId } = await createStoreCheckout(studio, sale, stripeLines, email, urls);
    await attachSaleSession(sale.id, sessionId, studio.stripe_account_id);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    log.error("store.cart_checkout_failed", { studio: studio.id, error: error instanceof Error ? error.message : String(error) });
    return new NextResponse("Could not start the purchase. Please try again.", { status: 502 });
  }
}
