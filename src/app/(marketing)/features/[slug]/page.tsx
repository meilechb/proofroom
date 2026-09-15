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
            <p className="eyebrow">Features · {page.nav}</p>
            <Heading level={1} className="mt-3 text-4xl sm:text-5xl">{page.title}</Heading>
            <Lead>{page.lead}</Lead>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <StartFreeLink className="btn-primary btn-lg btn-pill">Start free for {TRIAL_DAYS} days</StartFreeLink>
              <Link href="/pricing" className="btn-secondary btn-lg btn-pill">See pricing</Link>
            </div>
          </div>
          <Screenshot label={page.screenshot} />
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.points.map((p, i) => (
            <div key={p.title} className="card card-pad">
              <span className="font-display inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand text-lg" aria-hidden>{i + 1}</span>
              <h3 className="mt-4 text-xl font-normal">{p.title}</h3>
              <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="rounded-[20px] bg-pine-dark text-white p-8 sm:p-12">
          <Heading className="text-white text-center">Three steps</Heading>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {page.steps.map((s, i) => (
              <li key={s.title}>
                <span className="font-display italic text-2xl text-gold" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-display text-xl font-normal">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
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
