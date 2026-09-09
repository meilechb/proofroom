import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { PLAN, TRIAL_DAYS, formatPrice } from "@/lib/plans";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";
import { Icon } from "@/components/ui/icons";
import { StartFreeLink } from "@/components/marketing/header";
import { Check, Faq, FeatureCard, FinalCta, Heading, Lead, PriceLine, Screenshot, Section, SectionHeader } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: `${APP_NAME}: client galleries, Lightroom plugin and payments in your own Stripe`,
  description: `Cull in Lightroom, deliver in one click, get paid in your own Stripe. Galleries, website, CRM and email for photographers. One plan, ${formatPrice(PLAN.monthlyCents)} a month, 0% commission.`,
  alternates: { canonical: "/" },
};

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
  { q: "Do you take a cut of my sales?", a: "No. Clients pay on your own Stripe account and the money settles there. We charge the subscription and nothing else. Stripe's own card fees still apply, as they would with any processor." },
  { q: "Do I need a Stripe account?", a: "For card payments, yes. You connect an existing account or create one in a few minutes during setup. You can also record cash, check or bank payments by hand." },
  { q: "Which Lightroom does the plugin support?", a: "Lightroom Classic on macOS and Windows. The plugin publishes galleries and pulls favorites and notes back as flags and keywords. Lightroom (cloud) is not supported by Adobe's plugin SDK." },
  { q: "Is there really only one plan?", a: `Yes. ${formatPrice(PLAN.monthlyCents)} a month includes every feature and unlimited team members. There are no storage tiers to outgrow.` },
  { q: "What happens to my galleries if I cancel?", a: "Galleries and your website stay online for 30 days after a missed payment, and your data is kept for 90 days after cancellation so you can export it." },
  { q: "Can I use my own domain?", a: "Yes, for the website, the galleries and the emails you send. Setup walks you through the DNS records." },
  { q: "Can my team log in?", a: "Yes. Invite as many people as you like as admins or members. Seats are unlimited on the one plan." },
  { q: "Is there a free trial?", a: `${TRIAL_DAYS} days, no card needed. Import your clients, publish a gallery from Lightroom and get paid before you decide.` },
];

export default function HomePage() {
  return (
    <>
      {/* Hero (plan 8.3) */}
      <Section className="pt-14 sm:pt-20 pb-10 sm:pb-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> Built for photographers who bill for their time
            </p>
            <Heading level={1} className="mt-6">
              Cull in Lightroom.<br />Deliver in one click.<br />Get paid in your own Stripe.
            </Heading>
            <Lead>
              {APP_NAME} is the gallery, website, CRM and email tool for working photographers. Favorites and notes sync back into Lightroom Classic. Clients pay you directly, and we take 0%.
            </Lead>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <StartFreeLink className="btn-primary btn-lg">Start free for {TRIAL_DAYS} days</StartFreeLink>
              <Link href="/lightroom" className="btn-secondary btn-lg">See the Lightroom plugin</Link>
            </div>
            <p className="mt-4 text-sm text-muted">No card needed. {formatPrice(PLAN.monthlyCents)} a month after the trial. Everything included.</p>
          </div>
          <Screenshot label="Client gallery with favorites and notes" />
        </div>
      </Section>

      {/* Three steps (plan 8.4) */}
      <Section tone="surface">
        <SectionHeader eyebrow="How it works" title="Three steps from shoot to paid" lead="The whole job runs in the tools you already use: your camera, Lightroom, and Stripe." />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card card-pad">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper text-sm font-semibold" aria-hidden>{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Feature grid (plan 8.5) */}
      <Section>
        <SectionHeader eyebrow="Everything included" title="One tool for the business side of photography" lead="Every feature is on the one plan. Nothing to upgrade to, nothing to outgrow." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} href={f.href}>{f.body}</FeatureCard>
          ))}
        </div>
      </Section>

      {/* Your money is yours (plan 8.6) */}
      <Section tone="surface" id="money">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeader eyebrow="0% commission" title="Your money is yours" lead="Most gallery tools sit between you and your client's card and keep a percentage of what you sell. We do not." />
            <ul className="mt-8 space-y-3">
              <Check>Clients pay on <strong>your</strong> Stripe account. Funds land in your Stripe balance and pay out to your bank on Stripe&apos;s normal schedule.</Check>
              <Check>We never hold, route or touch the money, and we never add a platform fee. Only Stripe&apos;s standard card fee applies.</Check>
              <Check>Refunds and disputes are handled in your own Stripe dashboard, with full history.</Check>
              <Check>Already have Stripe? Connect it in one click. New to Stripe? Create an account during setup.</Check>
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

      {/* Lightroom plugin (plan 8.7) */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Screenshot label="Lightroom Classic: Publish Services with favorites synced" ratio="4/3" className="lg:order-2" />
          <div className="lg:order-1">
            <SectionHeader eyebrow="Two-way Lightroom Classic plugin" title="Publish from Lightroom. Get favorites and notes back." lead="The plugin adds a Publish Service. Drag photos in, hit Publish, and the gallery is live. When the client picks, their favorites become a flag and their notes become keywords in your catalog." />
            <ul className="mt-8 space-y-3">
              <Check>Republish edits in place. Clients see the new version at the same link.</Check>
              <Check>Selection limits and &ldquo;N included, extras cost $X&rdquo; are set per package and enforced in the gallery.</Check>
              <Check>Works with Smart Collections, so a &ldquo;client favorites&rdquo; set builds itself.</Check>
            </ul>
            <Link href="/lightroom" className="mt-8 inline-block font-medium underline">Install guide</Link>
          </div>
        </div>
      </Section>

      {/* Pricing teaser (plan 8.8) */}
      <Section tone="surface" id="pricing">
        <div className="card card-pad max-w-3xl mx-auto md:flex md:items-center md:justify-between md:gap-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">One plan</p>
            <PriceLine className="mt-2" />
            <p className="mt-2 text-sm text-ink-2">{PLAN.tagline} {TRIAL_DAYS}-day free trial, no card needed. Refer a studio and you both get {REFERRAL_REWARD_TEXT}.</p>
          </div>
          <div className="mt-6 md:mt-0 flex flex-col gap-2 shrink-0">
            <StartFreeLink className="btn-primary btn-lg">Start free</StartFreeLink>
            <Link href="/pricing" className="btn-ghost">What is included</Link>
          </div>
        </div>
      </Section>

      {/* FAQ and final CTA (plan 8.9) */}
      <Section>
        <Faq items={faq} />
      </Section>
      <FinalCta />
    </>
  );
}
