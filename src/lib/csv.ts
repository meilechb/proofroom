/** RFC 4180 CSV: parse and serialize. Pure module; used by imports and exports. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Header-based records: first row is the header, returns objects keyed by lower-cased header. */
export function csvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { headers: [], records: [] };
  const headers = head.map((h) => h.trim().toLowerCase());
  const records = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, records };
}

export const CLIENT_FIELDS = ["name", "email", "phone", "company", "notes", "tags", "stage", "source"] as const;
export type ClientField = (typeof CLIENT_FIELDS)[number];

/** Guesses which CSV header feeds which client field (plan 10.15.2). */
export function guessClientMapping(headers: string[]): Partial<Record<ClientField, string>> {
  const map: Partial<Record<ClientField, string>> = {};
  const find = (...needles: string[]) => headers.find((h) => needles.some((n) => h.includes(n)));
  const first = find("first");
  const last = find("last", "surname");
  const whole = headers.find((h) => h === "name" || h.includes("full name") || h.includes("client name"));
  map.name = whole ?? (first && last ? `${first}+${last}` : headers.find((h) => h.includes("name") && !h.includes("first") && !h.includes("last")) ?? first);
  map.email = find("email", "e-mail");
  map.phone = find("phone", "mobile", "cell", "tel");
  map.company = find("company", "organisation", "organization", "business");
  map.notes = find("note", "comment");
  map.tags = find("tag", "label");
  map.stage = find("stage", "status");
  map.source = find("source", "referr");
  for (const k of Object.keys(map) as ClientField[]) if (!map[k]) delete map[k];
  return map;
}

export type ClientRowIssue = { row: number; problem: string };

/** Applies a mapping to records and validates the result (plan 10.15.3). */
export function mapClientRows(records: Record<string, string>[], mapping: Partial<Record<ClientField, string>>) {
  const out: { name: string; email: string; phone: string | null; company: string | null; notes: string | null; tags: string[]; source: string | null }[] = [];
  const issues: ClientRowIssue[] = [];
  const read = (rec: Record<string, string>, key: string | undefined) =>
    key ? key.split("+").map((k) => rec[k] ?? "").join(" ").trim() : "";
  records.forEach((rec, i) => {
    const name = read(rec, mapping.name);
    const email = read(rec, mapping.email).toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      issues.push({ row: i + 2, problem: email ? `Invalid email "${email}"` : "Missing email" });
      return;
    }
    out.push({
      name: name || email.split("@")[0],
      email,
      phone: read(rec, mapping.phone) || null,
      company: read(rec, mapping.company) || null,
      notes: read(rec, mapping.notes) || null,
      tags: read(rec, mapping.tags).split(/[;,]/).map((t) => t.trim().toLowerCase()).filter(Boolean),
      source: read(rec, mapping.source) || "import",
    });
  });
  return { rows: out, issues };
}
