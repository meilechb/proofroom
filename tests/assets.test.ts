import { describe, expect, it } from "vitest";
import { ASSET_FOLDERS, isAssetFolder, formatBytes, jsonReferencesAssetId, assetIsInUse, reprocessBytesDelta } from "@/lib/assets-shared";
import { dnsRecords } from "@/lib/domains";

describe("asset folders", () => {
  it("recognises the known folders and rejects others", () => {
    for (const f of ASSET_FOLDERS) expect(isAssetFolder(f)).toBe(true);
    expect(isAssetFolder("logo")).toBe(true);
    expect(isAssetFolder("nonsense")).toBe(false);
    expect(isAssetFolder("")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("scales the unit with the size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.00 GB");
  });
});

describe("delete blocked when in use (plan 15.2, 15.9)", () => {
  const assetId = "11111111-1111-1111-1111-111111111111";
  it("finds the id inside site JSON regardless of nesting", () => {
    const site = { settings: { logoAssetId: assetId }, home: { hero: { imageAssetId: null } } };
    expect(jsonReferencesAssetId(site, assetId)).toBe(true);
    const draft = { home: { hero: { imageAssetId: assetId } } };
    expect(jsonReferencesAssetId(draft, assetId)).toBe(true);
  });
  it("does not match when the id is absent, null, or empty", () => {
    expect(jsonReferencesAssetId({ settings: { logoAssetId: null } }, assetId)).toBe(false);
    expect(jsonReferencesAssetId(null, assetId)).toBe(false);
    expect(jsonReferencesAssetId({ a: assetId }, "")).toBe(false);
  });
  it("treats any recorded use as blocking", () => {
    expect(assetIsInUse([])).toBe(false);
    expect(assetIsInUse(["Website"])).toBe(true);
    expect(assetIsInUse(["Portfolio", "Website"])).toBe(true);
  });
});

describe("usage count maintenance (plan 15.7, 15.9)", () => {
  it("adds the variant bytes over the pending placeholder", () => {
    // A pending asset stored the raw upload size; after variants replace it, the delta is the difference.
    expect(reprocessBytesDelta(1000, 2500)).toBe(1500);
    expect(reprocessBytesDelta(3000, 2500)).toBe(-500);
    expect(reprocessBytesDelta(0, 4096)).toBe(4096);
  });
});

describe("custom-domain DNS records (plan 14.28)", () => {
  it("recommends an A record for an apex and a CNAME for a subdomain", () => {
    const apex = dnsRecords(
      { name: "studio.com", apexName: "studio.com", verified: true },
      { configuredBy: null, misconfigured: true, recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }], recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com" }] }
    );
    expect(apex[0]).toMatchObject({ type: "A", host: "@", value: "76.76.21.21" });

    const sub = dnsRecords(
      { name: "www.studio.com", apexName: "studio.com", verified: true },
      { configuredBy: null, misconfigured: true, recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com" }] }
    );
    expect(sub[0]).toMatchObject({ type: "CNAME", host: "www", value: "cname.vercel-dns.com" });
  });
  it("includes the ownership TXT challenge when present", () => {
    const records = dnsRecords(
      { name: "studio.com", apexName: "studio.com", verified: false, verification: [{ type: "TXT", domain: "_vercel.studio.com", value: "vc-domain-verify=abc", reason: "pending" }] },
      { configuredBy: null, misconfigured: true, recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }] }
    );
    expect(records.some((r) => r.type === "TXT" && r.host === "_vercel.studio.com")).toBe(true);
  });
});
