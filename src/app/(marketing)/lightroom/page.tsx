import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { TRIAL_DAYS } from "@/lib/plans";
import { StartFreeLink } from "@/components/marketing/header";
import { Check, Faq, FinalCta, Heading, Lead, Screenshot, Section, SectionHeader } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Lightroom Classic plugin: install guide",
  description: `Install the ${APP_NAME} Publish Service for Lightroom Classic, connect it with a token, publish a gallery and sync client favorites back.`,
  alternates: { canonical: "/lightroom" },
};

const steps: Array<{ title: string; body: string; shot: string }> = [
  { title: "Download the plugin", body: "Sign in and download the plugin zip from Settings, Lightroom. Unzip it somewhere permanent, such as Documents/Lightroom Plugins. Lightroom loads the plugin from that folder every time, so do not leave it in Downloads.", shot: "Settings: Lightroom tab with the download button and token list" },
  { title: "Add it in Plug-in Manager", body: "In Lightroom Classic open File, Plug-in Manager, click Add, and choose the unzipped .lrplugin folder. The plugin appears in the list with a green light.", shot: "Lightroom Plug-in Manager with the plugin enabled" },
  { title: "Paste your token", body: "Create a token in Settings, Lightroom. Tokens start with pr_live_ and are shown once. Paste it into the plugin's settings panel in Plug-in Manager and click Verify. The studio name appears when the token is accepted.", shot: "Plugin settings panel with a verified token" },
  { title: "Create the Publish Service", body: "In the Library module's Publish Services panel, click Set Up next to the plugin. Name the service after your studio. Choose whether to upload full resolution or web size by default.", shot: "Publish Services panel with the new service" },
  { title: "Publish a gallery", body: "Right-click the service, Create Published Collection, name it after the client. Drag photos in and click Publish. The gallery is created, the photos upload in the background, and a link is ready in the web app.", shot: "Published collection uploading" },
  { title: "Sync favorites and notes", body: "After the client picks, right-click the collection and choose Sync Favorites. Favorites get a flag and the keyword Client Favorite. Notes arrive as keywords under Client Notes. A Smart Collection on that keyword shows every pick.", shot: "Library grid with flagged favorites and client note keywords" },
];

const faq = [
  { q: "Which versions are supported?", a: "Lightroom Classic 12 and later on macOS and Windows. Adobe's plugin SDK does not exist for Lightroom (cloud), Lightroom mobile or Capture One." },
  { q: "The plugin shows a red light or 'failed to load'.", a: "Make sure the .lrplugin folder was fully unzipped and not moved after adding it. Remove and re-add it in Plug-in Manager. If it still fails, note the Lightroom version and email support." },
  { q: "Publish says the token is invalid.", a: "Tokens are shown once and can be revoked. Create a new token in Settings, Lightroom and paste it again. Check that the token belongs to the studio you expect if you have more than one." },
  { q: "Can two people publish to the same studio?", a: "Yes. Each person creates their own token. Galleries show who published them." },
  { q: "Does republishing change the client's link?", a: "No. Edited photos replace the old versions at the same link, and the client's favorites and notes are kept." },
  { q: "Is the plugin included in the plan?", a: "Yes. There is no separate charge." },
];

export default function LightroomPage() {
  return (
    <>
      <Section className="pb-10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Lightroom Classic plugin</p>
            <Heading level={1} className="mt-3 text-4xl sm:text-5xl">Install the plugin</Heading>
            <Lead>Ten minutes from download to your first published gallery. The plugin is a standard Lightroom Classic Publish Service, so it behaves like the ones you already know.</Lead>
            <ul className="mt-6 space-y-2">
              <Check>Lightroom Classic 12 or later, macOS or Windows</Check>
              <Check>A {APP_NAME} studio (the {TRIAL_DAYS}-day trial is enough)</Check>
              <Check>A token from Settings, Lightroom</Check>
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/studio/settings/lightroom" className="btn-primary btn-lg">Download the plugin</Link>
              <StartFreeLink className="btn-secondary btn-lg">Create a studio first</StartFreeLink>
            </div>
            <p className="mt-3 text-xs text-muted">The download needs a login so the zip can be stamped with your studio address.</p>
          </div>
          <Screenshot label="Lightroom Classic Publish Services panel" ratio="4/3" />
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeader eyebrow="Step by step" title="Six steps" />
        <ol className="mt-10 space-y-10">
          {steps.map((s, i) => (
            <li key={s.title} className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper text-sm font-semibold" aria-hidden>{i + 1}</span>
                <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-ink-2 leading-relaxed">{s.body}</p>
              </div>
              <Screenshot label={s.shot} />
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <Faq items={faq} title="Plugin questions" />
      </Section>
      <FinalCta title="Publish your first gallery from Lightroom" />
    </>
  );
}
