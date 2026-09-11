import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURE_PAGES, featurePage } from "@/components/marketing/features-content";
import { StartFreeLink } from "@/components/marketing/header";
import { Faq, FeatureCard, FinalCta, Heading, Lead, Screenshot, Section, SectionHeader } from "@/components/marketing/sections";
import { TRIAL_DAYS } from "@/lib/plans";

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/features/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = featurePage(slug);
  if (!page) return {};
  return { title: page.metaTitle, description: page.description, alternates: { canonical: `/features/${page.slug}` } };
}

export default async function FeaturePage({ params }: PageProps<"/features/[slug]">) {
  const { slug } = await params;
  const page = featurePage(slug);
  if (!page) notFound();
  const related = page.related.map(featurePage).filter((f) => f !== null);

  return (
    <>
      <Section className="pb-10">
        <nav aria-label="Features" className="flex flex-wrap gap-1 -mx-1 mb-8">
          {FEATURE_PAGES.map((f) => (
            <Link key={f.slug} href={`/features/${f.slug}`} aria-current={f.slug === page.slug ? "page" : undefined} className={f.slug === page.slug ? "rounded-full bg-ink text-paper px-3 py-1 text-sm" : "rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:text-ink hover:bg-surface-2"}>
              {f.nav}
            </Link>
          ))}
        </nav>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">{page.eyebrow}</p>
            <Heading level={1} className="mt-3 text-4xl sm:text-5xl">{page.title}</Heading>
            <Lead>{page.lead}</Lead>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <StartFreeLink className="btn-primary btn-lg">Start free for {TRIAL_DAYS} days</StartFreeLink>
              <Link href="/pricing" className="btn-secondary btn-lg">See pricing</Link>
            </div>
          </div>
          <Screenshot label={page.screenshot} />
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.points.map((p) => (
            <FeatureCard key={p.title} title={p.title}>{p.body}</FeatureCard>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="How it works" title="Three steps" />
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {page.steps.map((s, i) => (
            <li key={s.title} className="card card-pad">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper text-sm font-semibold" aria-hidden>{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="surface">
        <Faq items={page.faq} title={`${page.nav} questions`} />
      </Section>

      <Section>
        <SectionHeader eyebrow="Works with" title="Related" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {related.map((r) => (
            <FeatureCard key={r.slug} title={r.nav} href={`/features/${r.slug}`}>{r.description}</FeatureCard>
          ))}
        </div>
      </Section>
      <FinalCta />
    </>
  );
}
