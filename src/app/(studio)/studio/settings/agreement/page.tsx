import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { DEFAULT_AGREEMENT_MD, type AgreementVars } from "@/lib/agreements";
import { RETENTION_DAYS } from "@/lib/plans";
import { formatDate, formatMoney } from "@/lib/types";
import { Card } from "@/components/ui";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { AgreementForm } from "./agreement-form";
import { activateAgreementVersionAction, resetAgreementAction } from "./actions";

export const metadata: Metadata = { title: "Agreement" };

type Version = { id: string; version: number; body_md: string; is_active: boolean; created_at: string; created_by_name: string | null; signed_count: number };

/** Session agreement editor with versions and preview (plan 11.13). */
export default async function AgreementSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const versions = rows<Version>(
    await db()`
      select t.id, t.version, t.body_md, t.is_active, t.created_at::text, u.name as created_by_name,
        (select count(*)::int from orders o where o.studio_id = t.studio_id and o.contract_version = 'v' || t.version and o.contract_signed_at is not null) as signed_count
      from agreement_templates t left join users u on u.id = t.created_by
      where t.studio_id = ${ctx.studio.id} order by t.version desc`
  );
  const active = versions.find((v) => v.is_active) ?? versions[0] ?? null;
  const cur = ctx.studio.currency;
  const sample: AgreementVars = {
    studio_name: ctx.studio.name,
    studio_email: ctx.studio.email,
    client_name: "Jordan Lee",
    session_title: "Executive headshots",
    session_date: "March 3, 2026",
    price: formatMoney(45000, cur),
    deposit: formatMoney(15000, cur),
    balance: formatMoney(30000, cur),
    included_finals: "5",
    extra_final_price: formatMoney(7500, cur),
    retention_days: String(RETENTION_DAYS),
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-medium">Session agreement</h2>
            <p className="text-sm text-ink-2 mt-1">Clients read and sign this on the pay page before their first payment. Every save creates a new version; signed sessions keep the version they signed.</p>
          </div>
          <form action={resetAgreementAction}><ConfirmButton variant="secondary" size="sm" confirm="Replace the current wording with the default agreement? Your current text stays available as an earlier version.">Restore default</ConfirmButton></form>
        </div>
        <AgreementForm key={active?.id ?? "default"} initial={active?.body_md ?? DEFAULT_AGREEMENT_MD} sample={sample} />
      </Card>
      {versions.length > 0 ? (
        <Card>
          <h2 className="font-medium mb-3">Versions</h2>
          <ul className="divide-y divide-line text-sm">
            {versions.map((v) => (
              <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Version {v.version}</span>
                  {v.is_active ? <span className="ml-2 badge badge-success">Active</span> : null}
                  <div className="text-xs text-ink-2 mt-0.5">
                    {formatDate(v.created_at)}{v.created_by_name ? ` by ${v.created_by_name}` : ""} · {v.signed_count === 0 ? "no signatures yet" : `${v.signed_count} signed session${v.signed_count === 1 ? "" : "s"}`}
                  </div>
                </div>
                {!v.is_active ? (
                  <form action={activateAgreementVersionAction}>
                    <input type="hidden" name="version" value={v.version} />
                    <button className="btn-secondary btn-sm">Make active</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
