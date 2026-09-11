import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/lib/env";
import { TRIAL_DAYS } from "@/lib/plans";
import { COMPARE_PAGES, comparePage } from "@/components/marketing/compare-content";
import { StartFreeLink } from "@/components/marketing/header";
import { CompareTable, Faq, FinalCta, Heading, Lead, Section, SectionHeader } from "@/components/marketing/sections";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARE_PAGES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = comparePage(slug);
  if (!page) return {};
  return { title: page.metaTitle, description: page.description, alternates: { canonical: `/compare/${page.slug}` } };
}

export default async function ComparePage({ params }: PageProps<"/compare/[slug]">) {
  const { slug } = await params;
  const page = comparePage(slug);
  if (!page) notFound();
  const columns = ["", APP_NAME, page.vendor];
  const toRows = (rows: typeof page.pricing) => rows.map((r) => [r.label, r.us, r.them]);

  return (
    <>
      <Section className="pb-10">
        <nav aria-label="Compare" className="flex flex-wrap gap-1 -mx-1 mb-8">
          {COMPARE_PAGES.map((c) => (
            <Link key={c.slug} href={`/compare/${c.slug}`} aria-current={c.slug === page.slug ? "page" : undefined} className={c.slug === page.slug ? "rounded-full bg-ink text-paper px-3 py-1 text-sm" : "rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:text-ink hover:bg-surface-2"}>
              vs {c.vendor}
            </Link>
          ))}
        </nav>
        <div className="max-w-3xl">
          <p className="eyebrow">Compare</p>
          <Heading level={1} className="mt-3 text-4xl sm:text-5xl">{APP_NAME} vs {page.vendor}</Heading>
          <Lead>{page.lead}</Lead>
          <p className="mt-4 text-sm text-muted">Last checked {page.lastChecked} against {page.vendor}&apos;s published pages, linked below. Tell us if something has changed.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <StartFreeLink className="btn-primary btn-lg btn-pill">Start free for {TRIAL_DAYS} days</StartFreeLink>
            <Link href="/pricing" className="btn-secondary btn-lg btn-pill">See pricing</Link>
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeader title="Price and commission" />
        <div className="mt-8"><CompareTable caption={`Pricing: ${APP_NAME} vs ${page.vendor}`} columns={columns} rows={toRows(page.pricing)} /></div>
      </Section>

      <Section>
        <SectionHeader title="Galleries, contracts and payments" />
        <div className="mt-8"><CompareTable caption={`Features: ${APP_NAME} vs ${page.vendor}`} columns={columns} rows={toRows(page.features)} /></div>
      </Section>

      <Section tone="surface">
        <SectionHeader title="Lightroom Classic" lead="Publishing from Lightroom is common. Getting the client's decisions back into Lightroom is not." />
        <div className="mt-8"><CompareTable caption={`Lightroom: ${APP_NAME} vs ${page.vendor}`} columns={columns} rows={toRows(page.lightroom)} /></div>
      </Section>

      <Section>
        <div className="rounded-2xl border border-warning/25 bg-warning-bg/40 p-6 sm:p-8">
          <Heading level={3}>When {page.vendor} is the better fit</Heading>
          <ul className="mt-4 space-y-2.5">
            {page.betterFit.map((b) => (
              <li key={b} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                <span className="mt-0.5 shrink-0 text-warning-fg" aria-hidden>•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <Heading level={3}>Sources</Heading>
            <ul className="mt-4 space-y-2 text-sm">
              {page.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="nofollow noopener" target="_blank" className="underline break-all">{s.label}</a>
                </li>
              ))}
              <li><Link href="/pricing" className="underline">{APP_NAME} pricing</Link></li>
            </ul>
          </div>
          <p className="text-xs text-muted leading-relaxed lg:self-end">{page.vendor} is a trademark of its owner. This page compares published information as of {page.lastChecked} and is not endorsed by {page.vendor}.</p>
        </div>
      </Section>

      <Section tone="surface">
        <Faq items={page.faq} title="Switching questions" />
      </Section>
      <FinalCta />
    </>
  );
}
