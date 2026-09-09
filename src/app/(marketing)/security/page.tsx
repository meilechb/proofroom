import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, supportEmail } from "@/lib/env";
import { GRACE_DAYS, RETENTION_DAYS } from "@/lib/plans";
import { FinalCta, Heading, Lead, Section, SectionHeader } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Security",
  description: `How ${APP_NAME} handles your photos, your clients' data and your money: storage, encryption, payments that never touch us, backups and retention.`,
  alternates: { canonical: "/security" },
};

const sections: Array<{ title: string; items: Array<{ h: string; p: string }> }> = [
  {
    title: "Your money",
    items: [
      { h: "Payments never pass through us", p: "Card payments are created directly on your own Stripe account. We never receive, hold or route client funds, and we cannot delay a payout. Stripe handles card data; no card number ever reaches our servers." },
      { h: "You keep the account", p: "Disconnecting your Stripe account from the platform leaves the account, its history and its balance untouched. It is yours." },
      { h: "Our subscription is separate", p: "Your plan is billed by Stripe on our account. Your card for the subscription is stored by Stripe, not by us." },
    ],
  },
  {
    title: "Your photos and files",
    items: [
      { h: "Encrypted in transit and at rest", p: "Everything is served over HTTPS. Originals and uploads are stored in a private object store; links to originals are short-lived and signed." },
      { h: "Gallery previews", p: "Web-size previews are served through a CDN in modern formats. Metadata is stripped from previews by default; originals keep theirs for the download." },
      { h: "Downloads gated by you", p: "Downloads follow the rules you set per gallery: public, PIN, email gate, client-only, or locked until paid." },
    ],
  },
  {
    title: "Your account and your clients' data",
    items: [
      { h: "Passwords and sessions", p: "Passwords are hashed with a slow, salted algorithm. Sessions are server-side, revocable, and expire. Repeated failed logins lock the account temporarily." },
      { h: "Tenant isolation", p: "Every record carries the studio it belongs to and every query is scoped to it. Team roles restrict billing and settings to owners and admins. An audit log records sensitive actions." },
      { h: "Client data", p: "Client names, emails, notes and agreements exist to run your business. We do not sell them, share them with other studios, or use them to market to your clients." },
      { h: "Email", p: "Sending from your own domain requires DNS records that prove you control it. Unsubscribes and bounces are honored automatically." },
    ],
  },
  {
    title: "Infrastructure and continuity",
    items: [
      { h: "Providers", p: "The application runs on Vercel, data is stored in Neon (Postgres) and Vercel Blob, payments are by Stripe, and email is sent through Resend. Each is an established provider with its own published security program." },
      { h: "Backups", p: "The database has point-in-time recovery. Object storage is replicated by the provider. We test restores as part of the release process." },
      { h: "Retention", p: `If a subscription lapses, galleries and the website stay online for ${GRACE_DAYS} days while the studio is read-only. After cancellation, data is kept for ${RETENTION_DAYS} days so you can export it, then purged.` },
      { h: "Export", p: "Clients, sessions, orders and payments export to CSV at any time. Gallery originals download as zips. No lock-in." },
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <Section className="pb-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Security</p>
          <Heading level={1} className="mt-3 text-4xl sm:text-5xl">How we handle what you trust us with</Heading>
          <Lead>Photographers hand us their work, their clients and their income. This page says plainly what we do with each.</Lead>
        </div>
      </Section>
      {sections.map((s, i) => (
        <Section key={s.title} tone={i % 2 === 0 ? "surface" : "paper"} className="py-12 sm:py-16">
          <SectionHeader title={s.title} />
          <dl className="mt-8 grid gap-6 md:grid-cols-3">
            {s.items.map((it) => (
              <div key={it.h} className="card card-pad">
                <dt className="font-semibold">{it.h}</dt>
                <dd className="mt-2 text-sm text-ink-2 leading-relaxed">{it.p}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ))}
      <Section className="py-12">
        <div className="max-w-3xl">
          <Heading level={3}>Reporting a vulnerability</Heading>
          <p className="mt-3 text-ink-2 leading-relaxed">
            Email <a href={`mailto:${supportEmail()}`} className="underline">{supportEmail()}</a> with the details. We reply within two business days, fix confirmed issues promptly and credit reporters who want it. Please do not access other studios&apos; data while testing.
          </p>
          <p className="mt-3 text-sm text-muted">Related: <Link href="/privacy" className="underline">Privacy policy</Link>, <Link href="/dpa" className="underline">Data processing terms</Link>.</p>
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
