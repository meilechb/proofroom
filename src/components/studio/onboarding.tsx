import Link from "next/link";
import { Card, cx } from "@/components/ui";
import { dismissOnboardingAction } from "@/app/(studio)/studio/actions";

const steps: Array<{ key: string; label: string; href: string; detail: string }> = [
  { key: "verified", label: "Confirm your email", href: "/studio/account", detail: "Needed before galleries and payment links go out." },
  { key: "branded", label: "Add your logo and brand color", href: "/studio/settings/branding", detail: "Galleries, emails and your website use them." },
  { key: "website", label: "Publish your website", href: "/studio/website", detail: "Home, portfolio, pricing, about and contact pages are ready to edit." },
  { key: "payments", label: "Connect Stripe for client payments", href: "/studio/settings/payments", detail: "Deposits and balances go straight to your bank. 0% commission." },
  { key: "packages", label: "Review your packages", href: "/studio/settings/packages", detail: "Prices, deposits and how many retouched images are included." },
  { key: "client", label: "Add your first client", href: "/studio/clients?new=1", detail: "Or wait for the first inquiry from your website." },
  { key: "gallery", label: "Create your first gallery", href: "/studio/galleries?new=1", detail: "Upload proofs, send the link and code." },
  { key: "lightroom", label: "Install the Lightroom plugin", href: "/studio/settings/lightroom", detail: "Publish straight from Lightroom and get favorites and notes back." },
];

export function OnboardingChecklist({ state }: { state: Record<string, boolean> }) {
  const done = steps.filter((s) => state[s.key]).length;
  return (
    <Card className="mt-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Set up your studio</h2>
          <p className="text-sm text-ink-2 mt-0.5">{done} of {steps.length} done</p>
        </div>
        <form action={dismissOnboardingAction}><button className="text-xs text-muted hover:text-ink">Hide</button></form>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} /></div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key} className={cx("flex items-start gap-3 rounded-lg border border-line p-3", state[s.key] && "opacity-60")}>
            <span className={cx("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]", state[s.key] ? "bg-success text-white border-success" : "border-line-2 text-muted")} aria-hidden>
              {state[s.key] ? "✓" : ""}
            </span>
            <div className="min-w-0">
              <Link href={s.href} className="text-sm font-medium hover:underline">{s.label}</Link>
              <p className="text-xs text-ink-2 mt-0.5">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
