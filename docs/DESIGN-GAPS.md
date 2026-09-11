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
| 4 | Google sign-in | `/login`, `/signup` (button in the design) | new: Google OAuth + `users`/`memberships` | see below |

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
button. The app had no Google OAuth backend. Status recorded in the table above;
implementation details and any configuration the operator must provide are in the
commit that builds it.

## Out of scope (noted by the design as future, not built here)

- **Annual billing** — the pricing FAQ says monthly only for now.
- **Two-way calendar sync** (Google Calendar) — only an iCal feed is planned.
