import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_NAME, appUrl } from "@/lib/env";
import { studioBySlug } from "@/lib/tenant-data";

/** Minimal chrome for client-facing app pages (galleries, pay, hub): logo, name, powered-by (plan 13.1). */
export default async function TenantAppLayout({ children, params }: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  return (
    <>
      <header className="border-b border-[var(--site-line)]">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 h-16 flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-3">
            {studio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={studio.logo_url} alt={studio.name} className="h-8 w-8 rounded-md object-contain" />
            ) : (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-semibold">{studio.name.charAt(0).toUpperCase()}</span>
            )}
            <span className="font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{studio.name}</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--site-line)] mt-16">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 py-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-[var(--site-ink-2)]">
          <span>© {new Date().getFullYear()} {studio.name}</span>
          <a href={appUrl()} className="hover:text-[var(--site-ink)]" target="_blank" rel="noopener">Powered by {APP_NAME}</a>
        </div>
      </footer>
    </>
  );
}
