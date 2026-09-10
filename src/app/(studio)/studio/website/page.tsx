import { requireStudioPage } from "@/lib/auth";
import { siteFromDraft } from "@/lib/site/render";
import { studioBaseUrl } from "@/lib/tenant";
import { listAssets, isReady } from "@/lib/assets";
import { WebsiteEditor } from "./website-editor";
import type { PickerAsset } from "./image-picker";

export const metadata = { title: "Website" };

export default async function WebsitePage() {
  const ctx = await requireStudioPage("admin");
  const draft = siteFromDraft(ctx.studio);
  const hasDraft = Boolean(ctx.studio.site_draft);
  const assets: PickerAsset[] = (await listAssets(ctx.studio.id))
    .filter(isReady)
    .map((a) => ({ id: a.id, thumb: a.thumb_url ?? a.web_url ?? a.url, filename: a.filename, alt: a.alt }));
  return <WebsiteEditor initialDraft={draft} hasDraft={hasDraft} liveUrl={studioBaseUrl(ctx.studio)} assets={assets} />;
}
