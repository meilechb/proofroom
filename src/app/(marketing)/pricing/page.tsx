import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { PRO_SEAT_CENTS, FREE_STORAGE_BYTES, TRIAL_DAYS, formatPrice, formatBytes } from "@/lib/plans";
import { REFERRAL_REWARD_TEXT } from "@/lib/referrals";
import { CompareTable, Faq, FinalCta, Heading, Lead, PricingCards, Section } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Start free — 1 user, ${formatBytes(FREE_STORAGE_BYTES)}, 0% commission and the Lightroom plugin. Pro is ${formatPrice(PRO_SEAT_CENTS)} per seat for your whole team, a custom domain, automations and more. ${TRIAL_DAYS} days of Pro free, no card.`,
  alternates: { canonical: "/pricing" },
};

const yes = <span className="text-success" aria-label="Included">✓</span>;
const no = <span className="text-muted" aria-label="Not included">—</span>;

/** Free vs Pro, feature by feature. */
const planRows: Array<Array<React.ReactNode>> = [
  ["Team seats", "1", `Unlimited · ${formatPrice(PRO_SEAT_CENTS)} each`],
  ["Storage", formatBytes(FREE_STORAGE_BYTES), "Fair-use, uncapped"],
  ["Client galleries & proofing", yes, yes],
  ["Favorites, per-photo notes, downloads", yes, yes],
  ["CRM — clients, sessions, tasks", yes, yes],
  ["Packages, orders, e-signed agreements", yes, yes],
  ["Payments in your own Stripe (0%)", yes, yes],
  ["Lightroom Classic plugin", yes, yes],
  ["Public website", "Free subdomain", "Your own domain"],
  ["Client email", "From our domain", "Your own domain"],
  ["Email automations & broadcasts", no, yes],
  ["Booking page", no, yes],
  ["Import from other tools", no, yes],
  ["Session planning (shot list, mood board)", no, yes],
  ["Remove the platform badge", no, yes],
  ["Referral rewards", no, yes],
];

const faq = [
  { q: "How does per-seat pricing work?", a: `Pro is ${formatPrice(PRO_SEAT_CENTS)} per seat, per month. A solo photographer pays ${formatPrice(PRO_SEAT_CENTS)}; add a teammate and it's ${formatPrice(PRO_SEAT_CENTS * 2)}. You only pay for the people on your account. Free is always 1 seat at no cost.` },
  { q: "Is the Free plan really free forever?", a: `Yes. Free is ${formatBytes(FREE_STORAGE_BYTES)} of storage, 1 user, client galleries and proofing, e-signed agreements, payments into your own Stripe and the Lightroom plugin — with no time limit and no card.` },
  { q: "What does 0% commission mean in practice?", a: `Clients pay on your own Stripe account, on both Free and Pro. ${APP_NAME} adds no fee to any payment and never holds funds. Stripe charges its standard processing fee, which goes to Stripe.` },
  { q: "What happens when the Pro trial ends, or if I cancel?", a: "Your studio moves to the Free plan — it never goes read-only. Galleries and your website stay live and all your data is kept; the Pro features switch off until you upgrade again. Nothing is deleted." },
  { q: "Are there storage limits?", a: `Free includes ${formatBytes(FREE_STORAGE_BYTES)}. Pro has no storage tiers — upload what your work needs, within fair use for your own client work.` },
  { q: "Do you offer annual billing?", a: "Not yet. Monthly only while the product is new. When annual billing arrives, existing studios will be offered it first." },
  { q: "How does the referral program work?", a: `Share your link. When a studio you refer starts paying for Pro, you both get ${REFERRAL_REWARD_TEXT} applied to your invoices automatically.` },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pb-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pricing</p>
          <Heading level={1} className="mt-3 text-4xl sm:text-5xl">Start free. Upgrade when you grow.</Heading>
          <Lead className="mx-auto">No commission on what you sell, no storage tiers to game, no charge for taking payments. Pay for seats only when you add a team.</Lead>
        </div>
        <PricingCards className="mt-12" />
        <p className="mt-8 text-center text-sm text-ink-2">Every studio has a referral link — when a studio you refer starts paying, you both get {REFERRAL_REWARD_TEXT}. <Link href="/referrals" className="underline">Program terms</Link>.</p>
      </Section>

      <Section tone="surface">
        <div className="max-w-3xl">
          <Heading>What&apos;s in each plan</Heading>
          <Lead>Free is a real working tool, not a demo. Pro adds your team and the pro workflow on top.</Lead>
        </div>
        <div className="mt-8">
          <CompareTable caption="Free versus Pro, feature by feature" columns={["Feature", "Free", "Pro"]} rows={planRows} />
        </div>
      </Section>

      <Section>
        <div className="max-w-3xl">
          <Heading>How the price compares</Heading>
          <Lead>Most gallery tools price by storage and keep a share of sales on the cheaper plans. Prices are the vendors&apos; published monthly rates on annual billing, checked September 2026.</Lead>
        </div>
        <div className="mt-8">
          <CompareTable
            caption="Entry price and commission by vendor"
            columns={["Vendor", APP_NAME, "Pixieset", "Pic-Time", "ShootProof", "CloudSpot"]}
            rows={[
              ["Free plan", `Yes — ${formatBytes(FREE_STORAGE_BYTES)}, full proofing`, "Yes (limited)", "Trial only", "Yes (limited)", "Yes (limited)"],
              ["Paid from", `${formatPrice(PRO_SEAT_CENTS)}/seat`, "$40", "$42", "$50", "$50"],
              ["Commission on sales", "0%", "0% on paid plans", "6% to 15% of markup", "0%", "0% from Lite"],
              ["Team pricing", "Per seat, transparent", "Varies by plan", "Varies by plan", "Varies by plan", "Varies by plan"],
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
