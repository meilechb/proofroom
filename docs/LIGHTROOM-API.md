# Lightroom plugin API

The plugin talks to the studio's own site over HTTPS. Every request carries the
studio's token as `Authorization: Bearer <token>` and every response includes an
`X-LR-Api-Version` header. The plugin should read that header and the minimum
plugin version from `/ping`, and prompt the user to update when its own version
is below the minimum.

Base URL: the studio's app URL (for example `https://app.example.com`).

## Auth and limits

- **Token → studio.** A revoked or unknown token returns `401 { code: "unauthorized" }`.
- **Rate limit.** 120 requests per token per minute; over the limit returns
  `429 { code: "rate_limited" }`.
- **Read-only.** When a studio's billing is past due and suspended, write calls
  return `402 { code: "read_only" }`. Reads still work.
- **Errors** are always JSON `{ error, code }` with a matching HTTP status.

## Endpoints (v1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/lr/ping` | Studio name, `apiVersion`, `minPluginVersion`. |
| GET | `/api/lr/clients?q=` | Search clients. |
| POST | `/api/lr/clients` | Create a client `{ name, email, phone? }`. |
| GET | `/api/lr/galleries?client=` | List galleries, optionally for one client. |
| GET | `/api/lr/galleries/[id]` | One gallery with its access code, URL and photo count. |
| POST | `/api/lr/galleries` | Create `{ title, kind: "proof"\|"final", client_id \| client_name+client_email }`. |
| POST | `/api/lr/photos/begin` | Reserve a photo `{ gallery_id, filename, size, sha256?, content_type?, lr_photo_id? }` → `{ photoId, uploadUrl, duplicate }`. |
| PUT | `/api/lr/photos/[id]/data` | Upload the JPEG bytes (raw body). The server stores the original and builds web and thumb variants. |
| PATCH | `/api/lr/photos/[id]` | Replace the file in place `{ filename? }` → `{ uploadUrl }`; the id and order are kept. |
| DELETE | `/api/lr/photos/[id]` | Remove a photo. |
| GET | `/api/lr/galleries/[id]/feedback?since=` | Client favorites and comments since a timestamp. |
| POST | `/api/lr/galleries/[id]/publish` | Publish; returns the access code. |
| POST | `/api/lr/galleries/[id]/unpublish` | Return to draft. |

Uploads are server-side so a Lightroom plugin can use plain HTTP: `begin` reserves
the photo and returns an `uploadUrl`, the plugin PUTs the rendered JPEG bytes to
that URL, and the server stores the original and builds the variants. A repeated
`sha256` within a gallery returns the existing photo id with `duplicate: true` and
a null `uploadUrl`.

## Changelog

### v1 (2026)

- Initial API: ping, clients, galleries, photo begin/complete/replace/delete,
  feedback, publish/unpublish. `X-LR-Api-Version: 1`. Minimum plugin version
  `1.0.0`.
