/** Standard result shape for server actions used with useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Field-level errors keyed by input name. */
  fields?: Record<string, string>;
  /** Echo of submitted values so forms can repopulate after an error. */
  values?: Record<string, string>;
  /** Set when the action was blocked because the feature needs Pro. */
  upgrade?: { feature: string };
};

export const initialActionState: ActionState = {};

export function formValues(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = formData.get(key);
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

export function str(formData: FormData, key: string, max = 2000) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function bool(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function int(formData: FormData, key: string, fallback = 0) {
  const n = Number.parseInt(str(formData, key, 20), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Dollars typed by a human ("250", "$1,200.50") to integer cents. */
export function cents(formData: FormData, key: string, fallback = 0) {
  const raw = str(formData, key, 20).replace(/[^0-9.]/g, "");
  if (!raw) return fallback;
  const n = Math.round(Number(raw) * 100);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
