#!/usr/bin/env node
// Packages lightroom/proofroom.lrplugin into public/downloads/proofroom-lightroom.zip,
// stamping the default site URL from NEXT_PUBLIC_APP_URL into Info.lua's defaults.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const root = new URL("../", import.meta.url).pathname;
const src = join(root, "lightroom", "proofroom.lrplugin");
const outDir = join(root, "public", "downloads");
const out = join(outDir, "proofroom-lightroom.zip");
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://proofroom.com";

const files = {};
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else {
      let data = readFileSync(full);
      if (entry === "PRConfig.lua") data = Buffer.from(data.toString("utf8").replace("__SITE_URL__", siteUrl));
      files[`proofroom.lrplugin/${relative(src, full)}`] = data;
    }
  }
}
walk(src);
mkdirSync(outDir, { recursive: true });
writeFileSync(out, zipSync(files, { level: 6 }));
console.log(`${relative(root, out)}: ${Object.keys(files).length} files, ${statSync(out).size} bytes (site ${siteUrl})`);
