import { describe, expect, it } from "vitest";
import { redact } from "@/lib/logger";

describe("log redaction (plan 22.9)", () => {
  it("redacts secret-looking keys at any depth", () => {
    const out = redact({ studioId: "s1", password: "hunter2", nested: { apiKey: "abc", authorization: "Bearer x", ok: 1 } }) as Record<string, Record<string, unknown>>;
    expect(out.studioId).toBe("s1");
    expect(out.password).toBe("[redacted]");
    expect(out.nested.apiKey).toBe("[redacted]");
    expect(out.nested.authorization).toBe("[redacted]");
    expect(out.nested.ok).toBe(1);
  });
  it("redacts secret-shaped values even under a harmless key", () => {
    const out = redact({ note: "key is sk_live_ABCDEF123456", jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc" }) as Record<string, string>;
    expect(out.note).toContain("[redacted]");
    expect(out.note).not.toContain("sk_live_ABCDEF123456");
    expect(out.jwt).toBe("[redacted]");
  });
  it("leaves ordinary data untouched", () => {
    expect(redact({ count: 3, items: ["a", "b"], when: null })).toEqual({ count: 3, items: ["a", "b"], when: null });
  });
});
