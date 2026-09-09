import type { Metadata } from "next";
import { LegalDocument, legalDoc } from "@/components/marketing/legal-content";

const doc = legalDoc("cookies")!;

export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: "/cookies" } };

export default function Page() {
  return <LegalDocument doc={doc} />;
}
