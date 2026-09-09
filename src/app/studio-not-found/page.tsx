import { APP_NAME, appUrl } from "@/lib/env";

export const metadata = { title: "Studio not found", robots: { index: false } };

export default function StudioNotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">No studio at this address</h1>
        <p className="mt-2 text-ink-2">
          This domain is not connected to a {APP_NAME} studio yet. If you are the photographer, connect it under Settings → Domain.
        </p>
        <a href={appUrl()} className="btn-secondary mt-6">Go to {APP_NAME}</a>
      </div>
    </main>
  );
}
