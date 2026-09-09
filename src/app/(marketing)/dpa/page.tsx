import type { Metadata } from "next";
import { LegalDocument, legalDoc } from "@/components/marketing/legal-content";

const doc = legalDoc("dpa")!;

export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: "/dpa" } };

export default function Page() {
  return <LegalDocument doc={doc} />;
}
