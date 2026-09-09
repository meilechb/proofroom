import { describe, expect, it } from "vitest";
import { generateReferralCode, isReferralCodeShape, normalizeReferralCode, REFERRAL_CODE_LENGTH, REFERRAL_REWARD_TEXT } from "@/lib/referrals";

describe("referral codes", () => {
  it("generates codes of the right length from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
    }
  });

  it("is unlikely to collide", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => generateReferralCode()));
    expect(seen.size).toBe(5000);
  });

  it("normalizes user input", () => {
    expect(normalizeReferralCode(" ab-cd ef23 ")).toBe("ABCDEF23");
    expect(isReferralCodeShape("abcdef23")).toBe(true);
    expect(isReferralCodeShape("abcdef2")).toBe(false);
    expect(isReferralCodeShape("ABCDEF10")).toBe(false); // 1 and 0 are not in the alphabet
  });

  it("states the reward", () => {
    expect(REFERRAL_REWARD_TEXT).toBe("10% off for 12 months");
  });
});
