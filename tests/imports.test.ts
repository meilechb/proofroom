import { describe, expect, it } from "vitest";
import { humanize, isImageEntry, proposeGalleries } from "@/lib/imports/sources";

describe("import scanning", () => {
  it("filters non-image and junk entries", () => {
    expect(isImageEntry("Smith Family/IMG_001.JPG")).toBe(true);
    expect(isImageEntry("__MACOSX/Smith/._IMG_001.jpg")).toBe(false);
    expect(isImageEntry("Smith/.DS_Store")).toBe(false);
    expect(isImageEntry("Smith/notes.txt")).toBe(false);
    expect(isImageEntry("Smith/Thumbs.db")).toBe(false);
  });
  it("groups by top-level folder and names root files after the zip", () => {
    const groups = proposeGalleries(
      [
        { name: "smith_family/IMG_1.jpg", size: 10 },
        { name: "smith_family/sub/IMG_2.jpg", size: 20 },
        { name: "IMG_3.jpg", size: 5 },
        { name: "readme.txt", size: 1 },
      ],
      "Jones Headshots 20260901.zip"
    );
    expect(groups.map((g) => g.title)).toEqual(["Jones Headshots 2026-09-01", "Smith family"]);
    expect(groups[1].files).toHaveLength(2);
    expect(groups[1].bytes).toBe(30);
    expect(groups[0].folder).toBe("");
  });
  it("humanizes folder names", () => {
    expect(humanize("acme_corp-team_day")).toBe("Acme corp team day");
    expect(humanize("")).toBe("Imported gallery");
  });
});
