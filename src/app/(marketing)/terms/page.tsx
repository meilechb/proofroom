import type { Metadata } from "next";
import { LegalDocument, legalDoc } from "@/components/marketing/legal-content";

const doc = legalDoc("terms")!;

export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: "/terms" } };

export default function Page() {
  return <LegalDocument doc={doc} />;
}
