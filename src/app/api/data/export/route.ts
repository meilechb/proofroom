import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth";
import { studioExportEntries } from "@/lib/data-export";
import { zipStream } from "@/lib/zip";

/** GET a zip of the studio's records (plan 17.7). Admins only. */
export async function GET() {
  let studioId: string;
  let slug: string;
  try {
    const ctx = await requireStudio("admin");
    studioId = ctx.studio.id;
    slug = ctx.studio.slug;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = await studioExportEntries(studioId);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(zipStream(entries) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
