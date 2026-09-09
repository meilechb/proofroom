/**
 * What we know about each source's export (plan 3.88). Checked September 9,
 * 2026 against the vendors' public help centres via search; none documents a
 * folder specification, so every source is handled as a plain zip: top-level
 * folders become galleries, loose files at the root become one gallery named
 * after the zip. Marked "unverified" where the help centre could not be read.
 *
 * Pixieset: whole-collection downloads arrive as .ZIP, split into several zips
 *   for large collections; filenames are preserved; sets may be folders. Source:
 *   help.pixieset.com "Your client's download experience". (folder layout unverified)
 * Pic-Time: downloads are grouped into photos.zip files; galleries can be
 *   downloaded "by scene". Source: help.pic-time.com "What are the Steps to
 *   Downloading Photos? (Desktop)". (folder layout unverified)
 * ShootProof: "Download All" delivers zip files; contacts export via the Studio
 *   API includes Contact ID, Brand, First Name, Last Name, Name, Email, Phone,
 *   Business. Source: developer.shootproof.com/reference/studio/contacts. (zip layout unverified)
 */

export type ImportSource = "pixieset" | "pictime" | "shootproof" | "zip" | "csv";

export const IMPORT_SOURCES: Record<ImportSource, { name: string; instructions: string[]; verified: boolean }> = {
  pixieset: {
    name: "Pixieset",
    verified: false,
    instructions: [
      "Open the collection in Pixieset and use the full collection download (Download icon, top right). Large collections arrive as several zip files; upload all of them.",
      "Check the collection's download settings first so files come at original resolution.",
      "Repeat for each collection, or upload zips from several collections at once: each zip becomes its own gallery.",
    ],
  },
  pictime: {
    name: "Pic-Time",
    verified: false,
    instructions: [
      "Open the project, select all photos and choose Download to Computer at the high-resolution size. Pic-Time groups the files into photos.zip files; upload all of them.",
      "If you download by scene, each scene's zip becomes a gallery.",
    ],
  },
  shootproof: {
    name: "ShootProof",
    verified: false,
    instructions: [
      "Open the gallery and use Download All; the zip files are emailed or saved to your device. Upload all of them.",
      "Contacts: export your contacts to CSV and upload it in the client import step. Columns such as Name, Email, Phone and Business map automatically.",
    ],
  },
  zip: { name: "Zip files", verified: true, instructions: ["Upload one or more zip files. Each top-level folder becomes a gallery; files at the top level become a gallery named after the zip."] },
  csv: { name: "Client list (CSV)", verified: true, instructions: ["Upload a CSV with at least a name and email column. You map the columns on the next step."] },
};

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic"]);

export function isImageEntry(name: string) {
  const lower = name.toLowerCase();
  const base = lower.split("/").pop() ?? "";
  if (!base || base.startsWith(".") || lower.includes("__macosx/") || base === "thumbs.db") return false;
  const dot = base.lastIndexOf(".");
  return dot > 0 && IMAGE_EXTENSIONS.has(base.slice(dot));
}

export type ZipEntryInfo = { name: string; size: number };

export type ProposedGallery = { folder: string; title: string; files: string[]; bytes: number };

/** Groups zip entries into galleries by top-level folder (plan 3.87.4). */
export function proposeGalleries(entries: ZipEntryInfo[], zipName: string): ProposedGallery[] {
  const groups = new Map<string, ProposedGallery>();
  for (const e of entries) {
    if (!isImageEntry(e.name)) continue;
    const parts = e.name.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : "";
    const key = folder || `__root__:${zipName}`;
    const title = folder ? humanize(folder) : humanize(zipName.replace(/\.zip$/i, ""));
    const g = groups.get(key) ?? { folder, title, files: [], bytes: 0 };
    g.files.push(e.name);
    g.bytes += e.size;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function humanize(name: string) {
  return name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").replace(/\b(\d{4})(\d{2})(\d{2})\b/, "$1-$2-$3").trim().replace(/^\w/, (c) => c.toUpperCase()).slice(0, 120) || "Imported gallery";
}
