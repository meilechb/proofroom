import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { requireStudio } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { zipStream, type ZipEntry } from "@/lib/zip";

const PLUGIN_DIR = "proofroom.lrplugin";

/**
 * GET /api/plugin/download — the Lightroom plugin, zipped on the fly with this
 * site's URL stamped into its config (plan 18.12, 18.22). Login required.
 */
export async function GET() {
  try {
    await requireStudio();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dir = path.join(process.cwd(), "lightroom", PLUGIN_DIR);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".lua"));
  } catch {
    return NextResponse.json({ error: "Plugin files are not available in this deployment." }, { status: 503 });
  }

  const site = appUrl();
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = await Promise.all(
    files.map(async (name): Promise<ZipEntry> => {
      let text = await readFile(path.join(dir, name), "utf8");
      if (name === "PRConfig.lua") text = text.replace("__SITE_URL__", site);
      return { name: `${PLUGIN_DIR}/${name}`, read: async () => encoder.encode(text) };
    })
  );

  return new NextResponse(zipStream(entries) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="proofroom-lightroom.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
