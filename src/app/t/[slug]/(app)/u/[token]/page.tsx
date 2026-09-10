import { notFound } from "next/navigation";
import { studioBySlug } from "@/lib/tenant-data";
import { verifyLink } from "@/lib/tenant-tokens";
import { db, one } from "@/lib/db";
import { setSubscriptionAction } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params }: PageProps<"/t/[slug]/u/[token]">) {
  const { slug, token } = await params;
  const studio = await studioBySlug(slug);
  if (!studio) notFound();
  const clientId = verifyLink("unsub", token);
  if (!clientId) return <Centered title="This link is no longer valid" body="Please contact the studio to change your email preferences." />;
  const client = one<{ email: string; unsubscribed_at: string | null }>(await db()`select email, unsubscribed_at from clients where id = ${clientId} and studio_id = ${studio.id}`);
  if (!client) notFound();
  const unsubscribed = Boolean(client.unsubscribed_at);

  return (
    <Centered title={unsubscribed ? "You're unsubscribed" : "Email preferences"} body={unsubscribed ? `${client.email} will no longer receive marketing emails from ${studio.name}. You will still get receipts and gallery links for your own sessions.` : `Manage marketing emails from ${studio.name} for ${client.email}.`}>
      <form action={setSubscriptionAction} className="mt-6">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="subscribe" value={unsubscribed ? "true" : "false"} />
        <button type="submit" className={unsubscribed ? "h-11 px-5 rounded-lg border border-[var(--site-line)] font-medium" : "h-11 px-5 rounded-lg bg-[var(--site-primary)] text-[var(--site-primary-ink)] font-medium"}>
          {unsubscribed ? "Resubscribe" : "Unsubscribe from marketing"}
        </button>
      </form>
    </Centered>
  );
}

function Centered({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--site-font-heading)" }}>{title}</h1>
      <p className="mt-3 text-[var(--site-ink-2)]">{body}</p>
      {children}
    </div>
  );
}
