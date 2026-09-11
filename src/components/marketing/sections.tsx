import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { StartFreeLink } from "@/components/marketing/header";
import { PLANS, PRO_SEAT_CENTS, TRIAL_DAYS, formatPrice } from "@/lib/plans";

/** Building blocks shared by every marketing page (plan 8.3 to 8.15). */

export function Section({ children, className, tone = "paper", id }: { children: ReactNode; className?: string; tone?: "paper" | "surface" | "ink" | "pine"; id?: string }) {
  const tones = { paper: "", surface: "bg-surface border-y border-line", ink: "bg-ink text-paper", pine: "bg-pine-deep text-white" } as const;
  return (
    <section id={id} className={cx("py-16 sm:py-24", tones[tone], className)}>
      <div className="container-x">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

export function Heading({ children, level = 2, className }: { children: ReactNode; level?: 1 | 2 | 3; className?: string }) {
  const cls = cx(level === 1 ? "text-[2.75rem] sm:text-6xl lg:text-[4.25rem] font-normal leading-[1.03]" : level === 2 ? "text-3xl sm:text-[2.6rem] font-normal leading-[1.1]" : "text-xl font-medium", className);
  if (level === 1) return <h1 className={cls}>{children}</h1>;
  if (level === 3) return <h3 className={cls}>{children}</h3>;
  return <h2 className={cls}>{children}</h2>;
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("mt-4 text-lg text-ink-2 leading-relaxed max-w-2xl", className)}>{children}</p>;
}

export function SectionHeader({ eyebrow, title, lead, center }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={cx("max-w-3xl", center && "mx-auto text-center")}>
      {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
      <Heading>{title}</Heading>
      {lead ? <Lead className={cx(center && "mx-auto")}>{lead}</Lead> : null}
    </div>
  );
}

/** Placeholder where a real product screenshot goes at Phase 22 (plan 8.3). */
export function Screenshot({ label, ratio = "16/10", className }: { label: string; ratio?: string; className?: string }) {
  return (
    <figure className={cx("relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", className)} style={{ aspectRatio: ratio }}>
      <div className="absolute inset-x-0 top-0 h-9 border-b border-line bg-surface-2 flex items-center gap-1.5 px-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
      </div>
      <div className="absolute inset-0 top-9 grid grid-cols-6 gap-2 p-4" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-md bg-surface-2" style={{ gridColumn: i % 5 === 0 ? "span 2" : "span 1" }} />
        ))}
      </div>
      <figcaption className="absolute bottom-3 right-3 rounded-md bg-ink/80 px-2 py-1 text-xs text-paper">{label}</figcaption>
    </figure>
  );
}

export function FeatureCard({ icon, title, children, href }: { icon?: ReactNode; title: string; children: ReactNode; href?: string }) {
  const body = (
    <>
      {icon ? <div className="h-11 w-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center">{icon}</div> : null}
      <h3 className="mt-4 text-xl font-normal">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{children}</p>
    </>
  );
  return href ? (
    <Link href={href} className="card card-pad block transition-all hover:border-brand/30 hover:shadow-[var(--shadow-lift)]">
      {body}
      <span className="mt-3 inline-block text-sm font-semibold text-brand">Learn more →</span>
    </Link>
  ) : (
    <div className="card card-pad">{body}</div>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-success" aria-hidden>
        <path d="m5 12 5 5L20 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

export function Faq({ items, title = "Questions" }: { items: Array<{ q: string; a: ReactNode }>; title?: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <Heading className="text-center">{title}</Heading>
      <dl className="mt-10 divide-y divide-line border-y border-line">
        {items.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              <dt>{item.q}</dt>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-open:rotate-180" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <dd className="mt-3 text-sm text-ink-2 leading-relaxed prose-plain">{item.a}</dd>
          </details>
        ))}
      </dl>
    </div>
  );
}

export function PriceLine({ className }: { className?: string }) {
  return (
    <p className={cx("flex items-baseline gap-2", className)}>
      <span className="font-display text-5xl font-normal">{formatPrice(PRO_SEAT_CENTS)}</span>
      <span className="text-ink-2">per seat, per month</span>
    </p>
  );
}

/**
 * The two-tier pricing block (Free vs Pro), used on the home teaser and the
 * pricing page. Both CTAs start the same signup; every new studio gets a
 * 14-day Pro trial, then stays on Free unless it subscribes.
 */
export function PricingCards({ className }: { className?: string }) {
  return (
    <div className={cx("grid gap-6 md:grid-cols-2 max-w-4xl mx-auto items-start", className)}>
      <div className="card card-pad flex flex-col">
        <h3 className="text-xl font-normal">Free</h3>
        <p className="mt-1 text-sm text-ink-2">For solo photographers getting started.</p>
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-normal">$0</span>
          <span className="text-ink-2">forever</span>
        </p>
        <StartFreeLink className="btn-secondary btn-lg btn-pill mt-6 w-full justify-center">Start free</StartFreeLink>
        <p className="mt-2 text-center text-xs text-muted">No card needed.</p>
        <ul className="mt-8 space-y-3">
          {PLANS.free.highlights.map((h) => <Check key={h}>{h}</Check>)}
        </ul>
      </div>
      <div className="card card-pad relative flex flex-col ring-2 ring-brand">
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-ink">Most popular</span>
        <h3 className="text-xl font-normal">Pro</h3>
        <p className="mt-1 text-sm text-ink-2">Everything, for your whole team.</p>
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-normal">{formatPrice(PRO_SEAT_CENTS)}</span>
          <span className="text-ink-2">per seat / month</span>
        </p>
        <StartFreeLink className="btn-primary btn-lg btn-pill mt-6 w-full justify-center">Start free</StartFreeLink>
        <p className="mt-2 text-center text-xs text-muted">Every new studio gets {TRIAL_DAYS} days of Pro, free. No card.</p>
        <ul className="mt-8 space-y-3">
          {PLANS.pro.highlights.map((h) => <Check key={h}>{h}</Check>)}
        </ul>
      </div>
    </div>
  );
}

export function FinalCta({ title = "Start your free trial", lead }: { title?: string; lead?: ReactNode }) {
  return (
    <Section tone="pine">
      <div className="max-w-2xl mx-auto text-center">
        <Heading className="text-white">{title}</Heading>
        <p className="mt-4 text-lg text-white/80">
          {lead ?? `Start free, no card needed. Every new studio gets ${TRIAL_DAYS} days of Pro, then stays on Free or upgrades for ${formatPrice(PRO_SEAT_CENTS)} per seat.`}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <StartFreeLink className="btn-lg btn-pill inline-flex items-center justify-center bg-white text-pine px-7 h-12 text-base font-semibold hover:opacity-90">Start free</StartFreeLink>
          <Link href="/pricing" className="btn-lg btn-pill inline-flex items-center justify-center border border-white/40 text-white px-6 h-12 text-base font-semibold hover:bg-white/10">See pricing</Link>
        </div>
      </div>
    </Section>
  );
}

/** Simple responsive comparison table used on /pricing and /compare/*. */
export function CompareTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={cx("text-left font-semibold text-xs uppercase tracking-wide px-4 py-3 border-b border-line", i === 1 ? "text-ink bg-warning-bg/45" : "text-muted")}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className={cx("px-4 py-3 border-b border-line align-top", j === 0 && "font-medium", j === 1 && "bg-warning-bg/45")}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
