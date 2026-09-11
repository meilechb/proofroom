import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="container-x py-5">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg">
          <Logo name={APP_NAME} /> {APP_NAME}
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center px-5 pb-16 pt-4 sm:pt-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="container-x py-6 text-xs text-muted flex gap-4">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/security">Security</Link>
      </footer>
    </div>
  );
}
