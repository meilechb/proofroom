import { describe, expect, it } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { verifySvixSignature } from "@/lib/email-events";
import { automationSettings, automationsPaused, AUTOMATION_RULES } from "@/lib/automations-shared";
import { resolveTemplate, renderTemplate, templatesByKey } from "@/lib/email-templates";

function signSvix(secretB64: string, id: string, ts: string, body: string) {
  const key = Buffer.from(secretB64, "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

describe("Resend/Svix webhook signature (plan 16.5, 16.19)", () => {
  const secretB64 = randomBytes(24).toString("base64");
  const secret = `whsec_${secretB64}`;
  const id = "msg_2abc";
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "re_1" } });

  it("accepts a correctly signed request", () => {
    const signature = signSvix(secretB64, id, ts, body);
    expect(verifySvixSignature(secret, { id, timestamp: ts, signature }, body)).toBe(true);
  });
  it("rejects a tampered body", () => {
    const signature = signSvix(secretB64, id, ts, body);
    expect(verifySvixSignature(secret, { id, timestamp: ts, signature }, body + " ")).toBe(false);
  });
  it("rejects a stale timestamp", () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = signSvix(secretB64, id, old, body);
    expect(verifySvixSignature(secret, { id, timestamp: old, signature }, body)).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifySvixSignature(secret, { id: null, timestamp: ts, signature: "v1,x" }, body)).toBe(false);
  });
  it("accepts when one of several signatures matches", () => {
    const good = signSvix(secretB64, id, ts, body).split(",")[1];
    const header = `v1,AAAA v1,${good}`;
    expect(verifySvixSignature(secret, { id, timestamp: ts, signature: header }, body)).toBe(true);
  });
});

describe("automation settings (plan 16.7, 16.19)", () => {
  it("fills defaults and clamps the delay to 0..60 days", () => {
    const s = automationSettings(null);
    expect(s.balance_reminder.enabled).toBe(true);
    expect(s.thank_you.enabled).toBe(false);
    const clamped = automationSettings({ automations: { gallery_expiring: { days: 999 }, session_reminder: { days: -5 } } });
    expect(clamped.gallery_expiring.days).toBe(60);
    expect(clamped.session_reminder.days).toBe(0);
  });
  it("reads the pause switch", () => {
    expect(automationsPaused({ automations_paused: true })).toBe(true);
    expect(automationsPaused({})).toBe(false);
  });
  it("every rule points at a real template", () => {
    for (const def of AUTOMATION_RULES) expect(templatesByKey[def.template]).toBeTruthy();
  });
});

describe("template rendering (plan 16.2)", () => {
  it("uses the override when present and fills variables", () => {
    const values = resolveTemplate("gallery_expiring", { subject: "Closing soon: {{days_left}} days", body: "Hi {{client_name}}" });
    expect(values.subject).toBe("Closing soon: {{days_left}} days");
    expect(renderTemplate(values.subject, { days_left: "3" })).toBe("Closing soon: 3 days");
    expect(renderTemplate("{{unknown}}", {})).toBe("");
  });
  it("falls back to the default when the override is blank", () => {
    const values = resolveTemplate("thank_you", { subject: "  ", body: "" });
    expect(values.subject).toBe(templatesByKey.thank_you.defaults.subject);
  });
});
