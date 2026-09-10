import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME, appDomain, supportEmail } from "@/lib/env";
import { PRO_SEAT_CENTS, FREE_STORAGE_BYTES, RETENTION_DAYS, TRIAL_DAYS, formatPrice, formatBytes } from "@/lib/plans";
import { REFERRAL_CAP_PER_YEAR, REFERRAL_REWARD_TEXT } from "@/lib/referrals";

/**
 * Legal pages (plan 8.15). Plain language. Two values are placeholders until
 * the company is registered and counsel has reviewed the text; both are also
 * listed in docs/BUILD-PLAN.md under launch (22.x):
 *   COMPANY       the legal entity that contracts with studios
 *   JURISDICTION  governing law and venue
 */
export const COMPANY = "[Company legal name]";
export const JURISDICTION = "[Governing law and venue]";
export const LEGAL_UPDATED = "September 9, 2026";

export type LegalDoc = { slug: string; title: string; description: string; body: ReactNode };

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-ink-2">{children}</p>;
}
function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-ink-2 leading-relaxed">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

const support = () => <a href={`mailto:${supportEmail()}`} className="underline">{supportEmail()}</a>;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of service",
    description: `The agreement between ${APP_NAME} and the studios that use it.`,
    body: (
      <>
        <P>These terms are a contract between you (the studio that opens an account) and {COMPANY}, which operates {APP_NAME} at {appDomain()}. By creating an account you accept them.</P>
        <H>1. The service</H>
        <P>{APP_NAME} provides client galleries, a Lightroom Classic plugin, a website builder, a client relationship system, booking, email sending and related tools for photography businesses. Features may change; we will not remove a core feature without notice.</P>
        <H>2. Your account</H>
        <Ul items={[
          "You must be at least 18 and able to enter a contract.",
          "You are responsible for everyone you invite to your studio and for keeping credentials and plugin tokens private.",
          "You must give accurate contact details and keep a working email address on the account.",
        ]} />
        <H>3. Subscription, trial and cancellation</H>
        <Ul items={[
          <>{APP_NAME} has a Free plan (1 user, {formatBytes(FREE_STORAGE_BYTES)} of storage) and a Pro plan at {formatPrice(PRO_SEAT_CENTS)} per seat per month, billed monthly in advance through Stripe on the number of team members on your studio.</>,
          <>New studios get a {TRIAL_DAYS}-day trial of Pro without a card. When it ends, you subscribe to Pro or the studio moves to the Free plan.</>,
          <>Cancelling Pro, or a failed payment, moves the studio to the Free plan at the end of the paid period. Your galleries, website and data are kept and the Pro-only features stop until you upgrade again. A studio is never made read-only for non-payment.</>,
          <>You can cancel at any time from the billing page. Fees already paid are not refunded except where the law requires it.</>,
          <>If you delete your account, we keep your data for {RETENTION_DAYS} days so you can export it, then delete it.</>,
          "We may change prices with at least 60 days' notice by email. The new price applies from your next renewal after that period.",
        ]} />
        <H>4. Your content</H>
        <P>You own the photos, text and data you upload. You grant us a licence to store, process, resize and serve that content only as needed to run the service for you. We do not use your photos or your clients&apos; data to train models, for advertising, or for any purpose other than providing the service. You are responsible for having the rights to what you upload and for your agreements with the people you photograph.</P>
        <H>5. Client payments</H>
        <P>Card payments from your clients are processed on your own Stripe account under Stripe&apos;s agreement with you. You are the merchant of record. {APP_NAME} charges no fee on those payments, never holds the funds, and is not a party to the sale. Refunds, disputes and taxes on your sales are your responsibility. Manual payments you record are your own bookkeeping.</P>
        <H>6. Acceptable use</H>
        <P>Use the service for your own photography business and the clients you serve. The <Link href="/fair-use" className="underline">fair use policy</Link> explains what unlimited storage covers. You may not upload unlawful content, content you have no right to, or content that harms minors; send spam; probe or disrupt the service; or resell access.</P>
        <H>7. Lightroom plugin</H>
        <P>The plugin is licensed to you for use with your studio while your account is active. You may install it on any number of computers your team uses. You may not redistribute or modify it. Lightroom Classic is Adobe&apos;s product; we are not affiliated with Adobe.</P>
        <H>8. Referral program</H>
        <P>The referral program is governed by its own <Link href="/referrals" className="underline">program terms</Link>.</P>
        <H>9. Availability and support</H>
        <P>We aim for continuous availability and publish a status endpoint. Planned maintenance is announced in the app. Support is by email at {support()}. We do not guarantee a response time but usually answer within one business day.</P>
        <H>10. Termination</H>
        <P>You can close your studio at any time. We may suspend or close an account that breaks these terms, does not pay, or creates legal or security risk, and we will tell you why unless the law prevents it. On closure the retention period in section 3 applies.</P>
        <H>11. Disclaimers and liability</H>
        <P>The service is provided as is. To the extent the law allows, we disclaim implied warranties and are not liable for indirect, incidental or consequential loss, or for lost profits or data. Our total liability to you for any claim is limited to the fees you paid us in the twelve months before the claim. Nothing here limits liability that cannot be limited by law.</P>
        <H>12. Changes to these terms</H>
        <P>We may update these terms. Material changes are announced by email at least 30 days before they take effect. Continuing to use the service after that date means you accept them.</P>
        <H>13. Governing law</H>
        <P>These terms are governed by {JURISDICTION}. Contact: {support()}.</P>
      </>
    ),
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    description: `What ${APP_NAME} collects, why, who sees it and how long it is kept.`,
    body: (
      <>
        <P>This policy explains what {COMPANY} (&ldquo;we&rdquo;) collects when you use {APP_NAME}, and what happens to it. It covers studio users, the people studios photograph, and visitors to this website.</P>
        <H>What we collect</H>
        <Ul items={[
          "Account data: your name, email, password hash, studio name and address, timezone, logo and brand colors.",
          "Billing data: your Stripe customer id and subscription status. Card numbers are held by Stripe, never by us.",
          "Studio data you enter: clients, sessions, packages, orders, agreements, emails and notes. For this data the studio is the controller and we are its processor; see the data processing terms.",
          "Photos and files you upload, and the favorites, notes and downloads your clients make in galleries.",
          "Usage data: server logs with IP address and user agent kept for 30 days for security, and daily aggregate counts of page and gallery views that contain no personal data.",
          "Emails we send on your behalf: recipient, subject, delivery status and any bounce or complaint, so the log next to the client is accurate.",
        ]} />
        <H>How we use it</H>
        <Ul items={[
          "To provide the service: host galleries, send the emails you trigger, record payments, sync with Lightroom.",
          "To bill you and send account notices (verification, password reset, receipts, trial reminders).",
          "To keep the service secure: rate limiting, abuse detection, audit logs.",
          "To improve the product using aggregate usage. We do not profile individuals and we do not sell data.",
        ]} />
        <H>Who else sees it</H>
        <P>Providers who process data for us, under contracts that restrict their use of it: Vercel (hosting, file storage, CDN), Neon (database), Stripe (billing and, on your own account, client payments), Resend (email delivery). We disclose data when the law requires it and will tell you unless prohibited. If the business is sold, this policy continues to apply to data already collected.</P>
        <H>Cookies</H>
        <P>We use a small number of cookies needed to run the service and none for advertising. The <Link href="/cookies" className="underline">cookie page</Link> lists each one.</P>
        <H>Retention</H>
        <P>Account and studio data is kept while the studio is active, including after it moves to the Free plan, and for {RETENTION_DAYS} days after you delete your account, then deleted. Server logs are kept 30 days. Billing records are kept as long as tax law requires.</P>
        <H>Your rights</H>
        <P>You can export your data from the app at any time and delete your account from account settings. You may ask us to access, correct or delete personal data by emailing {support()}. If you are a client of a studio, contact the studio first; we will help them respond. Residents of the EU, UK, California and other places with privacy laws have additional rights under those laws, which we honor.</P>
        <H>Children</H>
        <P>The service is for businesses and is not directed at children. Studios that photograph minors are responsible for the consents their work requires.</P>
        <H>Changes</H>
        <P>We will post changes here and email account owners about material ones. Last updated {LEGAL_UPDATED}. Contact: {support()}.</P>
      </>
    ),
  },
  {
    slug: "cookies",
    title: "Cookies",
    description: `The cookies ${APP_NAME} sets and what each one does.`,
    body: (
      <>
        <P>We set only cookies the service needs. There are no advertising or cross-site tracking cookies, and marketing page views are counted without any cookie or personal identifier.</P>
        <div className="mt-6 card overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Cookies used</caption>
            <thead><tr><th scope="col" className="text-left px-4 py-3 border-b border-line font-medium">Cookie</th><th scope="col" className="text-left px-4 py-3 border-b border-line font-medium">Purpose</th><th scope="col" className="text-left px-4 py-3 border-b border-line font-medium">Lifetime</th></tr></thead>
            <tbody className="text-ink-2">
              <tr><td className="px-4 py-3 border-b border-line font-mono text-xs">pr_session</td><td className="px-4 py-3 border-b border-line">Keeps a studio user signed in. Server-side session, revocable from account settings.</td><td className="px-4 py-3 border-b border-line">30 days</td></tr>
              <tr><td className="px-4 py-3 border-b border-line font-mono text-xs">pr_g_&lt;gallery&gt;</td><td className="px-4 py-3 border-b border-line">Remembers that a visitor unlocked a protected gallery (PIN or email gate) so they are not asked again.</td><td className="px-4 py-3 border-b border-line">30 days</td></tr>
              <tr><td className="px-4 py-3 border-b border-line font-mono text-xs">ref</td><td className="px-4 py-3 border-b border-line">Remembers a referral code from a referral link so the referring studio is credited at signup.</td><td className="px-4 py-3 border-b border-line">30 days</td></tr>
              <tr><td className="px-4 py-3 border-b border-line font-mono text-xs">Stripe cookies</td><td className="px-4 py-3 border-b border-line">Set by Stripe on its own checkout and billing pages for fraud prevention. Governed by Stripe&apos;s policy.</td><td className="px-4 py-3 border-b border-line">Set by Stripe</td></tr>
            </tbody>
          </table>
        </div>
        <P>Because none of these cookies is used for advertising or analytics about you, no consent banner is shown. You can clear cookies in your browser at any time; you will be signed out.</P>
      </>
    ),
  },
  {
    slug: "dpa",
    title: "Data processing terms",
    description: `How ${APP_NAME} processes client personal data on behalf of studios.`,
    body: (
      <>
        <P>These terms form part of the <Link href="/terms" className="underline">terms of service</Link> and apply whenever a studio (the controller) stores personal data about its clients and their contacts in {APP_NAME}, which {COMPANY} (the processor) processes on the studio&apos;s behalf.</P>
        <H>1. Scope and instructions</H>
        <P>We process client personal data only to provide the service as described in the documentation and as you configure it in the app. Your use of the features is your documented instruction. We will tell you if an instruction appears to break the law.</P>
        <H>2. Data covered</H>
        <P>Names, email addresses, phone numbers, postal addresses, photographs, notes, agreements and signatures, payment status and amounts (not card numbers), and gallery activity, for your clients and the people they invite.</P>
        <H>3. Security</H>
        <P>Encryption in transit and at rest, tenant-scoped data access, role-based permissions, server-side sessions, audit logging, provider backups with point-in-time recovery, and the practices described on the <Link href="/security" className="underline">security page</Link>.</P>
        <H>4. Confidentiality and staff</H>
        <P>Access to production data is limited to staff who need it to run and support the service, under confidentiality obligations. Support access to your studio happens only at your request or to resolve an incident, and is logged.</P>
        <H>5. Sub-processors</H>
        <Ul items={[
          "Vercel Inc. (United States): application hosting, file storage, CDN.",
          "Neon Inc. (United States): Postgres database.",
          "Stripe Inc. (United States): subscription billing; client payments on your own Stripe account are under your direct agreement with Stripe.",
          "Resend Inc. (United States): email delivery.",
        ]} />
        <P>We will give at least 30 days&apos; notice by email before adding a sub-processor that handles client personal data. You may object on reasonable grounds; if we cannot resolve the objection you may terminate and export.</P>
        <H>6. Data subject requests</H>
        <P>The app lets you export, correct and delete client records yourself. If a person contacts us directly about your studio&apos;s data, we will refer them to you and help you respond within the time the law allows.</P>
        <H>7. Incidents</H>
        <P>We will notify you without undue delay, and within 72 hours of confirming it, of any personal data breach affecting your data, with what we know and what we are doing.</P>
        <H>8. International transfers</H>
        <P>Data is stored in the United States. For studios in the EU, UK or Switzerland we rely on standard contractual clauses (and the UK addendum) with our sub-processors, which are available on request.</P>
        <H>9. Return and deletion</H>
        <P>You can export at any time. Data is deleted {RETENTION_DAYS} days after your studio closes, and from backups on their normal rotation.</P>
        <H>10. Audit</H>
        <P>Once a year, on request, we will answer a reasonable security questionnaire and provide summaries of our providers&apos; audit reports where their terms allow.</P>
        <P>Last updated {LEGAL_UPDATED}. Contact: {support()}.</P>
      </>
    ),
  },
  {
    slug: "referrals",
    title: "Referral program terms",
    description: `${REFERRAL_REWARD_TEXT} for you and each studio you refer. Who qualifies and how the reward is applied.`,
    body: (
      <>
        <P>Every studio has a referral link. When a studio that signed up through your link starts paying, you both get {REFERRAL_REWARD_TEXT} on the {APP_NAME} subscription. These are the rules.</P>
        <H>How it works</H>
        <Ul items={[
          "Share your link from the Referrals page. A visitor who opens it and signs up within 30 days is recorded as referred by you.",
          "The referred studio can also enter your code on the signup form.",
          `The reward is triggered by the referred studio's first paid invoice, after its ${TRIAL_DAYS}-day trial.`,
          "At that moment both subscriptions get a 10% discount for the next 12 monthly invoices.",
          "If a subscription already has a discount, the new reward is queued and starts when the current one ends.",
          "If you are still on your trial when your referral pays, the reward waits and is applied when you subscribe.",
        ]} />
        <H>Limits</H>
        <Ul items={[
          `Up to ${REFERRAL_CAP_PER_YEAR} rewarded referrals per studio per calendar year.`,
          "One reward per referred studio, ever.",
          "Rewards apply to the subscription only. They have no cash value, cannot be transferred and are not paid out.",
        ]} />
        <H>What does not count</H>
        <Ul items={[
          "Referring yourself: the same person, the same email address, the same business domain, or the same payment card as the referring studio.",
          "Referrals where the first invoice is refunded or disputed within 30 days. The referral is voided and any discount already given is removed going forward.",
          "Paid advertising of your link, misleading claims about the product, or posting the link where it is not wanted.",
        ]} />
        <H>Changes</H>
        <P>We may change or end the program. Rewards already applied stay in place for their remaining months. Last updated {LEGAL_UPDATED}. Questions: {support()}.</P>
      </>
    ),
  },
  {
    slug: "fair-use",
    title: "Fair use policy",
    description: `What "unlimited storage" means on ${APP_NAME}, and what it does not cover.`,
    body: (
      <>
        <P>The plan has no photo count or storage tier. This works because studios use the service for what it is built for: delivering their own client photography. This page sets the boundary.</P>
        <H>Covered</H>
        <Ul items={[
          "Photos and videos you made for your clients, at any resolution, in galleries you deliver through the service.",
          "Your portfolio, website images and brand assets.",
          "Documents that belong to the work: agreements, invoices, session plans.",
          "Keeping delivered galleries online for as long as you and your clients need them.",
        ]} />
        <H>Not covered</H>
        <Ul items={[
          "Using the service as a general backup or archive for files that are never delivered to a client, such as full RAW archives or drive mirrors.",
          "Hosting files for other photographers or businesses under one studio account, or reselling access.",
          "Automated bulk uploads or downloads unrelated to client delivery.",
          "Content that breaks the terms of service.",
        ]} />
        <H>How we handle it</H>
        <P>If a studio&apos;s usage looks like one of the cases above, we email the owner, explain what we see and agree a plan. We do not delete content or suspend an account over storage without talking to you first, except for unlawful content. Last updated {LEGAL_UPDATED}. Questions: {support()}.</P>
      </>
    ),
  },
];

export function legalDoc(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <div className="container-x py-14 sm:py-20">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16">
        <nav aria-label="Legal" className="mb-10 lg:mb-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Legal</p>
          <ul className="mt-3 flex flex-wrap lg:flex-col gap-1">
            {LEGAL_DOCS.map((d) => (
              <li key={d.slug}>
                <Link href={`/${d.slug}`} aria-current={d.slug === doc.slug ? "page" : undefined} className={d.slug === doc.slug ? "block rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium" : "block rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"}>
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
          <div className="mt-8">{doc.body}</div>
        </article>
      </div>
    </div>
  );
}
