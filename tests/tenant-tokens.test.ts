import { beforeAll, describe, expect, it } from "vitest";

// tenant-tokens signs with APP_SECRET; set one before importing.
beforeAll(() => {
  process.env.APP_SECRET = "test-secret-at-least-32-chars-long-xxxx";
});

describe("signed tenant links", () => {
  it("round-trips each kind and returns the id", async () => {
    const { signLink, verifyLink } = await import("@/lib/tenant-tokens");
    for (const kind of ["hub", "unsub", "invoice", "receipt", "preview"] as const) {
      const token = signLink(kind, "abc-123");
      expect(verifyLink(kind, token)).toBe("abc-123");
    }
  });

  it("rejects a token used for the wrong kind (scope is enforced)", async () => {
    const { signLink, verifyLink } = await import("@/lib/tenant-tokens");
    const hub = signLink("hub", "client-1");
    expect(verifyLink("invoice", hub)).toBeNull();
    expect(verifyLink("hub", hub)).toBe("client-1");
  });

  it("rejects an expired token", async () => {
    const { signLink, verifyLink } = await import("@/lib/tenant-tokens");
    const past = Date.now() - 40 * 86400 * 1000; // 40 days ago
    const token = signLink("hub", "client-1", 7, past); // 7-day ttl, issued 40 days ago
    expect(verifyLink("hub", token)).toBeNull();
  });

  it("rejects a tampered payload or signature", async () => {
    const { signLink, verifyLink } = await import("@/lib/tenant-tokens");
    const token = signLink("hub", "client-1");
    const [payload, sig] = token.split(".");
    expect(verifyLink("hub", `${payload}.deadbeef`)).toBeNull();
    expect(verifyLink("hub", `${Buffer.from("hub.client-2.9999999999").toString("base64url")}.${sig}`)).toBeNull();
    expect(verifyLink("hub", "not-a-token")).toBeNull();
    expect(verifyLink("hub", null)).toBeNull();
  });

  it("a different secret cannot verify", async () => {
    const { signLink } = await import("@/lib/tenant-tokens");
    const token = signLink("hub", "client-1");
    process.env.APP_SECRET = "another-secret-at-least-32-chars-yyyy";
    // re-import to pick up the new secret via requireEnv at call time
    const mod = await import("@/lib/tenant-tokens");
    expect(mod.verifyLink("hub", token)).toBeNull();
    process.env.APP_SECRET = "test-secret-at-least-32-chars-long-xxxx";
  });
});
