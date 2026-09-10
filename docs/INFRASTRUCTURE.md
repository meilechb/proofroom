# Infrastructure & Third-Party Providers

Decision record for the SaaS platform's external services: storage, database,
hosting/custom domains, and transactional email. The question this answers:
which provider for each layer holds up when we run hundreds of studios, each
with their own domain, their own galleries, and a lot of images.

All prices are US list prices confirmed against official pages on 2026-09-10.
Caps marked "raisable" can be increased via the provider's support or an
enterprise contract. Costs are modeled at an illustrative **500 studios**.

## The one fact that drives every decision

For an image product, **egress (bandwidth out) dominates cost — not storage,
not compute.** A studio uploads a gallery once and its clients view it many
times. The provider that charges for every byte served is the provider that
becomes expensive. This single fact decides storage and heavily influences
hosting.

The corollary: **custom domains are not a cost problem.** The research went in
worried that "multiple domains" would be expensive; it is not. Vercel gives
unlimited custom domains for $0 each; Cloudflare for SaaS gives 100 free then
$0.10 each. The domain count is a non-issue on the right providers. Bandwidth
is the thing to design around.

## Recommended stack

| Layer | Provider | ~500-studio cost/mo | Why |
|---|---|---|---|
| **Storage** | **Cloudflare R2** | ~$44 | Zero egress fees; S3-compatible API |
| **Database** | **Neon** (stay) | ~$110 (Scale) | Already built on it; serverless HTTP driver; zero migration |
| **Hosting** | **Vercel Pro** now → Cloudflare Workers later | $20–100 now | Unlimited free custom domains; move heavy bytes off it to R2 |
| **Email** | **Resend** (stay) now → SES later | $160 (Resend) / ~$32 (SES) | Signed webhooks, best DX; 1,000-domain cap covers 500 studios |

**Total at 500 studios: roughly $330–410/month.** The dominant lines are the
database and email, both of which have cheaper tiers if we optimize later.

## The single highest-leverage change: move storage to R2

We currently store galleries in Vercel Blob. This is the one change worth
making soon, because storage egress is where an image product bleeds money.

At a modest 2 TB stored / 20 TB served per month:

| Storage provider | Est. monthly | Egress model |
|---|---|---|
| **Cloudflare R2** | **~$44** | **$0 egress** |
| Backblaze B2 + Cloudflare | ~$14 | $0 egress via Bandwidth Alliance |
| Vercel Blob | **~$1,050+** | Metered egress on every view |

Vercel Blob is a proprietary API and prices egress per byte, so it scales
badly for exactly our access pattern. R2 is S3-compatible, so if we target the
**AWS S3 SDK** rather than a provider-specific client, the storage layer stays
portable — R2 today, Backblaze or S3 later, without another rewrite.

- Backblaze is cheaper on paper but adds a second vendor and depends on the
  Cloudflare Bandwidth Alliance for free egress. R2 is one vendor, zero-egress
  natively, and already sits next to the CDN. Recommend **R2**.
- Keep the current two-store split (private galleries, public marketing
  assets) — R2 supports both with per-bucket access rules.

**Migration effort:** rewrite one file (`src/lib/storage.ts`) from the Vercel
Blob client to the S3 SDK pointed at R2's endpoint. Signed-URL generation and
the upload/variant pipeline stay the same shape. This is the smallest change
with the largest payoff, and it does not require moving hosting.

## Database: stay on Neon

No change. Neon is the right call and re-confirmed:

- The **serverless HTTP driver** we already use is the correct choice for
  per-request serverless handlers — no connection-pool exhaustion under load.
- **Scale tier (~$110–150/mo)** now includes 30-day point-in-time recovery and
  HIPAA. **Launch tier (~$65–90/mo)** is enough until studio count or
  compliance needs push us up.
- Row-level `studio_id` scoping (already built) is the right multi-tenant model;
  no need for per-tenant databases at this scale.

Supabase was evaluated as the main alternative. It only wins if we want to
adopt its bundled Auth + Storage, which we don't — we have our own auth and are
moving storage to R2. Supabase also lacks scale-to-zero and charges +$100/mo
for PITR. **Migration effort to switch: none — we stay.**

## Hosting and custom domains

Two viable paths. The custom-domain worry is resolved either way.

### Option A — Vercel Pro (recommended now)
- **$20/mo base** + bandwidth (~$0.15/GB). Custom domains are **unlimited and
  free** — the multi-domain concern does not exist here.
- Solves the two things the Hobby plan could not: the real **15-minute cron**
  (Hobby caps at daily) and unlimited tenant domains.
- Keeps bandwidth low **only if images serve from R2/Cloudflare, not through
  Vercel.** With storage on R2, Vercel serves HTML/JS, not photos, so its
  metered bandwidth stays small. Estimated **$20–100/mo** at our scale.
- Zero hosting migration — we already run here.

### Option B — Cloudflare Workers via OpenNext (lowest cost, later)
- **~$35–50/mo** all-in including **Cloudflare for SaaS** for custom hostnames
  (100 free, then $0.10 each). Zero egress. Cron granularity down to 1 minute.
- Sits naturally next to R2 (same vendor, same zero-egress fabric).
- **Cost:** OpenNext is an adapter that runs Next.js on Workers. Next.js 16
  features (our middleware/`proxy.ts`, Server Actions, PageProps typegen) need
  compatibility testing before committing. This is real migration risk, so it
  is the *later* target, not the *now* move.

**Recommendation:** Go to **Vercel Pro now** (fixes crons + domains with zero
migration), move storage to **R2** in parallel (kills the bandwidth problem at
the source), and treat the **Workers/OpenNext** move as a later optimization
once studio count makes the ~$400/mo delta worth the compatibility work.

Cloudflare for SaaS is worth knowing about independently: it can front **any**
host and terminate tenant custom domains (SSL included) regardless of where the
app runs. It is the cleanest answer to "each studio brings its own domain" no
matter which hosting option we land on.

## Email: stay on Resend now, plan an SES path

No provider charges a mandatory per-domain fee. The real differentiators are
the **cap on domains per account** and whether **webhooks are signed**.

| Provider | Domain cap | Webhooks signed? | ~200k-email, 500-domain cost/mo |
|---|---|---|---|
| **Resend** (current) | 1,000 (Scale), raisable | **Yes (Svix HMAC)** | **$160** |
| **Amazon SES** | 10,000/region, raisable | Yes (SNS X.509) | **~$32** |
| Mailgun | 1,000, raisable | Yes (HMAC) | ~$200 |
| Postmark | Unlimited (Platform) | **No (basic-auth only)** | ~$246 |
| SendGrid | ~1,500, subuser friction | Yes (ECDSA) | ~$90–150 |
| Loops | **Not supported** | — | **Disqualified** |

- **Stay on Resend.** Its 1,000-domain Scale cap comfortably covers 500
  studios, webhooks are cryptographically signed (Svix), the domain
  create/verify API returns the DKIM/SPF/DMARC records we show each studio, and
  migration cost is zero. Buy the $20-per-100-domain add-on or move to
  Enterprise as we approach the cap.
- **Plan an SES path** for the "thousands of domains / cost-sensitive" future.
  SES is ~5× cheaper (~$32 vs $160) and scales to 10,000 domains/region, but we
  would own IP warmup, tenant compliance, and the SNS→webhook plumbing. Resend
  is built on SES infrastructure, so deliverability behavior is similar and the
  jump is mostly ops maturity, not a product rethink.
- **Loops is disqualified** — it cannot register multiple tenant sending
  domains.

**Migration effort if/when we move to SES:** rewrite one file (`src/lib/email.ts`)
and stand up an SNS→webhook receiver with signature verification. Contained.

## Migration effort, summarized

| Change | Effort | When |
|---|---|---|
| Storage → R2 | Rewrite `src/lib/storage.ts` to S3 SDK | **Soon** — highest payoff |
| Hosting → Vercel Pro | None (config/plan change) | **Now** — fixes crons + domains |
| Database → stay on Neon | None | — |
| Email → stay on Resend | None | — |
| Hosting → Workers/OpenNext | Next.js 16 compat testing | Later |
| Email → SES | Rewrite `src/lib/email.ts` + SNS receiver | Later (near 1,000 domains) |

Targeting the **S3 SDK** for storage and keeping `email.ts` and `storage.ts` as
thin single-file adapters is what keeps every one of these a contained,
one-file change rather than a rewrite.

## Sources

- **Storage** — Cloudflare R2 pricing (zero egress): https://developers.cloudflare.com/r2/pricing/ · Backblaze B2 pricing: https://www.backblaze.com/cloud-storage/pricing · Vercel Blob pricing: https://vercel.com/docs/storage/vercel-blob/usage-and-pricing
- **Database** — Neon pricing: https://neon.tech/pricing · Serverless driver: https://neon.tech/docs/serverless/serverless-driver · Supabase pricing: https://supabase.com/pricing
- **Hosting/domains** — Vercel pricing: https://vercel.com/pricing · Cloudflare for SaaS (custom hostnames): https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/ · OpenNext Cloudflare: https://opennext.js.org/cloudflare
- **Email** — Resend pricing: https://resend.com/pricing · Resend webhook verification: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests · Amazon SES pricing: https://aws.amazon.com/ses/pricing/ · SES quotas: https://docs.aws.amazon.com/ses/latest/dg/quotas.html · Postmark webhooks: https://postmarkapp.com/developer/webhooks/webhooks-overview · Mailgun pricing: https://www.mailgun.com/pricing/ · SendGrid pricing: https://www.twilio.com/en-us/products/email-api/pricing · Loops multi-domain limitation: https://loops.so/docs/deliverability/sending-from-multiple-domains
