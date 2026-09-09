/**
 * Referral program helpers that do not need the database. The reward flow
 * (apply coupons on first paid invoice, queue, void) lives in referrals-server.ts
 * (plan 3.84 onward) so this file can be imported by client components.
 */

import { randomBytes } from "node:crypto";

/** No 0/O/1/I so codes survive being read aloud or typed from a photo. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const REFERRAL_CODE_LENGTH = 8;

export function generateReferralCode(length = REFERRAL_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Uppercases and strips separators so "ab-cd ef" matches "ABCDEF". */
export function normalizeReferralCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isReferralCodeShape(input: string) {
  const code = normalizeReferralCode(input);
  return code.length === REFERRAL_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

/** Reward terms, kept in one place for copy and for the Stripe coupon. */
export const REFERRAL_REWARD = { percentOff: 10, months: 12 } as const;
/** Rewarded referrals per studio per calendar year (plan 3.85). */
export const REFERRAL_CAP_PER_YEAR = 12;
export const REFERRAL_REWARD_TEXT = `${REFERRAL_REWARD.percentOff}% off for ${REFERRAL_REWARD.months} months`;
