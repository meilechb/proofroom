import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { GRACE_DAYS, PLAN, RETENTION_DAYS, TRIAL_DAYS, formatPrice } from "@/lib/plans";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";
import { StartFreeLink } from "@/components/marketing/header";
import { Check, CompareTable, Faq, FinalCta, Heading, Lead, PriceLine, Section } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Pricing",
  description: `One plan, ${formatPrice(PLAN.monthlyCents)} a month. Every feature, unlimited seats, unlimited galleries, 0% commission. ${TRIAL_DAYS}-day free trial, no card needed.`,
  alternates: { canonical: "/pricing" },
};

/** What "everything included" means, by area (plan 8.10). */
const included: Array<{ area: string; items: string[] }> = [
  { area: "Galleries", items: ["Unlimited galleries and photos", "Favorites and per-photo notes", "Selection limits and paid extras", "Downloads unlocked by payment", "Watermarks, expiry, PIN and email gate", "Per-person team headshot galleries"] },
  { area: "Lightroom", items: ["Publish Service for Lightroom Classic", "Favorites back as flags, notes as keywords", "Republish edits in place", "Unlimited plugin tokens"] },
  { area: "Payments", items: ["Deposits, balances, extras, tips", "E-signed agreements", "Charged on your own Stripe account", "0% platform commission", "Manual payments (cash, check, bank)"] },
  { area: "Website", items: ["Two templates, your colors and photos", "Your own domain with SSL", "Portfolio and areas pages", "Contact and booking forms", "SEO basics and sitemap"] },
  { area: "CRM", items: ["Inbox, clients, sessions", "Packages and orders", "Tasks and calendar", "Import from other tools and CSV", "Client hub with all their galleries and invoices"] },
  { area: "Email", items: ["Send from your own domain", "Delivery, reminder and follow-up automations", "Broadcasts to clients", "Unsubscribe and suppression handled"] },
  { area: "Team", items: ["Unlimited seats", "Owner, admin and member roles", "Audit log", "Multiple studios per login"] },
  { area: "Support", items: ["Email support", "Export everything, any time", `${RETENTION_DAYS}-day data retention after cancellation`] },
];

const faq = [
  { q: "Is it really one price?", a: `Yes. ${formatPrice(PLAN.monthlyCents)} a month per studio, billed monthly. Every feature is on, for every studio, from the first day of the trial.` },
  { q: "Are there storage limits?", a: "No storage tiers. Upload what your work needs. We ask that you use the platform for your own client work (see fair use), which is the only limit." },
  { q: "How many people can log in?", a: "As many as you like. Seats are unlimited and cost nothing extra." },
  { q: "What does 0% commission mean in practice?", a: `Clients pay on your own Stripe account. ${APP_NAME} adds no fee to any payment and never holds funds. Stripe charges its standard processing fee, which goes to Stripe.` },
  { q: "What happens when the trial ends?", a: `You add a card and continue, or you do nothing and the studio becomes read-only. Galleries and your website stay online for ${GRACE_DAYS} days so clients are never cut off without warning.` },
  { q: "Can I cancel?", a: `Any time, from the billing page. Your studio stays active until the end of the period you paid for, and your data is kept for ${RETENTION_DAYS} days so you can export it.` },
  { q: "Do you offer annual billing?", a: "Not yet. Monthly only while the product is new. When annual billing arrives, existing studios will be offered it first." },
  { q: "How does the referral program work?", a: `Share your link. When a studio you refer starts paying, you both get ${REFERRAL_REWARD_TEXT} applied to your invoices automatically.` },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pb-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pricing</p>
          <Heading level={1} className="mt-3 text-4xl sm:text-5xl">One plan. Everything included.</Heading>
          <Lead className="mx-auto">No tiers, no storage caps, no per-seat fees, no commission on what you sell. Try it for {TRIAL_DAYS} days without a card.</Lead>
        </div>

        <div className="mt-12 card card-pad max-w-4xl mx-auto lg:grid lg:grid-cols-[1fr_1.2fr] lg:gap-10">
          <div>
            <h2 className="text-xl font-semibold">{PLAN.name}</h2>
            <PriceLine className="mt-3" />
            <p className="mt-2 text-sm text-ink-2">Billed monthly. Cancel any time.</p>
            <div className="mt-6 flex flex-col gap-2">
              <StartFreeLink className="btn-primary btn-lg">Start free for {TRIAL_DAYS} days</StartFreeLink>
              <p className="text-center text-xs text-muted">No card needed for the trial.</p>
            </div>
            <div className="mt-6 rounded-lg bg-surface-2 p-4 text-sm">
              <p className="font-medium">Referral note</p>
              <p className="mt-1 text-ink-2">Every studio has a referral link. When someone you refer starts paying, you both get {REFERRAL_REWARD_TEXT}. <Link href="/referrals" className="underline">Program terms</Link>.</p>
            </div>
          </div>
          <ul className="mt-8 lg:mt-0 grid gap-2.5 sm:grid-cols-1">
            {PLAN.highlights.map((h) => <Check key={h}>{h}</Check>)}
          </ul>
        </div>
      </Section>

      <Section tone="surface">
        <div className="max-w-3xl">
          <Heading>What &ldquo;everything included&rdquo; means</Heading>
          <Lead>Every area of the product, on the one plan, from the first day.</Lead>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {included.map((group) => (
            <div key={group.area} className="card card-pad">
              <h3 className="font-semibold">{group.area}</h3>
              <ul className="mt-3 space-y-2">
                {group.items.map((i) => <Check key={i}>{i}</Check>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="max-w-3xl">
          <Heading>How the price compares</Heading>
          <Lead>Most gallery tools price by storage and keep a share of sales on the cheaper plans. Prices are the vendors&apos; published monthly rates on annual billing, checked September 2026.</Lead>
        </div>
        <div className="mt-8">
          <CompareTable
            caption="Top unlimited plan price and commission by vendor"
            columns={["Vendor", APP_NAME, "Pixieset", "Pic-Time", "ShootProof", "CloudSpot"]}
            rows={[
              ["Unlimited-storage plan", formatPrice(PLAN.monthlyCents), "$40", "$42", "$50", "$50"],
              ["Commission on sales", "0%", "0% on paid plans", "6% to 15% of markup", "0%", "0% from Lite"],
              ["Seats", "Unlimited", "Varies by plan", "Varies by plan", "Varies by plan", "Varies by plan"],
              ["Lightroom plugin", "Two-way (favorites and notes back)", "One-way publish", "One-way publish", "One-way publish", "One-way publish"],
              ["CRM included", "Yes", "Separate product", "No", "No", "From $17 plan"],
              ["Money flows through", "Your Stripe", "Vendor", "Vendor", "Vendor", "Vendor"],
            ]}
          />
          <p className="mt-3 text-xs text-muted">Sources and details on each <Link href="/compare/pixieset" className="underline">comparison page</Link>. Vendors change prices; tell us if something is out of date.</p>
        </div>
      </Section>

      <Section tone="surface">
        <Faq items={faq} title="Pricing questions" />
      </Section>
      <FinalCta />
    </>
  );
}
