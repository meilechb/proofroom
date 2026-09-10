/**
 * Client-safe asset types and constants (plan 15). Kept out of assets.ts so
 * client components can import them without pulling in the server-only module.
 */

export type AssetKind = "image" | "logo" | "document";
export const ASSET_FOLDERS = ["site", "portfolio", "logo", "reference"] as const;
export type AssetFolder = (typeof ASSET_FOLDERS)[number];
export type AssetSort = "recent" | "name" | "largest";

export type Asset = {
  id: string;
  studio_id: string;
  kind: AssetKind;
  url: string;
  thumb_url: string | null;
  web_url: string | null;
  filename: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number;
  alt: string;
  tags: string[];
  folder: string | null;
  created_by: string | null;
  created_at: string;
};

export function isAssetFolder(v: string): v is AssetFolder {
  return (ASSET_FOLDERS as readonly string[]).includes(v);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** True when the site JSON (published or draft) mentions the asset id anywhere (plan 15.2). */
export function jsonReferencesAssetId(value: unknown, assetId: string) {
  if (!assetId) return false;
  return JSON.stringify(value ?? "").includes(assetId);
}

/** An asset with any recorded use is blocked from deletion (plan 15.2, 15.9). */
export function assetIsInUse(uses: string[]) {
  return uses.length > 0;
}

/** Storage delta to apply when a pending asset's bytes are replaced by its variants (plan 15.7, 15.9). */
export function reprocessBytesDelta(previousBytes: number, newTotalBytes: number) {
  return newTotalBytes - previousBytes;
}
