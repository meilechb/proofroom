"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-ink-2">{error.message || "An unexpected error occurred."}</p>
        {error.digest ? <p className="mt-1 text-xs text-muted font-mono">Ref {error.digest}</p> : null}
        <button onClick={reset} className="btn-secondary mt-6">Try again</button>
      </div>
    </main>
  );
}
