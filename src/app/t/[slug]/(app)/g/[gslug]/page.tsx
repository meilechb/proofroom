import { notFound } from "next/navigation";
import { studioBySlug, galleryBySlug } from "@/lib/tenant-data";
import { hasGalleryAccess, unlockMethod, sharingAllowed, downloadGate } from "@/lib/gallery-access";
import { verifyLink } from "@/lib/tenant-tokens";
import { db, one, rows } from "@/lib/db";
import { listPhotos } from "@/lib/photos";
import { getOrder } from "@/lib/orders";
import { listPayments } from "@/lib/payments";
import { orderMoney } from "@/lib/types";
import { payUrl, galleryUrl } from "@/lib/tenant";
import { GalleryView, type ClientPhoto } from "./gallery-view";
import { ClientUploader } from "./client-uploader";
import { UnlockForm } from "./unlock-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function TenantGalleryPage({ params, searchParams }: PageProps<"/t/[slug]/g/[gslug]">) {
  const { slug, gslug } = await params;
  const sp = await searchParams;
  const previewToken = typeof sp.preview === "string" ? sp.preview : null;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const gallery = await galleryBySlug(studio.id, gslug);
  if (!gallery) notFound();
  const previewing = Boolean(previewToken) && verifyLink("preview", previewToken) === gallery.id;

  // Closed or expired.
  if (gallery.status !== "published" && !previewing) {
    return <Centered title="This gallery is not available" body={`Please contact ${studio.name} for the link.`} />;
  }
  if (!previewing && gallery.expires_at && new Date(gallery.expires_at) < new Date()) {
    return <Centered title="This gallery has expired" body={`Contact ${studio.name} at ${studio.email} if you still need these photos.`} />;
  }

  const method = unlockMethod(gallery);
  const unlocked = previewing || method === "open" || (await hasGalleryAccess(gallery.id));
  if (!unlocked) {
    return (
      <Centered title={gallery.title} body="Enter the code or password from your email to open this gallery.">
        <div className="mt-6 flex justify-center"><UnlockForm slug={slug} gslug={gslug} method={method} /></div>
      </Centered>
    );
  }

  const photos = await listPhotos(studio.id, gallery.id);
  const ready = photos.filter((p) => p.preview_url && !p.preview_url.startsWith("pending:"));
  const [favoriteRows, notes] = await Promise.all([
    rows<{ photo_id: string }>(await db()`select photo_id from photo_selections where gallery_id = ${gallery.id} and selected`),
    rows<{ photo_id: string; body: string }>(await db()`select photo_id, body from photo_comments where gallery_id = ${gallery.id} and author_role = 'client'`),
  ]);
  const favSet = new Set(favoriteRows.map((f) => f.photo_id));
  const noteMap = new Map(notes.map((n) => [n.photo_id, n.body]));
  const clientPhotos: ClientPhoto[] = ready.map((p) => ({ id: p.id, filename: p.filename, width: p.width, height: p.height, favorite: favSet.has(p.id), note: noteMap.get(p.id) ?? null }));

  const order = gallery.order_id ? await getOrder(studio.id, gallery.order_id) : null;
  const payments = gallery.order_id ? await listPayments(gallery.order_id) : [];
  const gate = downloadGate(gallery, order, payments, favSet.size);
  const included = one<{ included: number }>(await db()`select included_finals as included from orders where id = ${gallery.order_id ?? null}`);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-accent)]">{gallery.kind === "final" ? "Your photos are ready" : "Your proofs are ready"}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{gallery.title}</h1>
        {gallery.welcome_message ? <p className="mt-2 text-[var(--site-ink-2)] max-w-2xl">{gallery.welcome_message}</p> : null}
      </header>

      {gallery.pay_gated && gate === "locked_unpaid" && order ? (
        <div className="mb-6 rounded-xl border border-[var(--site-line)] bg-[var(--site-bg-2)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm">Your downloads unlock once the balance is paid.</p>
          <a href={payUrl(studio, order.id)} className="inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-4 h-10 text-sm font-medium">Pay {formatBalance(order, payments, favSet.size)}</a>
        </div>
      ) : null}

      {gallery.allow_client_upload ? <div className="mb-6"><ClientUploader galleryId={gallery.id} /></div> : null}

      {clientPhotos.length === 0 ? (
        <p className="text-[var(--site-ink-2)]">{gallery.allow_client_upload ? "No photos yet. Add yours above." : "Photos are being prepared. Please check back shortly."}</p>
      ) : (
        <GalleryView
          galleryId={gallery.id}
          photos={clientPhotos}
          allowComments={gallery.allow_comments}
          favoritesLimit={included?.included || null}
          download={{
            web: gate === "open" && (gallery.download_size === "web" || gallery.download_size === "both"),
            full: gate === "open" && (gallery.download_size === "full" || gallery.download_size === "both"),
            pinRequired: Boolean(gallery.download_pin_hash),
          }}
          shareUrl={sharingAllowed(gallery) ? galleryUrl(studio, gallery.slug) : null}
          previewToken={previewing ? previewToken : null}
        />
      )}
    </div>
  );
}

function formatBalance(order: Parameters<typeof orderMoney>[0], payments: Parameters<typeof orderMoney>[1], picks: number) {
  const m = orderMoney(order, payments, picks);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "usd" }).format(m.due_cents / 100);
}

function Centered({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{title}</h1>
      <p className="mt-3 text-[var(--site-ink-2)]">{body}</p>
      {children}
    </div>
  );
}
