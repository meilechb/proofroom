import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-ink-2">The link may be wrong, or the page may have been moved.</p>
        <Link href="/" className="btn-secondary mt-6">Go to the home page</Link>
      </div>
    </main>
  );
}
