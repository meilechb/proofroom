import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Small, dependency-free UI kit built on the primitives in globals.css. */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};
const sizeClass: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={cx(variantClass[variant], sizeClass[size], className)} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={cx(variantClass[variant], sizeClass[size], className)} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx("input", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx("textarea", className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx("select", className)} />;
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, children, pad = true }: { className?: string; children: ReactNode; pad?: boolean }) {
  return <div className={cx("card", pad && "card-pad", className)}>{children}</div>;
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "success" | "warning" | "danger" | "brand"; children: ReactNode; className?: string }) {
  return <span className={cx(`badge-${tone}`, className)}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-wide text-muted mb-1">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-2 max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card card-pad text-center py-12">
      <h3 className="font-medium">{title}</h3>
      {description ? <p className="mt-1 text-sm text-ink-2 max-w-md mx-auto">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "success" | "warning" | "danger"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 border-line text-ink-2",
    success: "bg-success-bg border-success/20 text-success",
    warning: "bg-warning-bg border-warning/20 text-warning",
    danger: "bg-danger-bg border-danger/20 text-danger",
  } as const;
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone], className)} role={tone === "danger" ? "alert" : undefined}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("card overflow-x-auto", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("text-left font-medium text-muted text-xs uppercase tracking-wide px-4 py-3 border-b border-line", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-4 py-3 border-b border-line align-middle", className)}>{children}</td>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card card-pad">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-brand";
  return (
    <div>
      {label ? <div className="flex justify-between text-xs text-muted mb-1"><span>{label}</span><span>{pct}%</span></div> : null}
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Logo({ name, logoUrl, size = 28 }: { name: string; logoUrl?: string | null; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} width={size} height={size} className="rounded-md object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-brand text-brand-ink font-semibold" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || "P"}
    </span>
  );
}
