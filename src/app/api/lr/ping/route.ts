import { withApi, LR_API_VERSION, LR_MIN_PLUGIN_VERSION } from "@/lib/lr-api";
import { getPlatformSettings } from "@/lib/admin";

/** GET /api/lr/ping — confirms the token and reports versions (plan 18.2, 19.9). */
export const GET = withApi(async ({ studio }) => {
  const min = await getPlatformSettings().then((s) => s.min_plugin_version).catch(() => LR_MIN_PLUGIN_VERSION);
  return {
    studio: { name: studio.name, slug: studio.slug },
    apiVersion: LR_API_VERSION,
    minPluginVersion: min || LR_MIN_PLUGIN_VERSION,
  };
});
