import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { dedupeNames, zipStream } from "@/lib/zip";
import { watermarkSvg } from "@/lib/images";
import { safeFilename } from "@/lib/storage";

describe("dedupeNames", () => {
  it("numbers repeated names, case-insensitively, keeping the extension", () => {
    expect(dedupeNames(["a.jpg", "A.jpg", "a.jpg", "b", "b", ""])).toEqual(["a.jpg", "A (2).jpg", "a (3).jpg", "b", "b (2)", "photo.jpg"]);
  });
});

describe("zipStream", () => {
  it("produces a valid archive from buffers and streams", async () => {
    const text = (s: string) => new TextEncoder().encode(s);
    const stream = zipStream([
      { name: "one.txt", read: async () => text("hello") },
      { name: "one.txt", read: async () => new Response(text("world")).body! },
    ]);
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(["one (2).txt", "one.txt"]);
    expect(new TextDecoder().decode(files["one.txt"])).toBe("hello");
    expect(new TextDecoder().decode(files["one (2).txt"])).toBe("world");
  });
});

describe("watermarkSvg", () => {
  it("escapes the text and produces an svg", () => {
    const svg = watermarkSvg('Acme <Studio> & "Co"').toString();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Acme &lt;Studio&gt; &amp; &quot;Co&quot;");
    expect(svg).not.toContain("<Studio>");
  });
});

describe("safeFilename", () => {
  it("strips paths and odd characters", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("My Photo (1).JPG")).toBe("My Photo (1).JPG");
    expect(safeFilename("weird:name*?.jpg")).toBe("weird_name_.jpg");
    expect(safeFilename("")).toBe("file");
  });
});
