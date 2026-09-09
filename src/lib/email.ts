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
  /** Verified studio sending address, e.g. hello@mail.studio.com. When set, the mail leaves from the studio's own domain. */
  fromAddress?: string | null;
  /** What this email is about, for the log and the client timeline. */
  related?: { type: string; id: string } | null;
  templateKey?: string | null;
  /** Adds List-Unsubscribe headers and a footer link (broadcasts only). */
  unsubscribeUrl?: string | null;
  /** Skip the suppression check (platform mail such as password resets). */
  ignoreSuppressions?: boolean;
};

export function emailConfigured() {
  return Boolean(env.resendApiKey());
}

export function platformFromAddress() {
  const configured = env.emailFrom();
  return configured?.match(/<([^>]+)>/)?.[1] ?? configured ?? `hello@${appDomain().split(":")[0]}`;
}

function cleanName(name: string | undefined) {
  return (name ?? APP_NAME).replace(/[<>"\r\n]/g, "").trim() || APP_NAME;
}

/**
 * From header (plan 3.74). With a verified studio domain: "Studio <hello@mail.studio.com>".
 * Otherwise: "Studio via App <hello@platform>", so recipients see who it is from
 * while the mail is authenticated by our domain.
 */
export function fromHeader(fromName?: string, studioAddress?: string | null) {
  const name = cleanName(fromName);
  if (studioAddress) return `${name} <${studioAddress}>`;
  return fromName ? `${name} via ${APP_NAME} <${platformFromAddress()}>` : `${APP_NAME} <${platformFromAddress()}>`;
}

export function domainOf(address: string) {
  return address.split("@")[1]?.toLowerCase() ?? "";
}

export async function sendEmail(input: EmailInput): Promise<SendResult> {
  if (!input.ignoreSuppressions && input.studioId) {
    const blocked = await suppressed(input.studioId, input.to);
    if (blocked.length > 0) {
      const result = { ok: false, skipped: true, error: `Suppressed: ${blocked.join(", ")}` };
      await logEmail(input, result);
      return result;
    }
  }
  const key = env.resendApiKey();
  const result = key ? await deliver(key, input) : { ok: false, skipped: true, error: "RESEND_API_KEY is not set" };
  await logEmail(input, result);
  return result;
}

/** Addresses on the studio's suppression list or unsubscribed clients (plan 3.76). */
async function suppressed(studioId: string, to: string | string[]) {
  if (!dbConfigured()) return [];
  const list = (Array.isArray(to) ? to : [to]).map((a) => a.trim().toLowerCase());
  try {
    const rows = (await db()`
      select email from suppressions where studio_id = ${studioId} and email = any(${list})
      union
      select lower(email) from clients where studio_id = ${studioId} and unsubscribed_at is not null and lower(email) = any(${list})`) as { email: string }[];
    return rows.map((r) => r.email);
  } catch {
    return [];
  }
}

/** Resolves the sender for a studio: its verified domain when present, else the platform domain (plan 3.74). */
export async function senderFor(studio: { id: string; name: string; email: string }) {
  if (!dbConfigured()) return { fromName: studio.name, fromAddress: null as string | null, replyTo: studio.email };
  const row = (await db()`select domain, from_local_part from sending_domains where studio_id = ${studio.id} and status = 'verified' limit 1`)[0] as { domain: string; from_local_part: string } | undefined;
  return { fromName: studio.name, fromAddress: row ? `${row.from_local_part}@${row.domain}` : null, replyTo: studio.email };
}

/** Studio-originated mail: correct sender, always a reply-to, logged with what it relates to (plan 3.75). */
export async function sendStudioEmail(studio: { id: string; name: string; email: string }, input: Omit<EmailInput, "fromName" | "fromAddress" | "studioId" | "replyTo"> & { replyTo?: string }) {
  const sender = await senderFor(studio);
  return sendEmail({ ...input, studioId: studio.id, fromName: sender.fromName, fromAddress: sender.fromAddress, replyTo: input.replyTo ?? sender.replyTo });
}

/** Platform mail (login, billing) never uses a studio domain and ignores studio suppressions. */
export function sendPlatformEmail(input: Omit<EmailInput, "fromName" | "fromAddress" | "studioId">) {
  return sendEmail({ ...input, ignoreSuppressions: true });
}

async function deliver(key: string, input: EmailInput): Promise<SendResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(input.fromName, input.fromAddress),
        to: input.to,
        subject: input.subject,
        text: input.unsubscribeUrl ? `${input.text}\n\nUnsubscribe: ${input.unsubscribeUrl}` : input.text,
        html: input.html ?? emailLayout(input.text, input.cta, input.fromName, input.unsubscribeUrl),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.unsubscribeUrl
          ? { headers: { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
          : {}),
        ...(input.templateKey ? { tags: [{ name: "template", value: input.templateKey.replace(/[^a-zA-Z0-9_-]/g, "_") }] } : {}),
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
      insert into email_log (studio_id, kind, to_address, subject, status, error, provider_id, template_key, from_domain, related_type, related_id)
      values (${input.studioId ?? null}, ${input.kind ?? null}, ${to}, ${input.subject},
              ${result.ok ? "sent" : result.skipped ? "skipped" : "failed"},
              ${result.ok ? null : (result.error ?? null)}, ${result.id ?? null},
              ${input.templateKey ?? input.kind ?? null}, ${domainOf(input.fromAddress ?? platformFromAddress())},
              ${input.related?.type ?? null}, ${input.related?.id ?? null})`;
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

export function emailLayout(text: string, cta?: { label: string; url: string }, brand = APP_NAME, unsubscribeUrl?: string | null) {
  const unsubscribe = unsubscribeUrl ? ` · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888">Unsubscribe</a>` : "";
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
    <p style="font-size:12px;color:#888;text-align:center;margin-top:16px">Sent with ${escapeHtml(APP_NAME)} · <a href="mailto:${escapeHtml(supportEmail())}" style="color:#888">${escapeHtml(supportEmail())}</a>${unsubscribe}</p>
  </div></body></html>`;
}
