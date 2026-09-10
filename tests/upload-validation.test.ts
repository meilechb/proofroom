import { describe, expect, it } from "vitest";
import { safeFilename } from "@/lib/storage";
import { isImageEntry, IMAGE_EXTENSIONS } from "@/lib/imports/sources";

describe("filename sanitization (plan 22.10)", () => {
  it("strips paths, control and unusual characters, and caps length", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("a\\b\\c.jpg")).toBe("c.jpg");
    expect(safeFilename("we¡rd/na<>me?.png")).toBe("na_me_.png"); // runs of disallowed chars collapse to one _
    expect(safeFilename("", "photo.jpg")).toBe("photo.jpg");
    expect(safeFilename("..")).toBe("file");
    expect(safeFilename(`${"x".repeat(400)}.jpg`).length).toBeLessThanOrEqual(120);
  });
});

describe("no SVG or non-images in galleries (plan 22.10)", () => {
  it("accepts raster image extensions only", () => {
    expect(isImageEntry("shoot/frame.jpg")).toBe(true);
    expect(isImageEntry("frame.HEIC")).toBe(true);
    expect(isImageEntry("evil.svg")).toBe(false);
    expect(isImageEntry("script.js")).toBe(false);
    expect(isImageEntry("payload.svg.jpg")).toBe(true); // final extension wins
    expect(IMAGE_EXTENSIONS.has(".svg")).toBe(false);
  });
});
