import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { PRO_SEAT_CENTS, FREE_STORAGE_BYTES, TRIAL_DAYS, formatPrice, formatBytes } from "@/lib/plans";
import { Icon } from "@/components/ui/icons";
import { StartFreeLink } from "@/components/marketing/header";
import { Check, Faq, FeatureCard, FinalCta, Heading, Lead, PricingCards, Screenshot, Section, SectionHeader } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: `${APP_NAME}: client galleries, Lightroom plugin and payments in your own Stripe`,
  description: `Cull in Lightroom, deliver in one click, get paid in your own Stripe — and keep 100% of what you charge. Galleries, website, CRM and email for photographers. Free to start; Pro is ${formatPrice(PRO_SEAT_CENTS)} per seat.`,
  alternates: { canonical: "/" },
};

const trust = ["0% commission", "Paid into your own Stripe", "Your own domain", "Free forever plan", "Cancel anytime"];

const steps = [
  { n: "1", title: "Shoot", body: "Book the session from your website or booking page. The client, package and deposit are already in your CRM before you pick up a camera." },
  { n: "2", title: "Publish from Lightroom", body: "Cull and edit as you always do. One click in the plugin creates the gallery, uploads the selects and emails the client." },
  { n: "3", title: "Client picks and pays", body: "They favorite, leave notes on photos, sign the agreement and pay the balance. Favorites and notes sync back into Lightroom." },
];

const features = [
  { icon: <Icon.Globe />, title: "Website from a template", href: "/features/website", body: "Two clean templates. Your photos, colors and words, on your own domain, live in an afternoon." },
  { icon: <Icon.Image />, title: "Client galleries", href: "/features/galleries", body: "Favorites, per-photo notes, selection limits, downloads that unlock when the balance is paid." },
  { icon: <Icon.Users />, title: "CRM", href: "/features/crm", body: "Inbox, clients, sessions, tasks and calendar in one place. No second tool to keep in sync." },
  { icon: <Icon.Card />, title: "Payments in your Stripe", href: "/features/payments", body: "Deposits, balances and extras charged on your own Stripe account. We take 0%." },
  { icon: <Icon.Mail />, title: "Email from your domain", href: "/features/email", body: "Gallery delivery, reminders and automations sent from you, not from us." },
  { icon: <Icon.Camera />, title: "Team headshot days", href: "/features/team-headshots", body: "One gallery per person, a master view for the office manager, retouch selection with limits." },
  { icon: <Icon.Calendar />, title: "Booking", href: "/features/booking", body: "A booking page with your real availability, holds, deposits and confirmation emails." },
  { icon: <Icon.Upload />, title: "Import", href: "/features/crm#import", body: "Bring clients and galleries over from Pixieset, Pic-Time, ShootProof, CloudSpot or a CSV." },
];

const faq = [
  { q: "Is it really free?", a: `Yes. The Free plan is free forever: 1 user, ${formatBytes(FREE_STORAGE_BYTES)} of galleries, client proofing, e-signed agreements, payments into your own Stripe and the Lightroom plugin. Upgrade to Pro when you want your team, a custom domain, automations, booking and more.` },
  { q: "Do you take a cut of my sales?", a: "No. Clients pay on your own Stripe account and the money settles there. We charge the subscription and nothing else. Stripe's own card fees still apply, as they would with any processor." },
  { q: "How does team pricing work?", a: `Pro is ${formatPrice(PRO_SEAT_CENTS)} per seat, per month. A solo photographer on Pro pays ${formatPrice(PRO_SEAT_CENTS)}; add a second shooter or an editor and it's ${formatPrice(PRO_SEAT_CENTS * 2)}. You only pay for the people on your account, and Free is always 1 seat at no cost.` },
  { q: "What happens when the trial ends, or if I cancel?", a: "Your studio moves to the Free plan — it never goes read-only. Your galleries and website stay live and all your data is kept; the Pro features simply switch off until you upgrade again. Nothing is deleted." },
  { q: "Do I need a Stripe account?", a: "For card payments, yes. You connect an existing account or create one in a few minutes during setup. You can also record cash, check or bank payments by hand." },
  { q: "Which Lightroom does the plugin support?", a: "Lightroom Classic on macOS and Windows, on both Free and Pro. The plugin publishes galleries and pulls favorites and notes back as flags and keywords. Lightroom (cloud) is not supported by Adobe's plugin SDK." },
  { q: "Can I use my own domain?", a: "On Pro, yes — for the website, the galleries and the emails you send. Setup walks you through the DNS records. Free studios get a clean subdomain." },
  { q: "Is there a free trial of Pro?", a: `Every new studio gets ${TRIAL_DAYS} days of Pro with no card. Import your clients, publish a gallery from Lightroom and get paid before you decide. After that you stay on Free or upgrade — nothing is deleted either way.` },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-14 sm:pt-20 pb-10 sm:pb-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> Built for photographers who bill for their time
            </p>
            <Heading level={1} className="mt-6">
              Cull in Lightroom.<br />Deliver in one click.<br />Get paid in your own Stripe.
            </Heading>
            <Lead>
              {APP_NAME} is the gallery, website, CRM and email tool for working photographers. Favorites and notes sync back into Lightroom Classic, clients pay you directly, and you keep 100% of what you charge.
            </Lead>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <StartFreeLink className="btn-primary btn-lg btn-pill">Start free</StartFreeLink>
              <Link href="/lightroom" className="btn-secondary btn-lg btn-pill">See the Lightroom plugin</Link>
            </div>
            <p className="mt-4 text-sm text-muted">Free forever for solo photographers, no card. Every new studio also gets {TRIAL_DAYS} days of Pro.</p>
          </div>
          <Screenshot label="Client gallery with favorites and notes" />
        </div>
        <ul className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2">
          {trust.map((t) => (
            <li key={t} className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* Three steps */}
      <Section tone="surface">
        <SectionHeader eyebrow="How it works" title="Three steps from shoot to paid" lead="The whole job runs in the tools you already use: your camera, Lightroom, and Stripe." />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card card-pad">
              <span className="font-display inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/12 text-accent text-lg italic" aria-hidden>{s.n}</span>
              <h3 className="mt-4 text-xl font-normal">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Your money is yours */}
      <Section id="money">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeader eyebrow="0% commission" title="Keep every dollar you charge" lead="Most gallery tools and marketplaces sit between you and your client's card and take a percentage of what you sell. We never do." />
            <ul className="mt-8 space-y-3">
              <Check>Clients pay on <strong>your</strong> Stripe account. Funds land in your Stripe balance and pay out to your bank on Stripe&apos;s normal schedule.</Check>
              <Check>We never hold, route or touch the money, and we never add a platform fee. Only Stripe&apos;s standard card fee applies.</Check>
              <Check>Refunds and disputes are handled in your own Stripe dashboard, with full history.</Check>
              <Check>0% commission on <strong>both</strong> Free and Pro — taking payments is not something we charge extra for.</Check>
            </ul>
            <Link href="/features/payments" className="mt-8 inline-block font-medium underline">How payments work</Link>
          </div>
          <div className="card card-pad">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">A $1,200 wedding balance</p>
            <dl className="mt-4 divide-y divide-line text-sm">
              <div className="flex justify-between py-3"><dt>Gallery tool with 15% commission keeps</dt><dd className="font-medium text-danger">$180.00</dd></div>
              <div className="flex justify-between py-3"><dt>Marketplace with 6% commission keeps</dt><dd className="font-medium text-danger">$72.00</dd></div>
              <div className="flex justify-between py-3"><dt>{APP_NAME} keeps</dt><dd className="font-medium text-success">$0.00</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted">Stripe&apos;s card processing fee applies in every case and goes to Stripe, not to us.</p>
          </div>
        </div>
      </Section>

      {/* Feature grid */}
      <Section tone="surface">
        <SectionHeader eyebrow="One tool, not five" title="Everything the business side of photography needs" lead="Website, galleries, CRM, payments and email in one place — so your client's whole experience is yours, start to finish." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} href={f.href}>{f.body}</FeatureCard>
          ))}
        </div>
      </Section>

      {/* Lightroom plugin */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Screenshot label="Lightroom Classic: Publish Services with favorites synced" ratio="4/3" className="lg:order-2" />
          <div className="lg:order-1">
            <SectionHeader eyebrow="Two-way Lightroom Classic plugin" title="Publish from Lightroom. Get favorites and notes back." lead="The plugin adds a Publish Service. Drag photos in, hit Publish, and the gallery is live. When the client picks, their favorites become a flag and their notes become keywords in your catalog — on Free and Pro alike." />
            <ul className="mt-8 space-y-3">
              <Check>Republish edits in place. Clients see the new version at the same link.</Check>
              <Check>Selection limits and &ldquo;N included, extras cost $X&rdquo; are set per package and enforced in the gallery.</Check>
              <Check>Works with Smart Collections, so a &ldquo;client favorites&rdquo; set builds itself.</Check>
            </ul>
            <Link href="/lightroom" className="mt-8 inline-block font-medium underline">Install guide</Link>
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section tone="surface" id="pricing">
        <SectionHeader center eyebrow="Pricing" title="Start free. Upgrade when your studio grows." lead="No commission, no storage tiers to game, no charge for taking payments. Pay for seats only when you add a team." />
        <PricingCards className="mt-12" />
        <p className="mt-8 text-center text-sm text-ink-2">Refer another studio and you both get a discount. <Link href="/pricing" className="underline">See the full comparison</Link>.</p>
      </Section>

      {/* FAQ and final CTA */}
      <Section>
        <Faq items={faq} />
      </Section>
      <FinalCta />
    </>
  );
}
