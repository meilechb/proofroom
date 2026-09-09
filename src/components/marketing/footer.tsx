import Link from "next/link";
import { APP_NAME, supportEmail } from "@/lib/env";
import { Logo } from "@/components/ui";

const columns: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: "Product",
    links: [
      { href: "/features/galleries", label: "Client galleries" },
      { href: "/features/lightroom", label: "Lightroom plugin" },
      { href: "/features/payments", label: "Payments in your Stripe" },
      { href: "/features/website", label: "Website templates" },
      { href: "/features/crm", label: "CRM" },
      { href: "/features/team-headshots", label: "Team headshot days" },
      { href: "/features/booking", label: "Booking" },
      { href: "/features/email", label: "Email" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Compare",
    links: [
      { href: "/compare/pixieset", label: "vs Pixieset" },
      { href: "/compare/pic-time", label: "vs Pic-Time" },
      { href: "/compare/shootproof", label: "vs ShootProof" },
      { href: "/compare/cloudspot", label: "vs CloudSpot" },
      { href: "/compare/honeybook", label: "vs HoneyBook" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/lightroom", label: "Install the plugin" },
      { href: "/security", label: "Security" },
      { href: "/changelog", label: "Changelog" },
      { href: "/referrals", label: "Referral program" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/cookies", label: "Cookies" },
      { href: "/dpa", label: "Data processing" },
      { href: "/fair-use", label: "Fair use" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface mt-auto">
      <div className="container-x py-12 grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <Logo name={APP_NAME} /> {APP_NAME}
          </Link>
          <p className="mt-3 text-sm text-ink-2 max-w-xs">Client galleries, a Lightroom plugin, a website and a CRM for photographers. Paid into your own Stripe account, with no commission.</p>
          <p className="mt-4 text-sm text-ink-2">
            <a href={`mailto:${supportEmail()}`} className="underline hover:text-ink">{supportEmail()}</a>
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-2 hover:text-ink">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x py-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs text-muted">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden />
            <Link href="/api/health" className="hover:text-ink">System status</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
