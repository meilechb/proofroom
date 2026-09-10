#!/usr/bin/env node
// Packages the Lightroom plugin into a zip, stamping the site URL into PRConfig
// (plan 18.12). The app also serves this on the fly at /api/plugin/download; this
// script is for building a standalone zip offline.
//
// Usage: node scripts/build-plugin.mjs [siteUrl] [outFile]
//   siteUrl  default: $NEXT_PUBLIC_APP_URL or https://proofroom.example
//   outFile  default: ./plugin-dist/proofroom-lightroom.zip

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";

const here = path.dirname(new URL(import.meta.url).pathname);
const pluginDir = path.join(here, "..", "lightroom", "proofroom.lrplugin");
const siteUrl = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "https://proofroom.example").replace(/\/+$/, "");
const outFile = process.argv[3] || path.join(here, "..", "plugin-dist", "proofroom-lightroom.zip");

const files = (await readdir(pluginDir)).filter((f) => f.endsWith(".lua"));
const entries = {};
for (const name of files) {
  let text = await readFile(path.join(pluginDir, name), "utf8");
  if (name === "PRConfig.lua") text = text.replace("__SITE_URL__", siteUrl);
  entries[`proofroom.lrplugin/${name}`] = strToU8(text);
}

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, zipSync(entries, { level: 6 }));
console.log(`Wrote ${outFile} (${files.length} files, site ${siteUrl}).`);
