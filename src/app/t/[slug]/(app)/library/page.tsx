import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { ResendForm } from "./resend-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function LibraryRecoverPage({ params }: PageProps<"/t/[slug]/library">) {
  const { slug } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  return (
    <div className="mx-auto w-full max-w-md px-5 py-20">
      <h1 className="text-2xl font-semibold text-center" style={{ fontFamily: "var(--site-font-heading)" }}>Find your downloads</h1>
      <p className="mt-2 text-center text-[var(--site-ink-2)]">Enter the email you used at checkout and we&apos;ll send a fresh link to your latest order from {studio.name}.</p>
      <ResendForm slug={slug} />
    </div>
  );
}
