import type { Metadata } from "next";
import { LegalDocument, legalDoc } from "@/components/marketing/legal-content";

const doc = legalDoc("privacy")!;

export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: "/privacy" } };

export default function Page() {
  return <LegalDocument doc={doc} />;
}
