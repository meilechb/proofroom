import { describe, expect, it } from "vitest";
import { proposeGalleries, remainingCount, isImageEntry } from "@/lib/imports/sources";
import { parseClientsCsv, parseCsv } from "@/lib/imports/csv";

describe("folder mapping", () => {
  it("groups top-level folders into galleries and names loose files after the zip", () => {
    const entries = [
      { name: "Smith Family/img1.jpg", size: 10 },
      { name: "Smith Family/img2.jpg", size: 10 },
      { name: "Jones_Headshots/a.jpg", size: 10 },
      { name: "loose.jpg", size: 10 },
      { name: "__MACOSX/._img1.jpg", size: 1 },
      { name: "notes.txt", size: 1 },
    ];
    const galleries = proposeGalleries(entries, "Export 2026.zip");
    expect(galleries.map((g) => g.title)).toEqual(["Export 2026", "Jones Headshots", "Smith Family"]);
    expect(galleries.find((g) => g.title === "Smith Family")?.files).toHaveLength(2);
    expect(galleries.find((g) => g.title === "Export 2026")?.files).toEqual(["loose.jpg"]); // junk and non-images dropped
  });
  it("ignores system and non-image entries", () => {
    expect(isImageEntry("photo.JPG")).toBe(true);
    expect(isImageEntry("__MACOSX/._photo.jpg")).toBe(false);
    expect(isImageEntry("folder/Thumbs.db")).toBe(false);
    expect(isImageEntry("readme.txt")).toBe(false);
  });
});

describe("resume after failure", () => {
  it("counts only photos not yet marked done", () => {
    const galleries = [
      { include: true, files: ["a.jpg", "b.jpg", "c.jpg"], done: ["a.jpg"] },
      { include: true, files: ["d.jpg"], done: ["d.jpg"] },
      { include: false, files: ["e.jpg"] },
    ];
    expect(remainingCount(galleries)).toBe(2); // b, c remain; d done; excluded gallery ignored
  });
});

describe("CSV client parsing", () => {
  it("parses quoted fields with commas and newlines", () => {
    const rows = parseCsv('name,note\r\n"Smith, Jr.","line one\nline two"\n');
    expect(rows).toEqual([["name", "note"], ["Smith, Jr.", "line one\nline two"]]);
  });
  it("maps common columns, composes names, dedupes and skips bad emails", () => {
    const csv = "First Name,Last Name,Email,Phone,Business\nSarah,Cohen,sarah@example.com,555-1000,Acme\n,,,,\nJon,Doe,not-an-email,,\nSarah,Cohen,SARAH@example.com,,\n";
    const res = parseClientsCsv(csv);
    expect(res.clients).toHaveLength(1);
    expect(res.clients[0]).toMatchObject({ name: "Sarah Cohen", email: "sarah@example.com", phone: "555-1000", company: "Acme" });
    expect(res.skipped).toBe(2); // bad email and duplicate email (the blank line is not a data row)
  });
  it("falls back to a single Name column, then the email local part", () => {
    const res = parseClientsCsv("Name,Email\nAcme Studio,hello@acme.com\n,solo@example.com\n");
    expect(res.clients.map((c) => c.name)).toEqual(["Acme Studio", "solo"]);
  });
});
