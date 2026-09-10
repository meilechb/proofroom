import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth";
import { searchClients } from "@/lib/clients";
import { toCsv } from "@/lib/csv";
import { clientStages, type ClientStage } from "@/lib/types";

/** CSV of the current client filter (plan 10.14). */
export async function GET(request: NextRequest) {
  let studioId: string;
  try {
    ({ studio: { id: studioId } } = await requireStudio());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = request.nextUrl.searchParams;
  const q = p.get("q") ?? undefined;
  const tag = p.get("tag") ?? undefined;
  const tab = p.get("tab") ?? "all";
  const stage = clientStages.includes(tab as ClientStage) ? (tab as ClientStage) : "all";
  const rows = await searchClients(studioId, { q, tag, stage, archived: tab === "archived" }, 5000);
  const header = ["Name", "Email", "Phone", "Company", "Stage", "Tags", "Source", "Balance due", "Created"];
  const body = rows.map((c) => [c.name, c.email, c.phone ?? "", c.company ?? "", c.stage, c.tags.join(" "), c.source ?? "", (c.balance_due_cents / 100).toFixed(2), c.created_at.slice(0, 10)]);
  const csv = toCsv([header, ...body]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
