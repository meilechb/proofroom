/**
 * Editable email templates per studio. Text uses {{placeholders}} filled at
 * send time. Defaults are the shipped wording; studios override subject, body
 * and button label (stored in email_templates). Pure module: the editor runs
 * the preview in the browser.
 */

export const templateKeys = [
  "inquiry_reply",
  "gallery_proofs",
  "gallery_final",
  "payment_link",
  "receipt",
  "agreement",
  "balance_reminder",
  "gallery_expiring",
  "thank_you",
  "review_request",
] as const;

export type TemplateKey = (typeof templateKeys)[number];
export type TemplateValues = { subject: string; body: string; cta_label?: string };
export type TemplateVariable = { name: string; description: string };

export type EmailTemplateDef = {
  key: TemplateKey;
  name: string;
  when: string;
  automation?: { label: string; defaultDays: number };
  hasCta: boolean;
  defaults: TemplateValues;
  variables: TemplateVariable[];
  sample: Record<string, string>;
};

export const globalVariables: TemplateVariable[] = [
  { name: "studio_name", description: "Your studio name" },
  { name: "studio_email", description: "Your reply-to email" },
  { name: "client_name", description: "The client's first name and last name" },
];

const sig = "{{studio_name}}\n{{studio_email}}";

export const emailTemplates: EmailTemplateDef[] = [
  {
    key: "inquiry_reply",
    name: "Inquiry reply",
    when: "When you reply to a new inquiry from the inbox.",
    hasCta: false,
    defaults: { subject: "Re: your headshot inquiry", body: `Hi {{client_name}},\n\nThanks for getting in touch. Here is how a session works and a few dates that are open:\n\n{{message}}\n\n${sig}` },
    variables: [{ name: "message", description: "Your reply text" }],
    sample: { client_name: "Sarah Cohen", message: "Tuesday 10am or Thursday 2pm both work. The session takes about 30 minutes." },
  },
  {
    key: "gallery_proofs",
    name: "Proofs are ready",
    when: "When you press Email on a proofs gallery.",
    hasCta: true,
    defaults: { subject: "Your proofs are ready", body: `Hi {{client_name}},\n\nYour proofs are ready. Open the gallery, mark the ones you like as favorites, and leave a note on any photo if you want something changed.\n\nAccess code: {{access_code}}\n\n${sig}`, cta_label: "Open gallery" },
    variables: [{ name: "gallery_url", description: "Link to the gallery" }, { name: "access_code", description: "The 6-character code" }],
    sample: { client_name: "Sarah Cohen", gallery_url: "https://studio.example.com/g/sarah-proofs-x7k2", access_code: "K7M2PQ" },
  },
  {
    key: "gallery_final",
    name: "Final photos are ready",
    when: "When you press Email on a final gallery.",
    hasCta: true,
    defaults: { subject: "Your photos are ready", body: `Hi {{client_name}},\n\nYour final photos are ready. You can download them one at a time or all at once. Files stay online for {{retention_days}} days, so please keep a copy.\n\nAccess code: {{access_code}}\n\n${sig}`, cta_label: "Open gallery" },
    variables: [{ name: "gallery_url", description: "Link to the gallery" }, { name: "access_code", description: "The 6-character code" }, { name: "retention_days", description: "Days the gallery stays online" }],
    sample: { client_name: "Sarah Cohen", gallery_url: "https://studio.example.com/g/sarah-final-a91z", access_code: "K7M2PQ", retention_days: "90" },
  },
  {
    key: "payment_link",
    name: "Payment link",
    when: "When you email a payment link for a session.",
    hasCta: true,
    defaults: { subject: "Payment for {{session_title}}", body: `Hi {{client_name}},\n\nHere is the secure link to review the agreement and pay {{amount}} for {{session_title}}.\n\n${sig}`, cta_label: "Review and pay" },
    variables: [{ name: "session_title", description: "Session name" }, { name: "amount", description: "Amount due now" }, { name: "pay_url", description: "The payment link" }],
    sample: { client_name: "Sarah Cohen", session_title: "Individual headshot", amount: "$100", pay_url: "https://studio.example.com/pay/abc" },
  },
  {
    key: "receipt",
    name: "Receipt",
    when: "Automatically after a client pays online.",
    hasCta: false,
    defaults: { subject: "Receipt: {{amount}} for {{session_title}}", body: `Hi {{client_name}},\n\nThank you. We received your payment of {{amount}} for {{session_title}} (order #{{order_number}}).\n\n${sig}` },
    variables: [{ name: "amount", description: "Amount paid" }, { name: "session_title", description: "Session name" }, { name: "order_number", description: "Order number" }],
    sample: { client_name: "Sarah Cohen", amount: "$100", session_title: "Individual headshot", order_number: "1001" },
  },
  {
    key: "agreement",
    name: "Agreement copy",
    when: "Automatically after a client signs the agreement.",
    hasCta: false,
    defaults: { subject: "Your signed agreement", body: `Hi {{client_name}},\n\nHere is a copy of the agreement you signed on {{signed_date}} for {{session_title}}.\n\n{{agreement_text}}\n\n${sig}` },
    variables: [{ name: "signed_date", description: "Date signed" }, { name: "session_title", description: "Session name" }, { name: "agreement_text", description: "Full agreement text" }],
    sample: { client_name: "Sarah Cohen", signed_date: "October 14, 2026", session_title: "Individual headshot", agreement_text: "PARTIES\nThis agreement is between…" },
  },
  {
    key: "balance_reminder",
    name: "Balance reminder",
    when: "Automation: a set number of days after finals are delivered and the balance is still unpaid.",
    automation: { label: "Remind about an unpaid balance", defaultDays: 3 },
    hasCta: true,
    defaults: { subject: "Your final photos are waiting", body: `Hi {{client_name}},\n\nYour final photos are ready to download as soon as the remaining balance of {{amount}} is paid.\n\n${sig}`, cta_label: "Pay the balance" },
    variables: [{ name: "amount", description: "Balance due" }, { name: "pay_url", description: "The payment link" }],
    sample: { client_name: "Sarah Cohen", amount: "$150", pay_url: "https://studio.example.com/pay/abc" },
  },
  {
    key: "gallery_expiring",
    name: "Gallery expiring soon",
    when: "Automation: a set number of days before a gallery closes.",
    automation: { label: "Warn before a gallery closes", defaultDays: 7 },
    hasCta: true,
    defaults: { subject: "Your gallery closes in {{days_left}} days", body: `Hi {{client_name}},\n\nA reminder that your gallery closes on {{expires_on}}. Download anything you want to keep before then.\n\n${sig}`, cta_label: "Open gallery" },
    variables: [{ name: "days_left", description: "Days until it closes" }, { name: "expires_on", description: "Closing date" }, { name: "gallery_url", description: "Link to the gallery" }],
    sample: { client_name: "Sarah Cohen", days_left: "7", expires_on: "December 1, 2026", gallery_url: "https://studio.example.com/g/sarah-final-a91z" },
  },
  {
    key: "thank_you",
    name: "Thank you",
    when: "Automation: a set number of days after the final gallery is delivered and paid.",
    automation: { label: "Send a thank-you note", defaultDays: 2 },
    hasCta: false,
    defaults: { subject: "Thank you", body: `Hi {{client_name}},\n\nThank you for choosing {{studio_name}}. It was a pleasure photographing you. If anyone you know needs a headshot, I'd be glad to help.\n\n${sig}` },
    variables: [],
    sample: { client_name: "Sarah Cohen" },
  },
  {
    key: "review_request",
    name: "Review request",
    when: "Automation: a set number of days after delivery, asking for a short review.",
    automation: { label: "Ask for a review", defaultDays: 7 },
    hasCta: true,
    defaults: { subject: "Would you leave a quick review?", body: `Hi {{client_name}},\n\nIf you were happy with your photos, a short review helps other people find {{studio_name}}. It takes a minute.\n\n${sig}`, cta_label: "Leave a review" },
    variables: [{ name: "review_url", description: "Where to leave the review" }],
    sample: { client_name: "Sarah Cohen", review_url: "https://g.page/r/example/review" },
  },
];

export const templatesByKey = Object.fromEntries(emailTemplates.map((t) => [t.key, t])) as Record<TemplateKey, EmailTemplateDef>;

export function renderTemplate(text: string, values: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => values[key] ?? "");
}

export function resolveTemplate(key: TemplateKey, override: Partial<TemplateValues> | null | undefined): TemplateValues {
  const def = templatesByKey[key];
  return {
    subject: override?.subject?.trim() || def.defaults.subject,
    body: override?.body?.trim() || def.defaults.body,
    cta_label: override?.cta_label?.trim() || def.defaults.cta_label,
  };
}
