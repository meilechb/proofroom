import { studioBySlug } from "@/lib/tenant-data";
import { notFound } from "next/navigation";

export const metadata = { robots: { index: false, follow: false } };

export default async function EnterGalleryPage({ params }: PageProps<"/t/[slug]/g"> ) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>Open a gallery</h1>
      <p className="mt-3 text-[var(--site-ink-2)]">Use the full link from your email. If you only have a code, the link in your email includes it.</p>
    </div>
  );
}
