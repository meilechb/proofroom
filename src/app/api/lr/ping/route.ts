import { withApi, LR_API_VERSION, LR_MIN_PLUGIN_VERSION } from "@/lib/lr-api";

/** GET /api/lr/ping — confirms the token and reports versions (plan 18.2). */
export const GET = withApi(({ studio }) => ({
  studio: { name: studio.name, slug: studio.slug },
  apiVersion: LR_API_VERSION,
  minPluginVersion: LR_MIN_PLUGIN_VERSION,
}));
