import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt (no native dependency).
 * Stored format: scrypt:N:r:p:salt:hash (base64url). Parameters follow the
 * OWASP recommendation for scrypt (N=2^17, r=8, p=1) at 32-byte output.
 */
const N = 2 ** 15; // 32768: balances Vercel function CPU budget and OWASP guidance
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 }).toString("base64url");
  return `scrypt:${N}:${R}:${P}:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64url");
  try {
    const n = Number(nStr);
    const r = Number(rStr);
    const candidate = scryptSync(password, salt, expected.length, {
      N: n,
      r,
      p: Number(pStr),
      maxmem: 128 * n * r * 2,
    });
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Returns a human message when the password is unacceptable, else null. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (/^(.)\1+$/.test(password)) return "Choose a less repetitive password.";
  const lowered = password.toLowerCase();
  if (email && lowered.includes(email.split("@")[0].toLowerCase()) && email.length > 3) {
    return "The password should not contain your email address.";
  }
  if (["password", "qwerty", "12345678", "letmein", "photograph"].some((w) => lowered.includes(w))) {
    return "That password is too common.";
  }
  return null;
}
