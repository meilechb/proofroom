import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { getSendingDomain, dnsRows, dmarcSuggestion, type SendingDomainStatus } from "@/lib/sending-domains";
import { Card, Badge, Notice, Table, Th, Td } from "@/components/ui";
import { CopyButton } from "@/components/forms/copy-button";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { AddDomainForm, LocalPartForm, TestSendButton } from "./email-domain-forms";
import { checkEmailDomainAction, removeEmailDomainAction } from "./actions";

export const metadata: Metadata = { title: "Email domain" };

const STATUS: Record<SendingDomainStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  pending: { label: "Pending DNS", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  temporary_failure: { label: "Checking", tone: "warning" },
};

/** A studio's own email sending domain via Resend (plan 16.11-16.17). */
export default async function EmailDomainSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const domain = await getSendingDomain(ctx.studio.id);
  const suggestion = `mail.${(ctx.studio.custom_domain || "").replace(/^www\./, "") || "yourstudio.com"}`;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Send email from your own domain</h2>
            <p className="mt-1 text-sm text-ink-2 max-w-xl">
              By default your client emails come from our shared address with your name on them. Verify a domain you own and they leave from your address instead, which improves delivery and trust. We recommend a subdomain like <span className="font-mono text-xs">mail.yourstudio.com</span>.
            </p>
          </div>
          {domain ? <Badge tone={STATUS[domain.status].tone}>{STATUS[domain.status].label}</Badge> : <Badge>Not set</Badge>}
        </div>

        {!domain ? (
          <div className="mt-5"><AddDomainForm suggestion={suggestion} /></div>
        ) : (
          <div className="mt-5 space-y-5">
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              <div><dt className="text-muted text-xs">Domain</dt><dd className="font-mono text-xs">{domain.domain}</dd></div>
              <div><dt className="text-muted text-xs">Status</dt><dd>{STATUS[domain.status].label}</dd></div>
            </dl>

            {domain.status === "verified" ? (
              <Notice tone="success">Verified. Your client emails now send from <span className="font-mono text-xs">{domain.from_local_part}@{domain.domain}</span>.</Notice>
            ) : (
              <>
                <p className="text-sm text-ink-2">Add these records at your DNS host. They can take a few minutes to a few hours to take effect.</p>
                <Table>
                  <thead><tr><Th>Type</Th><Th>Name</Th><Th>Value</Th><Th>Status</Th><Th className="w-0" /></tr></thead>
                  <tbody>
                    {dnsRows(domain.records).map((r, i) => (
                      <tr key={i}>
                        <Td><span className="font-mono text-xs">{r.type}</span></Td>
                        <Td><span className="font-mono text-xs break-all">{r.host}</span></Td>
                        <Td><span className="font-mono text-xs break-all">{r.value}</span></Td>
                        <Td><span className="text-xs text-muted capitalize">{r.status || "pending"}</span></Td>
                        <Td><CopyButton value={r.value} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}

            <div>
              <LocalPartForm localPart={domain.from_local_part} domain={domain.domain} />
            </div>

            <details className="rounded-lg border border-line p-3">
              <summary className="text-sm font-medium cursor-pointer">DMARC (optional but recommended)</summary>
              <p className="mt-2 text-xs text-ink-2">A DMARC record tells inboxes what to do with mail that fails checks. Start with this relaxed policy; you can tighten it later.</p>
              {(() => { const d = dmarcSuggestion(domain.domain, ctx.studio.email); return (
                <div className="mt-2 rounded-md bg-surface-2 p-2 text-xs font-mono break-all flex items-center justify-between gap-2">
                  <span>{d.host} {d.type} &ldquo;{d.value}&rdquo;</span>
                  <CopyButton value={d.value} />
                </div>
              ); })()}
            </details>

            <div className="flex flex-wrap items-center gap-2">
              {domain.status !== "verified" ? <form action={checkEmailDomainAction}><SubmitButton variant="secondary" size="sm">Check now</SubmitButton></form> : null}
              {domain.status === "verified" ? <TestSendButton /> : null}
              <form action={removeEmailDomainAction}>
                <ConfirmButton variant="ghost" size="sm" confirm={`Remove ${domain.domain}? Email will fall back to our shared sender.`}>Remove domain</ConfirmButton>
              </form>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
