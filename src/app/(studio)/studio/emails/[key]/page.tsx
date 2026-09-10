import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { templatesByKey, templateKeys, type TemplateKey } from "@/lib/email-templates";
import { getTemplate } from "@/lib/email-templates-server";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Email template" };

export default async function EmailTemplatePage({ params }: PageProps<"/studio/emails/[key]">) {
  const { key } = await params;
  if (!(templateKeys as readonly string[]).includes(key)) notFound();
  const def = templatesByKey[key as TemplateKey];
  const ctx = await requireStudioPage("admin");
  const { values, customized } = await getTemplate(ctx.studio.id, key as TemplateKey);

  return (
    <div>
      <PageHeader
        eyebrow="Emails"
        title={def.name}
        description={def.when}
        actions={<Link href="/studio/emails" className="btn-ghost btn-sm">Back to emails</Link>}
      />
      <TemplateEditor def={def} initial={values} customized={customized} />
    </div>
  );
}
