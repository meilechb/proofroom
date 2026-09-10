import { describe, expect, it } from "vitest";
import { ApiError, bodyString, bodyOptString, LR_API_VERSION, LR_MIN_PLUGIN_VERSION } from "@/lib/lr-api-shared";

describe("Lightroom API helpers (plan 18.1, 18.11)", () => {
  it("reads and caps a required string", () => {
    expect(bodyString({ name: "  Studio X  " }, "name")).toBe("Studio X");
    expect(bodyString({ name: "x".repeat(1000) }, "name", 10)).toHaveLength(10);
  });
  it("throws a 400 ApiError with a code when a required field is missing", () => {
    try {
      bodyString({}, "name");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
      expect((e as ApiError).code).toBe("invalid");
    }
  });
  it("returns null for an absent optional string", () => {
    expect(bodyOptString({}, "phone")).toBeNull();
    expect(bodyOptString({ phone: "  " }, "phone")).toBeNull();
    expect(bodyOptString({ phone: "555" }, "phone")).toBe("555");
  });
  it("exposes stable version constants", () => {
    expect(LR_API_VERSION).toBe("1");
    expect(LR_MIN_PLUGIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
