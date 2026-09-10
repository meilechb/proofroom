export const WIZARD_STEPS = 7;
export const STEP_LABELS = ["Brand", "Template", "Packages", "Payments", "Email", "Lightroom", "Done"];

export function clampStep(raw: unknown, fallback = 1) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  const v = Number.isFinite(n) ? n : fallback;
  return Math.min(WIZARD_STEPS, Math.max(1, v));
}
