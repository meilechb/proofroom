import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { APP_NAME } from "@/lib/env";
import { markdownToHtml } from "@/lib/markdown-lite";
import { Heading, Lead } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What changed in ${APP_NAME}, newest first.`,
  alternates: { canonical: "/changelog" },
};

/** Renders CHANGELOG.md from the repository at build time (plan 8.17). */
export default async function ChangelogPage() {
  const md = await readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
  // Drop the top-level title; the page supplies its own heading.
  const body = md.replace(/^# .*\n/, "");
  return (
    <div className="container-x py-14 sm:py-20">
      <div className="max-w-3xl">
        <p className="eyebrow">Changelog</p>
        <Heading level={1} className="mt-3 text-4xl sm:text-5xl">What changed</Heading>
        <Lead>Newest first. Every entry is a shipped change.</Lead>
        <div className="mt-10 changelog" dangerouslySetInnerHTML={{ __html: markdownToHtml(body) }} />
      </div>
    </div>
  );
}
