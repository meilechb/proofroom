import Link from "next/link";
import type { ReactNode } from "react";
import type { Studio, Package } from "@/lib/types";
import { formatMoney } from "@/lib/types";
import type { Site, TemplateId } from "@/lib/site/schema";
import { buttonHref, navPages } from "@/lib/site/publish";
import { storeSettings } from "@/lib/store-shared";
import { assetUrl, type SiteAsset, type PortfolioItem, type Testimonial } from "@/lib/site/render";
import { APP_NAME, appUrl } from "@/lib/env";
import { billingState, entitlements } from "@/lib/plans";

/**
 * Public website sections (plan 14.1-14.16). One set of components; the two
 * templates differ only in styling driven by the `template` flag and the theme
 * CSS variables set on the tenant layout. Switching templates keeps content.
 */

type Ctx = { template: TemplateId; assets: Map<string, SiteAsset> };

function Img({ res, className, sizes }: { res: { src: string; alt: string } | null; className?: string; sizes?: string }) {
  if (!res?.src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={res.src} alt={res.alt} sizes={sizes} loading="lazy" className={className} />;
}

function CtaButton({ button, variant = "primary" }: { button: { label: string; target: string; url?: string }; variant?: "primary" | "ghost" }) {
  if (!button.label) return null;
  const href = buttonHref(button);
  const cls = variant === "primary"
    ? "inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-5 h-11 text-sm font-medium hover:opacity-90"
    : "inline-flex items-center justify-center rounded-lg border border-[var(--site-line)] px-5 h-11 text-sm font-medium hover:bg-[var(--site-bg-2)]";
  return href.startsWith("http") ? <a href={href} className={cls} target="_blank" rel="noopener">{button.label}</a> : <Link href={href} className={cls}>{button.label}</Link>;
}

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className ?? ""}`}>{children}</div>;
}

function Heading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${className ?? ""}`} style={{ fontFamily: "var(--site-font-heading)" }}>{children}</h2>;
}

// ---- Chrome ----------------------------------------------------------------

export function SiteHeader({ studio, site }: { studio: Studio; site: Site }) {
  const shopOn = storeSettings((studio.settings ?? {}) as Record<string, unknown>).enabled;
  const nav = shopOn ? [...navPages(site), { page: "shop", label: "Shop", path: "/shop" }] : navPages(site);
  return (
    <header className="border-b border-[var(--site-line)] sticky top-0 z-30 bg-[var(--site-bg)]/90 backdrop-blur">
      <Container className="h-16 flex items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2.5 font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>
          {studio.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={studio.logo_url} alt={studio.name} className="h-8 w-8 rounded-md object-contain" />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--site-primary)] text-[var(--site-primary-ink)]">{studio.name.charAt(0).toUpperCase()}</span>
          )}
          <span className="truncate">{studio.name}</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 text-sm" aria-label="Site">
          {nav.map((n) => <Link key={n.path} href={n.path} className="px-3 py-2 text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">{n.label}</Link>)}
        </nav>
        {site.book.enabled ? <Link href="/book" className="sm:hidden inline-flex items-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] px-3 h-9 text-sm">Book</Link> : null}
      </Container>
      <nav className="sm:hidden border-t border-[var(--site-line)] overflow-x-auto" aria-label="Site">
        <Container className="flex gap-1 py-2 text-sm">
          {nav.map((n) => <Link key={n.path} href={n.path} className="px-3 py-1.5 whitespace-nowrap text-[var(--site-ink-2)]">{n.label}</Link>)}
        </Container>
      </nav>
    </header>
  );
}

export function SiteFooter({ studio, site }: { studio: Studio; site: Site }) {
  const s = site.settings;
  const socials = Object.entries(s.social).filter(([, v]) => v);
  const showBadge = !entitlements(billingState(studio).effectivePlan).removeBranding;
  const badgeHref = studio.referral_code ? `${appUrl()}/?ref=${studio.referral_code}` : appUrl();
  return (
    <footer className="border-t border-[var(--site-line)] mt-20">
      <Container className="py-12 grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{studio.name}</p>
          {s.tagline ? <p className="mt-1 text-sm text-[var(--site-ink-2)]">{s.tagline}</p> : null}
          {s.address.locality ? <p className="mt-2 text-sm text-[var(--site-ink-2)]">{[s.address.locality, s.address.region].filter(Boolean).join(", ")}</p> : null}
        </div>
        <div className="text-sm">
          <p className="text-[var(--site-ink-2)]"><a href={`mailto:${studio.email}`} className="hover:text-[var(--site-ink)]">{studio.email}</a></p>
          {studio.phone ? <p className="text-[var(--site-ink-2)]">{studio.phone}</p> : null}
          {socials.length ? (
            <div className="mt-3 flex gap-3">
              {socials.map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener" className="capitalize text-[var(--site-ink-2)] hover:text-[var(--site-ink)]">{k}</a>)}
            </div>
          ) : null}
        </div>
        <div className="text-sm sm:text-right">
          <div className="flex sm:justify-end gap-3 text-[var(--site-ink-2)]">
            {navPages(site).slice(0, 4).map((n) => <Link key={n.path} href={n.path} className="hover:text-[var(--site-ink)]">{n.label}</Link>)}
          </div>
          <p className="mt-4 text-xs text-[var(--site-ink-2)]">© {new Date().getFullYear()} {studio.name}. {s.footerText}</p>
          {showBadge ? <a href={badgeHref} className="mt-1 inline-block text-xs text-[var(--site-ink-2)] hover:text-[var(--site-ink)]" target="_blank" rel="noopener">Powered by {APP_NAME}</a> : null}
        </div>
      </Container>
    </footer>
  );
}

// ---- Sections --------------------------------------------------------------

export function Hero({ hero, ctx }: { hero: Site["home"]["hero"]; ctx: Ctx }) {
  if (!hero.enabled) return null;
  const img = assetUrl(ctx.assets, hero.imageAssetId, "full");
  const gallery = ctx.template === "gallery";
  return (
    <section className={gallery && img ? "relative min-h-[70vh] flex items-end" : "py-16 sm:py-24"}>
      {gallery && img ? <><Img res={img} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/45" /></> : null}
      <Container className={gallery && img ? "relative pb-16 text-white" : "grid gap-10 lg:grid-cols-2 lg:items-center"}>
        <div className={gallery && img ? "max-w-2xl" : ""}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--site-font-heading)" }}>{hero.heading}</h1>
          {hero.subheading ? <p className={`mt-4 text-lg ${gallery && img ? "text-white/85" : "text-[var(--site-ink-2)]"} max-w-xl`}>{hero.subheading}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaButton button={hero.button} />
            <CtaButton button={hero.secondaryButton} variant="ghost" />
          </div>
        </div>
        {!gallery && img ? <div className="overflow-hidden rounded-2xl"><Img res={img} className="w-full object-cover aspect-[4/5]" /></div> : null}
      </Container>
    </section>
  );
}

export function Intro({ intro, ctx }: { intro: Site["home"]["intro"]; ctx: Ctx }) {
  if (!intro.enabled || (!intro.heading && !intro.body)) return null;
  const img = assetUrl(ctx.assets, intro.imageAssetId, "web");
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container className={img ? "grid gap-10 lg:grid-cols-2 lg:items-center" : "max-w-3xl"}>
        {img ? <div className="overflow-hidden rounded-2xl lg:order-2"><Img res={img} className="w-full object-cover aspect-square" /></div> : null}
        <div>
          {intro.heading ? <Heading>{intro.heading}</Heading> : null}
          {intro.body ? <p className="mt-4 text-[var(--site-ink-2)] leading-relaxed whitespace-pre-line">{intro.body}</p> : null}
        </div>
      </Container>
    </section>
  );
}

export function PortfolioStrip({ strip, items }: { strip: Site["home"]["portfolioStrip"]; items: PortfolioItem[] }) {
  if (!strip.enabled || items.length === 0) return null;
  const shown = items.slice(0, strip.limit);
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container>
        {strip.heading ? <Heading className="mb-8">{strip.heading}</Heading> : null}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shown.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl bg-[var(--site-bg-2)]">
              <Img res={{ src: p.thumb_url ?? p.url, alt: p.alt || p.caption || "" }} className="w-full object-cover aspect-square hover:scale-105 transition-transform" />
            </div>
          ))}
        </div>
        <div className="mt-8"><Link href="/portfolio" className="text-sm underline">See the full portfolio</Link></div>
      </Container>
    </section>
  );
}

export function PackagesSection({ heading, body, packages, buttonLabel = "Book", cur }: { heading?: string; body?: string; packages: Package[]; buttonLabel?: string; cur: string }) {
  if (packages.length === 0) return null;
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container>
        {heading ? <Heading>{heading}</Heading> : null}
        {body ? <p className="mt-3 text-[var(--site-ink-2)] max-w-2xl">{body}</p> : null}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[var(--site-line)] p-6 flex flex-col">
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{p.name}</h3>
              <p className="mt-2 text-2xl font-semibold">{formatMoney(p.price_cents, cur)}</p>
              {p.description ? <p className="mt-2 text-sm text-[var(--site-ink-2)]">{p.description}</p> : null}
              {p.includes.length ? (
                <ul className="mt-4 space-y-1.5 text-sm text-[var(--site-ink-2)] flex-1">
                  {p.includes.map((i) => <li key={i} className="flex gap-2"><span aria-hidden>·</span>{i}</li>)}
                </ul>
              ) : <div className="flex-1" />}
              <Link href="/contact" className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] h-10 text-sm font-medium">{buttonLabel}</Link>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Testimonials({ heading, limit, items }: { heading?: string; limit: number; items: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container>
        {heading ? <Heading className="mb-8">{heading}</Heading> : null}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, limit).map((t) => (
            <figure key={t.id} className="rounded-2xl border border-[var(--site-line)] p-6">
              {t.rating ? <div className="text-[var(--site-accent)] mb-2" aria-label={`${t.rating} out of 5`}>{"★".repeat(t.rating)}</div> : null}
              <blockquote className="text-sm leading-relaxed">{t.body}</blockquote>
              <figcaption className="mt-3 text-sm font-medium">{t.name}{t.source ? <span className="text-[var(--site-ink-2)] font-normal"> · {t.source}</span> : null}</figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Faq({ heading, items }: { heading?: string; items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container className="max-w-3xl">
        {heading ? <Heading className="mb-8">{heading}</Heading> : null}
        <dl className="divide-y divide-[var(--site-line)] border-y border-[var(--site-line)]">
          {items.map((it) => (
            <details key={it.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden"><dt>{it.q}</dt><span className="transition-transform group-open:rotate-45 text-[var(--site-ink-2)]">+</span></summary>
              <dd className="mt-3 text-sm text-[var(--site-ink-2)] leading-relaxed whitespace-pre-line">{it.a}</dd>
            </details>
          ))}
        </dl>
      </Container>
    </section>
  );
}

export function LocationSection({ location, settings }: { location: Site["home"]["location"]; settings: Site["settings"] }) {
  if (!location.enabled) return null;
  const a = settings.address;
  const hasAddress = a.street || a.locality;
  if (!location.body && !hasAddress) return null;
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container className="grid gap-6 sm:grid-cols-2">
        <div>
          {location.heading ? <Heading>{location.heading}</Heading> : null}
          {location.body ? <p className="mt-3 text-[var(--site-ink-2)]">{location.body}</p> : null}
        </div>
        <div className="text-sm text-[var(--site-ink-2)]">
          {hasAddress ? <p>{[a.street, a.locality, a.region, a.postalCode].filter(Boolean).join(", ")}</p> : null}
          {settings.hours ? <p className="mt-2 whitespace-pre-line">{settings.hours}</p> : null}
          {a.mapUrl ? <a href={a.mapUrl} target="_blank" rel="noopener" className="mt-2 inline-block underline">Get directions</a> : null}
        </div>
      </Container>
    </section>
  );
}

export function Cta({ cta, ctx }: { cta: { enabled: boolean; heading?: string; body?: string; button: { label: string; target: string; url?: string }; imageAssetId?: string | null }; ctx: Ctx }) {
  if (!cta.enabled || !cta.heading) return null;
  const img = cta.imageAssetId ? assetUrl(ctx.assets, cta.imageAssetId, "full") : null;
  return (
    <section className="relative py-20 border-t border-[var(--site-line)]">
      {img ? <><Img res={img} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/50" /></> : null}
      <Container className={`relative text-center ${img ? "text-white" : ""}`}>
        <Heading className="mx-auto">{cta.heading}</Heading>
        {cta.body ? <p className={`mt-3 ${img ? "text-white/85" : "text-[var(--site-ink-2)]"} max-w-xl mx-auto`}>{cta.body}</p> : null}
        <div className="mt-8 flex justify-center"><CtaButton button={cta.button} /></div>
      </Container>
    </section>
  );
}

export function PageHero({ heading, subheading, res }: { heading: string; subheading?: string; res?: { src: string; alt: string } | null }) {
  return (
    <section className="relative py-16 sm:py-20 border-b border-[var(--site-line)]">
      {res?.src ? <><Img res={res} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/45" /></> : null}
      <Container className={`relative ${res?.src ? "text-white" : ""}`}>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" style={{ fontFamily: "var(--site-font-heading)" }}>{heading}</h1>
        {subheading ? <p className={`mt-3 text-lg ${res?.src ? "text-white/85" : "text-[var(--site-ink-2)]"} max-w-2xl`}>{subheading}</p> : null}
      </Container>
    </section>
  );
}

export function Steps({ heading, items }: { heading?: string; items: { title: string; text: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container>
        {heading ? <Heading className="mb-10">{heading}</Heading> : null}
        <ol className="grid gap-8 sm:grid-cols-3">
          {items.map((s, i) => (
            <li key={i}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--site-primary)] text-[var(--site-primary-ink)] text-sm font-semibold">{i + 1}</span>
              <h3 className="mt-3 font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--site-ink-2)] leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function IncludedList({ heading, items }: { heading?: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="py-16 border-t border-[var(--site-line)]">
      <Container className="max-w-3xl">
        {heading ? <Heading className="mb-6">{heading}</Heading> : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => <li key={i} className="flex gap-3 text-sm"><span className="text-[var(--site-accent)]" aria-hidden>✓</span>{i}</li>)}
        </ul>
      </Container>
    </section>
  );
}

export { Container };
