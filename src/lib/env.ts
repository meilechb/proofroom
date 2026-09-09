/**
 * Typed access to environment variables. Every accessor tolerates a missing
 * value at build time so `next build` succeeds without secrets; callers that
 * truly need a value use the `require*` variants which throw a clear message.
 */

function read(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Proofroom";

/** Root domain without protocol, e.g. proofroom.com or localhost:3000. */
export function appDomain() {
  return process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() || "localhost:3000";
}

/** Full origin of the root site. */
export function appUrl() {
  const explicit = read("NEXT_PUBLIC_APP_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const domain = appDomain();
  const protocol = domain.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${domain}`;
}

export function supportEmail() {
  return read("NEXT_PUBLIC_SUPPORT_EMAIL") || `support@${appDomain().split(":")[0]}`;
}

export const env = {
  databaseUrl: () => read("DATABASE_URL"),
  appSecret: () => read("APP_SECRET"),
  blobToken: () => read("BLOB_READ_WRITE_TOKEN"),
  assetsBlobToken: () => read("ASSETS_READ_WRITE_TOKEN") || read("ASSETS_BLOB_READ_WRITE_TOKEN"),
  stripeSecretKey: () => read("STRIPE_SECRET_KEY"),
  stripePublishableKey: () => read("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  stripeWebhookSecret: () => read("STRIPE_WEBHOOK_SECRET"),
  stripeConnectWebhookSecret: () => read("STRIPE_CONNECT_WEBHOOK_SECRET"),
  platformFeeBps: () => Number(read("PLATFORM_FEE_BPS") ?? "0") || 0,
  resendApiKey: () => read("RESEND_API_KEY"),
  emailFrom: () => read("EMAIL_FROM"),
  vercelApiToken: () => read("VERCEL_API_TOKEN"),
  vercelProjectId: () => read("VERCEL_PROJECT_ID"),
  vercelTeamId: () => read("VERCEL_TEAM_ID"),
  cronSecret: () => read("CRON_SECRET"),
};

export function requireEnv(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`${name} is not set. See saas/.env.example.`);
  return v;
}

export const configured = {
  db: () => Boolean(env.databaseUrl()),
  secret: () => (env.appSecret()?.length ?? 0) >= 32,
  storage: () => Boolean(env.blobToken()),
  stripe: () => Boolean(env.stripeSecretKey() && env.stripePublishableKey()),
  email: () => Boolean(env.resendApiKey()),
};
