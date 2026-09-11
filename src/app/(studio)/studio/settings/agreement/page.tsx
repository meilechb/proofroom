import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { activeAgreement } from "@/lib/agreement-data";
import { DEFAULT_AGREEMENT_MD } from "@/lib/agreements";
import { Card } from "@/components/ui";
import { AgreementForm } from "./agreement-form";

export const metadata: Metadata = { title: "Agreement" };

/** Editor for the client agreement clients sign on the pay page (plan 2.31). */
export default async function AgreementSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const current = await activeAgreement(ctx.studio.id);
  return (
    <Card>
      <h2 className="font-medium mb-1">Client agreement</h2>
      <p className="text-sm text-ink-2 mb-4 max-w-2xl">
        The contract clients read and sign on the pay page before a session. Write the terms in Markdown; the double-brace
        variables are filled in per session. Saving creates a new version — sessions already signed keep the version they agreed to.
      </p>
      <AgreementForm
        initialBody={current?.body_md ?? DEFAULT_AGREEMENT_MD}
        version={current?.version ?? null}
        studioName={ctx.studio.name}
        studioEmail={ctx.studio.email ?? "you@studio.com"}
      />
    </Card>
  );
}
