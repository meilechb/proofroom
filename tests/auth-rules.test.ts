import { describe, expect, it } from "vitest";
import { passwordProblem, PASSWORD_MIN } from "@/lib/password";
import { normalizeSlug, RESERVED_SLUGS, studioSlugProblem } from "@/lib/slug";
import { validTimezone } from "@/lib/account";

describe("password rules", () => {
  it("rejects short, repetitive, common and email-containing passwords", () => {
    expect(passwordProblem("short")).toMatch(new RegExp(`${PASSWORD_MIN}`));
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repetitive/);
    expect(passwordProblem("mypassword123")).toMatch(/common/);
    expect(passwordProblem("sarah.cohen!2026", "sarah.cohen@example.com")).toMatch(/email/);
    expect(passwordProblem("Br1ght-Lens-Tuesday")).toBeNull();
  });
});

describe("studio slugs", () => {
  it("normalizes and rejects reserved or malformed slugs", () => {
    expect(normalizeSlug("  Acme Studio!! ")).toBe("acme-studio");
    for (const reserved of ["www", "admin", "api"]) {
      if (RESERVED_SLUGS.has(reserved)) expect(studioSlugProblem(reserved)).not.toBeNull();
    }
    expect(studioSlugProblem("ab")).not.toBeNull();
    expect(studioSlugProblem("acme-studio")).toBeNull();
  });
});

describe("timezones", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(validTimezone("America/New_York")).toBe("America/New_York");
    expect(validTimezone("Not/AZone")).toBeNull();
    expect(validTimezone("")).toBeNull();
  });
});
