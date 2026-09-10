import { withApi, bodyString, ApiError } from "@/lib/lr-api";
import { db, rows, isUuid } from "@/lib/db";
import { createClient } from "@/lib/clients";
import { createGallery } from "@/lib/galleries";
import { bodyOptString } from "@/lib/lr-api";

type GalleryRow = { id: string; title: string; kind: string; status: string; slug: string; client_id: string; created_at: string };

/** GET /api/lr/galleries?client= (plan 18.4). */
export const GET = withApi(async ({ studio, request }) => {
  const client = request.nextUrl.searchParams.get("client");
  const list = client && isUuid(client)
    ? rows<GalleryRow>(await db()`select id, title, kind, status, slug, client_id, created_at::text from galleries where studio_id = ${studio.id} and client_id = ${client} and parent_id is null order by created_at desc limit 100`)
    : rows<GalleryRow>(await db()`select id, title, kind, status, slug, client_id, created_at::text from galleries where studio_id = ${studio.id} and parent_id is null order by created_at desc limit 100`);
  return { galleries: await list };
});

/** POST /api/lr/galleries { title, kind, client_id | client_name+client_email } (plan 18.4). */
export const POST = withApi(async ({ studio, body }) => {
  const title = bodyString(body, "title", 200);
  const kind = bodyString(body, "kind", 10);
  if (kind !== "proof" && kind !== "final") throw new ApiError(400, "invalid", 'kind must be "proof" or "final".');

  let clientId = bodyOptString(body, "client_id", 64);
  if (clientId && !isUuid(clientId)) throw new ApiError(400, "invalid", "client_id is not a valid id.");
  if (!clientId) {
    const name = bodyString(body, "client_name", 120);
    const email = bodyString(body, "client_email", 254);
    const { client } = await createClient(studio.id, { name, email, source: "lightroom" });
    clientId = client.id;
  }
  const gallery = await createGallery(studio.id, { clientId, kind, title, source: "lightroom" });
  return { gallery: { id: gallery.id, title: gallery.title, kind: gallery.kind, status: gallery.status, slug: gallery.slug, client_id: gallery.client_id } };
}, { write: true });
