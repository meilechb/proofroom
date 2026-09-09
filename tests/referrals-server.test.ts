import { describe, expect, it } from "vitest";
import { fraudVerdict, REFERRAL_CAP_PER_YEAR } from "@/lib/referrals-server";

const base = { referrerEmail: "a@acmestudio.com", referredEmail: "b@otherstudio.com", referrerFingerprint: "fp1", referredFingerprint: "fp2", rewardsThisYear: 0 };

describe("fraudVerdict", () => {
  it("passes a normal referral", () => {
    expect(fraudVerdict(base)).toEqual({ ok: true });
  });
  it("rejects the same email, the same business domain, the same card, and the yearly cap", () => {
    expect(fraudVerdict({ ...base, referredEmail: "A@AcmeStudio.com" })).toEqual({ ok: false, reason: "same_email" });
    expect(fraudVerdict({ ...base, referredEmail: "c@acmestudio.com" })).toEqual({ ok: false, reason: "same_business_domain" });
    expect(fraudVerdict({ ...base, referredFingerprint: "fp1" })).toEqual({ ok: false, reason: "same_card" });
    expect(fraudVerdict({ ...base, rewardsThisYear: REFERRAL_CAP_PER_YEAR })).toEqual({ ok: false, reason: "yearly_cap" });
  });
  it("allows two different people on a public mail provider", () => {
    expect(fraudVerdict({ ...base, referrerEmail: "a@gmail.com", referredEmail: "b@gmail.com" })).toEqual({ ok: true });
  });
  it("does not treat missing fingerprints as a match", () => {
    expect(fraudVerdict({ ...base, referrerFingerprint: null, referredFingerprint: null })).toEqual({ ok: true });
  });
});
