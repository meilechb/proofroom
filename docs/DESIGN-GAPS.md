# Design gaps — features referenced by the design but not built

The design handoff (copy deck section G "Planned / not built yet", the `.dc.html`
mockups, and the studio nav / settings sub-nav links) references a few things the
shipped app links to but never built. This note tracks each and its status.

The data model already exists for all three studio pages — these were missing
UI pages on real tables, not missing systems.

| # | Feature | Route | Data it uses | Status |
|---|---------|-------|--------------|--------|
| 1 | Studio Calendar | `/studio/calendar` (linked in studio nav) | `orders.scheduled_at` (shoots), `booking_slots` (holds), `settings.booking` blocked/closed dates | ✅ built |
| 2 | Studio Bookings | `/studio/bookings` (linked in studio nav) | `booking_requests` + `inquiries`, `booking_slots` (upcoming) | ✅ built |
| 3 | Settings → Agreement | `/studio/settings/agreement` (linked in settings sub-nav) | `agreement_templates`, `lib/agreements.ts` | ✅ built |
| 4 | Google sign-in | `/login`, `/signup` (button in the design) | Google OAuth + `users.google_sub` | ✅ built (needs credentials) |

## Notes

- **Calendar / Bookings** used to 404 — the nav linked routes that had no page.
  Booking *settings* (`/studio/settings/bookings`) existed; the *list* and the
  *calendar* did not.
- **Agreement** — the per-studio agreement engine was fully built
  (`agreement_templates` table + `lib/agreements.ts`: default template,
  `renderAgreement`, `unknownAgreementVariables`, `agreementToPlainText`, and the
  variable set). Only the editor page under Settings was missing, so the settings
  sub-nav linked to a 404.

## Google sign-in

The design leads both `/login` and `/signup` with a "Continue with Google"
button. Built as a standard OAuth 2.0 authorization-code flow:

- `GET /auth/google/start` — sets a short-lived CSRF cookie and redirects to Google.
- `GET /auth/google/callback` — verifies the CSRF nonce, exchanges the code for
  the id_token at Google's token endpoint (server-to-server over TLS), requires a
  verified email, then signs the user in via `findOrCreateGoogleUser`:
  known Google account → sign in; matching email → link (`users.google_sub`);
  new person → create the user (no password; `password_hash` is nullable) plus
  their first studio, and land on `/studio/welcome`.
- `src/lib/google-oauth.ts` holds the flow; `users.google_sub` is the link column.

**The button is gated on configuration.** It renders as a real link only when
both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (see `.env.example`);
otherwise it shows the disabled "coming soon" placeholder so the design still
reads. The operator must create an OAuth client in Google Cloud Console and add
the redirect URI `{APP_URL}/auth/google/callback`.

## Out of scope (noted by the design as future, not built here)

- **Annual billing** — the pricing FAQ says monthly only for now.
- **Two-way calendar sync** (Google Calendar) — only an iCal feed is planned.
