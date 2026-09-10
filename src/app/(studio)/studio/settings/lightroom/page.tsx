import type { Metadata } from "next";
import { requireStudioPage } from "@/lib/auth";
import { listApiTokens } from "@/lib/api-tokens";
import { appUrl } from "@/lib/env";
import { Card } from "@/components/ui";
import { TokenManager } from "./token-manager";

export const metadata: Metadata = { title: "Lightroom" };

/** Lightroom plugin: connection tokens, plugin download and guide (plan 17.6). */
export default async function LightroomSettingsPage() {
  const ctx = await requireStudioPage("admin");
  const tokens = await listApiTokens(ctx.studio.id);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium mb-1">Lightroom plugin</h2>
        <p className="text-sm text-ink-2 mb-4">Publish galleries straight from Lightroom. Install the plugin, then paste a token below into its settings to connect it to your studio.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/plugin/download" className="btn-secondary btn-sm">Download plugin (.zip)</a>
          <a href={`${appUrl()}/lightroom`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Install guide</a>
        </div>
        <p className="mt-2 text-xs text-muted">Plugin version 1.0. The download is pre-configured with your site URL; paste a token below to connect it.</p>
      </Card>
      <Card>
        <h2 className="font-medium mb-1">Connection tokens</h2>
        <p className="text-sm text-ink-2 mb-4">Each device that runs the plugin uses its own token. Revoke a token to disconnect that device without affecting the others.</p>
        <TokenManager tokens={tokens} />
      </Card>
    </div>
  );
}
