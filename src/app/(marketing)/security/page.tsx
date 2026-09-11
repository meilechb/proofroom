import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, supportEmail } from "@/lib/env";
import { GRACE_DAYS, RETENTION_DAYS } from "@/lib/plans";
import { Heading, Lead, Section } from "@/components/marketing/sections";

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
  const [money, ...rest] = sections;
  return (
    <>
      <Section className="pb-8">
        <div className="max-w-3xl">
          <p className="eyebrow">Security</p>
          <Heading level={1} className="mt-3 text-4xl sm:text-5xl">How we handle what you trust us with</Heading>
          <Lead>Photographers hand us their work, their clients and their income. This page says plainly what we do with each.</Lead>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="flex flex-col gap-4">
          {/* Your money — pine panel, per the design handoff */}
          <div className="rounded-[20px] bg-pine-dark text-white p-8 sm:p-10">
            <Heading className="text-white">{money.title}</Heading>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {money.items.map((it) => (
                <div key={it.h}>
                  <dt className="font-semibold text-gold">{it.h}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-white/80">{it.p}</dd>
                </div>
              ))}
            </dl>
          </div>
          {rest.map((s) => (
            <div key={s.title} className="card p-6 sm:p-10">
              <Heading>{s.title}</Heading>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {s.items.map((it) => (
                  <div key={it.h}>
                    <dt className="font-semibold">{it.h}</dt>
                    <dd className="mt-1.5 text-sm text-ink-2 leading-relaxed">{it.p}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pt-0 pb-16">
        <div className="max-w-3xl rounded-2xl border border-dashed border-line-2 bg-surface-2 p-6 sm:p-8">
          <Heading level={3}>Reporting a vulnerability</Heading>
          <p className="mt-3 text-ink-2 leading-relaxed">
            Email <a href={`mailto:${supportEmail()}`} className="underline">{supportEmail()}</a> with the details. We reply within two business days, fix confirmed issues promptly and credit reporters who want it. Please do not access other studios&apos; data while testing.
          </p>
          <p className="mt-3 text-sm text-muted">Related: <Link href="/privacy" className="underline">Privacy policy</Link>, <Link href="/dpa" className="underline">Data processing terms</Link>.</p>
        </div>
      </Section>
    </>
  );
}
