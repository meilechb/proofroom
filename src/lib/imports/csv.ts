/**
 * Minimal CSV client parsing for imports (plan 21.1, 21.2). Pure and client-safe
 * so the mapping preview and tests can use it without the database. Handles
 * quoted fields, commas and newlines inside quotes, and CRLF.
 */

export type CsvClient = { name: string; email: string; phone: string; company: string };
export type CsvParseResult = { clients: CsvClient[]; total: number; skipped: number; columns: string[] };

/** Splits CSV text into rows of fields, honouring quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

function pick(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h.trim().toLowerCase().replace(/\s+/g, " ")));
}

/** Auto-maps common contact columns (Name/Email/Phone/Business, or First+Last) to clients. */
export function parseClientsCsv(text: string): CsvParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { clients: [], total: 0, skipped: 0, columns: [] };
  const header = rows[0].map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());
  const iEmail = pick(lower, ["email", "email address", "e-mail"]);
  const iName = pick(lower, ["name", "full name", "client name", "contact name"]);
  const iFirst = pick(lower, ["first name", "first", "firstname"]);
  const iLast = pick(lower, ["last name", "last", "lastname"]);
  const iPhone = pick(lower, ["phone", "phone number", "mobile", "cell"]);
  const iCompany = pick(lower, ["company", "business", "business name", "organization", "organisation"]);
  const seen = new Set<string>();
  const clients: CsvClient[] = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const email = (iEmail >= 0 ? cells[iEmail] ?? "" : "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || seen.has(email)) { skipped++; continue; }
    seen.add(email);
    const named = iName >= 0 ? (cells[iName] ?? "").trim() : "";
    const composed = [iFirst >= 0 ? cells[iFirst] : "", iLast >= 0 ? cells[iLast] : ""].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
    const name = (named || composed || email.split("@")[0]).slice(0, 120);
    clients.push({ name, email, phone: (iPhone >= 0 ? cells[iPhone] ?? "" : "").trim().slice(0, 40), company: (iCompany >= 0 ? cells[iCompany] ?? "" : "").trim().slice(0, 120) });
  }
  return { clients, total: rows.length - 1, skipped, columns: header };
}
