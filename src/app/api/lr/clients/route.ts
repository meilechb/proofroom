import { withApi, bodyString, bodyOptString } from "@/lib/lr-api";
import { searchClients, createClient } from "@/lib/clients";

/** GET /api/lr/clients?q= (plan 18.3). */
export const GET = withApi(async ({ studio, request }) => {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const list = await searchClients(studio.id, { q, stage: "all", archived: false }, 50);
  return { clients: list.map((c) => ({ id: c.id, name: c.name, email: c.email })) };
});

/** POST /api/lr/clients { name, email, phone? } (plan 18.3). */
export const POST = withApi(async ({ studio, body }) => {
  const name = bodyString(body, "name", 120);
  const email = bodyString(body, "email", 254);
  const { client, created } = await createClient(studio.id, { name, email, phone: bodyOptString(body, "phone", 40), source: "lightroom" });
  return { client: { id: client.id, name: client.name, email: client.email }, created };
}, { write: true });
