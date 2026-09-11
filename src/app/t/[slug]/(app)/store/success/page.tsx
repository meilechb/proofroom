export const metadata = { robots: { index: false, follow: false } };

export default function StoreSuccessPage() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Payment received</h1>
      <p className="mt-3 text-[var(--site-ink-2)]">Thank you! We&apos;ve emailed your download link — it can take a minute to arrive. You can close this page.</p>
    </div>
  );
}
