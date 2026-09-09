import { describe, expect, it } from "vitest";
import { csvRecords, guessClientMapping, mapClientRows, parseCsv, toCsv } from "@/lib/csv";
import { icalFeed } from "@/lib/ical";

describe("csv", () => {
  it("parses quotes, escaped quotes, CRLF and a BOM", () => {
    const rows = parseCsv('\uFEFFname,email\r\n"Cohen, Sarah",s@x.com\n"Say ""hi""",h@x.com\n');
    expect(rows).toEqual([["name", "email"], ["Cohen, Sarah", "s@x.com"], ['Say "hi"', "h@x.com"]]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["a,b", 'q"q', "line\nbreak", 3, null]];
    expect(parseCsv(toCsv(rows))).toEqual([["a,b", 'q"q', "line\nbreak", "3", ""]]);
  });
  it("guesses a mapping and validates rows", () => {
    const text = "First Name,Last Name,E-mail,Mobile,Tags\nSarah,Cohen,S@X.com,555,vip; actor\nBad,Row,,\n";
    const { headers, records } = csvRecords(text);
    const mapping = guessClientMapping(headers);
    expect(mapping.email).toBe("e-mail");
    expect(mapping.name).toBe("first name+last name");
    const { rows, issues } = mapClientRows(records, mapping);
    expect(rows).toEqual([{ name: "Sarah Cohen", email: "s@x.com", phone: "555", company: null, notes: null, tags: ["vip", "actor"], source: "import" }]);
    expect(issues).toEqual([{ row: 3, problem: "Missing email" }]);
  });
});

describe("ical", () => {
  it("emits a valid calendar with escaping and folding", () => {
    const feed = icalFeed("Acme Sessions", [
      { uid: "o1@acme", title: "Headshots; Sarah, Cohen", start: new Date("2026-10-01T14:00:00Z"), end: new Date("2026-10-01T15:00:00Z"), location: "Studio", description: "x".repeat(120) },
    ], new Date("2026-09-09T00:00:00Z"));
    expect(feed).toContain("BEGIN:VCALENDAR\r\n");
    expect(feed).toContain("DTSTART:20261001T140000Z");
    expect(feed).toContain("SUMMARY:Headshots\; Sarah\\, Cohen");
    expect(feed.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(feed).toContain("END:VCALENDAR");
  });
});
