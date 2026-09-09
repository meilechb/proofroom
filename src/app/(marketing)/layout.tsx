import { APP_NAME } from "@/lib/env";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

/**
 * Public marketing site on the root domain (plan 8.1). Every page inside gets
 * the header, footer, a skip link and the shared landmarks (plan 8.23).
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-secondary">
        Skip to content
      </a>
      <MarketingHeader appName={APP_NAME} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
