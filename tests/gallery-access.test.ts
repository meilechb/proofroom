import { describe, expect, it } from "vitest";
import { downloadGate, generateAccessCode, normalizeCode, sharingAllowed, unlockMethod, verifyAccessCode } from "@/lib/gallery-access";

const order = { amount_cents: 40000, deposit_cents: 15000, included_finals: 5, extra_final_cents: 0, discount_cents: 0 };
const paidInFull = [{ amount_cents: 40000, status: "paid" as const, refunded_cents: 0 }];
const depositOnly = [{ amount_cents: 15000, status: "paid" as const, refunded_cents: 0 }];
const published = { status: "published" as const, expires_at: null, allow_downloads: true, pay_gated: true };

describe("access codes", () => {
  it("generates readable codes and compares them loosely", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(verifyAccessCode(`${code.slice(0, 3)}-${code.slice(3).toLowerCase()}`, code)).toBe(true);
    expect(verifyAccessCode("ZZZZZZ", code)).toBe(code === "ZZZZZZ");
    expect(normalizeCode(" ab-cd ")).toBe("ABCD");
  });
  it("picks the unlock method", () => {
    expect(unlockMethod({ access_code: "ABC123", password_hash: null })).toBe("code");
    expect(unlockMethod({ access_code: "ABC123", password_hash: "x" })).toBe("password");
    expect(unlockMethod({ access_code: null, password_hash: null })).toBe("open");
  });
});

describe("downloadGate", () => {
  it("locks pay-gated finals until the balance is paid", () => {
    expect(downloadGate(published, order, depositOnly, 0)).toBe("locked_unpaid");
    expect(downloadGate(published, order, paidInFull, 0)).toBe("open");
    expect(downloadGate(published, null, [], 0)).toBe("locked_unpaid");
  });
  it("is open when not gated, closed when downloads are off or the gallery is not live", () => {
    expect(downloadGate({ ...published, pay_gated: false }, order, [], 0)).toBe("open");
    expect(downloadGate({ ...published, allow_downloads: false }, order, paidInFull, 0)).toBe("closed");
    expect(downloadGate({ ...published, status: "draft" }, order, paidInFull, 0)).toBe("closed");
  });
  it("expires", () => {
    expect(downloadGate({ ...published, expires_at: "2020-01-01T00:00:00Z" }, order, paidInFull, 0)).toBe("expired");
  });
  it("sharing needs a live gallery and the flag", () => {
    expect(sharingAllowed({ status: "published", allow_sharing: true })).toBe(true);
    expect(sharingAllowed({ status: "draft", allow_sharing: true })).toBe(false);
  });
});

describe("download PIN and secrets", () => {
  it("has no PIN gate when none is set, and enforces one when set", async () => {
    const { hashGallerySecret, verifyDownloadPin } = await import("@/lib/gallery-access");
    expect(verifyDownloadPin("", { download_pin_hash: null })).toBe(true);
    const hash = hashGallerySecret("2468");
    expect(verifyDownloadPin("2468", { download_pin_hash: hash })).toBe(true);
    expect(verifyDownloadPin("0000", { download_pin_hash: hash })).toBe(false);
    expect(verifyDownloadPin("", { download_pin_hash: hash })).toBe(false);
  });

  it("verifyUnlock accepts the code or password and rejects the wrong one", async () => {
    const { hashGallerySecret, verifyUnlock } = await import("@/lib/gallery-access");
    expect(verifyUnlock({ access_code: "ABC234", password_hash: null }, "abc-234")).toBe(true);
    expect(verifyUnlock({ access_code: "ABC234", password_hash: null }, "WRONG1")).toBe(false);
    const pw = hashGallerySecret("hunter2");
    expect(verifyUnlock({ access_code: null, password_hash: pw }, "hunter2")).toBe(true);
    expect(verifyUnlock({ access_code: null, password_hash: pw }, "nope")).toBe(false);
    expect(verifyUnlock({ access_code: null, password_hash: null }, "")).toBe(true); // open gallery
  });
});
