# saas/

The multi-tenant photographer platform: studio websites from templates, client galleries with proofing, CRM, payments into each studio's own Stripe account, email from each studio's own domain, and a two-way Lightroom Classic plugin. One plan, $40 a month, everything included.

The product name is not decided. `NEXT_PUBLIC_APP_NAME` is a placeholder and one rename pass (plan item 1.30) replaces it everywhere.

## Run locally

```bash
cd saas
cp .env.example .env.local     # fill in what you have; the app degrades gracefully
npm install
npm run dev                    # prints which env vars are missing, then starts Next
```

Open http://localhost:3000. Tenant sites are reachable at `/t/{slug}/...` on localhost (in production they live at `{slug}.APP_DOMAIN` and on custom domains).

## Checks

```bash
npx next typegen && npm run typecheck
npm run lint
npm test
npm run build                  # applies db/schema.sql when DATABASE_URL is set, then builds
```

CI runs the same four commands with no secrets on every push touching `saas/` (`.github/workflows/saas.yml`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run env:check` | Lists required env vars and which are missing. Never prints values. |
| `npm run db:migrate` | Applies `db/schema.sql` (idempotent) to `DATABASE_URL`. |
| `npm run stripe:setup` | Creates the one price, the referral coupon and the two webhook endpoints in Stripe. |
| `npm run platform:admin you@example.com` | Makes an existing user a platform admin. |
| `npm run plugin:zip` | Builds the Lightroom plugin zip with the site URL stamped in. |

## Where things are

- `docs/BUILD-PLAN.md`: the full plan, about 1,000 pieces, with what is done. Appendix A is the Stripe Connect registration walkthrough.
- `docs/SETUP.md`: production setup runbook (Vercel, Neon, Blob, Stripe, Resend, DNS).
- `docs/ARCHITECTURE.md`: how tenancy, auth, storage, payments, email and the plugin fit together.
- `docs/NAME-CANDIDATES.md`: domain availability list for the naming decision.
- `db/schema.sql`: the whole schema, idempotent.
- `src/lib`: server libraries. `src/app`: routes. `src/components`: UI.
- `src/proxy.ts`: host classification and tenant rewrites.
