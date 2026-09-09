import type { Metadata } from "next";
import { LegalDocument, legalDoc } from "@/components/marketing/legal-content";

const doc = legalDoc("referrals")!;

export const metadata: Metadata = { title: doc.title, description: doc.description, alternates: { canonical: "/referrals" } };

export default function Page() {
  return <LegalDocument doc={doc} />;
}
