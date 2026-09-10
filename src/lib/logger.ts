/** Structured JSON logging for Vercel's log drain. Keep messages short and searchable. */
type Level = "info" | "warn" | "error";

/**
 * Keys whose values are secrets and must never reach the log drain (plan 22.9).
 * Matched case-insensitively as a substring, so `apiKey`, `stripe_secret` and
 * `authorization` are all caught.
 */
const SECRET_KEY = /(pass|secret|token|api[_-]?key|authorization|cookie|signature|client_secret|credential|private[_-]?key)/i;
/** Value shapes that are secrets regardless of their key (Stripe/Resend keys, bearer tokens, JWTs). */
const SECRET_VALUE = /\b(sk_(live|test)_[A-Za-z0-9]+|rk_(live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|re_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9._-]{20,})/;
const REDACTED = "[redacted]";

/** Recursively replaces secret-looking keys and values with a marker. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === "string") return SECRET_VALUE.test(value) ? value.replace(SECRET_VALUE, REDACTED) : value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SECRET_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    return out;
  }
  return value;
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const safe = data ? (redact(data) as Record<string, unknown>) : undefined;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error && error.message ? error.message : fallback;
}
