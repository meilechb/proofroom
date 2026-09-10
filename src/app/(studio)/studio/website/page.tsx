import { requireStudioPage } from "@/lib/auth";
import { siteFromDraft } from "@/lib/site/render";
import { studioBaseUrl } from "@/lib/tenant";
import { WebsiteEditor } from "./website-editor";

export const metadata = { title: "Website" };

export default async function WebsitePage() {
  const ctx = await requireStudioPage("admin");
  const draft = siteFromDraft(ctx.studio);
  const hasDraft = Boolean(ctx.studio.site_draft);
  return <WebsiteEditor initialDraft={draft} hasDraft={hasDraft} liveUrl={studioBaseUrl(ctx.studio)} />;
}
