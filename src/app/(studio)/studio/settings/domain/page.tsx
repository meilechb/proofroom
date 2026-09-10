import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { appDomain } from "@/lib/env";
import { checkCustomDomain, domainsManaged } from "@/lib/domains";
import { Badge, Card, Notice, Table, Th, Td } from "@/components/ui";
import { CopyButton } from "@/components/forms/copy-button";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { DomainForm } from "./domain-form";
import { checkDomainAction, removeDomainAction } from "./actions";

export const metadata: Metadata = { title: "Domain" };

/** A studio's own domain for its public site (plan 14.28-14.30). */
export default async function DomainSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const status = await checkCustomDomain(ctx.studio.id);
  const managed = domainsManaged();
  const subdomain = `${ctx.studio.slug}.${appDomain()}`;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Custom domain</h2>
            <p className="mt-1 text-sm text-ink-2 max-w-xl">
              Your site is always live at <span className="font-mono text-xs">{subdomain}</span>. Add a domain you own to serve it from your own address instead. HTTPS is set up for you once the domain points to us.
            </p>
          </div>
          {status.state === "active" ? <Badge tone="success">Live</Badge> : status.state === "pending" ? <Badge tone="warning">Pending DNS</Badge> : <Badge>Not set</Badge>}
        </div>

        {status.state === "none" ? (
          <div className="mt-5">
            <DomainForm />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              <div><dt className="text-muted">Domain</dt><dd className="font-mono text-xs">{status.domain}</dd></div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd>{status.state === "active" ? "Serving your site over HTTPS." : status.verified ? "Ownership confirmed. Waiting for DNS to point to us." : "Waiting for the DNS records below."}</dd>
              </div>
            </dl>

            {status.error ? <Notice tone="danger">We could not reach the domain service: {status.error}. Try checking again in a moment.</Notice> : null}

            {status.state === "active" ? (
              <Notice tone="success">
                <span className="font-mono text-xs">{status.domain}</span> is live. Visitors who use{" "}
                <span className="font-mono text-xs">www.{status.domain}</span> are sent to it automatically.
              </Notice>
            ) : (
              <>
                {!managed ? (
                  <Notice tone="warning">Automatic setup is not configured on this deployment yet. Once the platform connects its domain service, the exact DNS records will appear here.</Notice>
                ) : status.records.length ? (
                  <div className="space-y-2">
                    <p className="text-sm text-ink-2">Add these records at your domain registrar. DNS changes can take a few minutes to a few hours to take effect.</p>
                    <Table>
                      <thead>
                        <tr><Th>Purpose</Th><Th>Type</Th><Th>Name / Host</Th><Th>Value</Th><Th className="w-0" /></tr>
                      </thead>
                      <tbody>
                        {status.records.map((r, i) => (
                          <tr key={i}>
                            <Td>{r.purpose}</Td>
                            <Td><span className="font-mono text-xs">{r.type}</span></Td>
                            <Td><span className="font-mono text-xs break-all">{r.host}</span></Td>
                            <Td><span className="font-mono text-xs break-all">{r.value}</span></Td>
                            <Td><CopyButton value={r.value} /></Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <Notice tone="warning">No DNS records to show yet. Check again in a moment.</Notice>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              {status.state !== "active" && managed ? (
                <form action={checkDomainAction}><SubmitButton variant="secondary" size="sm">Check again</SubmitButton></form>
              ) : null}
              {status.state === "active" ? (
                <a href={`https://${status.domain}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Visit site</a>
              ) : null}
              <form action={removeDomainAction}>
                <ConfirmButton variant="ghost" size="sm" confirm={`Remove ${status.domain}? Your site stays live at ${subdomain}.`}>Remove domain</ConfirmButton>
              </form>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
