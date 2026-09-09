import "server-only";

import { db, dbConfigured } from "@/lib/db";
import { APP_NAME, appDomain, env, supportEmail } from "@/lib/env";

/**
 * Transactional email through Resend's HTTP API. Optional: without
 * RESEND_API_KEY every send returns { ok: false, skipped: true } and the UI
 * falls back to copyable links. Every attempt is written to email_log.
 *
 * Studio mail is sent from the platform domain with the studio's name as the
 * display name and the studio's own address as reply-to.
 */

export type SendResult = { ok: boolean; skipped?: boolean; error?: string; id?: string };

export type EmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  cta?: { label: string; url: string };
  kind?: string;
  studioId?: string | null;
  /** Display name for the From header (studio name). Defaults to the app name. */
  fromName?: string;
};

export function emailConfigured() {
  return Boolean(env.resendApiKey());
}

function fromAddress(fromName?: string) {
  const configured = env.emailFrom();
  const address = configured?.match(/<([^>]+)>/)?.[1] ?? configured ?? `hello@${appDomain().split(":")[0]}`;
  const name = (fromName ?? APP_NAME).replace(/[<>"\r\n]/g, "").trim() || APP_NAME;
  return `${name} via ${APP_NAME} <${address}>`;
}

export async function sendEmail(input: EmailInput): Promise<SendResult> {
  const key = env.resendApiKey();
  const result = key ? await deliver(key, input) : { ok: false, skipped: true, error: "RESEND_API_KEY is not set" };
  await logEmail(input, result);
  return result;
}

async function deliver(key: string, input: EmailInput): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(input.fromName),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? emailLayout(input.text, input.cta, input.fromName),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let message = `Email service returned ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        // keep status message
      }
      return { ok: false, error: message };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Email request failed" };
  }
}

async function logEmail(input: EmailInput, result: SendResult) {
  if (!dbConfigured()) return;
  try {
    const to = Array.isArray(input.to) ? input.to.join(", ") : input.to;
    await db()`
      insert into email_log (studio_id, kind, to_address, subject, status, error, provider_id)
      values (${input.studioId ?? null}, ${input.kind ?? null}, ${to}, ${input.subject},
              ${result.ok ? "sent" : result.skipped ? "skipped" : "failed"},
              ${result.ok ? null : (result.error ?? null)}, ${result.id ?? null})`;
  } catch (error) {
    console.error("email_log insert failed", error);
  }
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function textToHtml(text: string) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.55">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function emailLayout(text: string, cta?: { label: string; url: string }, brand = APP_NAME) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(cta.label)}</a></p><p style="font-size:12px;color:#666;word-break:break-all">${escapeHtml(cta.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e7e5e4">
      <div style="font-weight:700;font-size:16px;margin-bottom:20px">${escapeHtml(brand)}</div>
      ${textToHtml(text)}
      ${button}
    </div>
    <p style="font-size:12px;color:#888;text-align:center;margin-top:16px">Sent with ${escapeHtml(APP_NAME)} · <a href="mailto:${escapeHtml(supportEmail())}" style="color:#888">${escapeHtml(supportEmail())}</a></p>
  </div></body></html>`;
}
