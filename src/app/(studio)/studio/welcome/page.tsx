import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { listPackages } from "@/lib/packages";
import { APP_NAME } from "@/lib/env";
import { PRO_SEAT_CENTS, TRIAL_DAYS, formatPrice } from "@/lib/plans";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { STEP_LABELS, WIZARD_STEPS, clampStep } from "./steps";
import { finishWizardAction, goToStepAction, saveTemplateAction } from "./actions";
import { BrandForm, EmailSenderForm, PackagesForm, TokenForm } from "./step-forms";

export const metadata = { title: "Welcome", robots: { index: false } };

const TEMPLATE_INFO = [
  { id: "editorial", name: "Editorial", desc: "Large single images and a long scroll. Best when the photographs carry the page." },
  { id: "gallery", name: "Gallery", desc: "A grid of work up front. Best for showing range at a glance." },
] as const;

function SkipButton({ to, label = "Skip for now" }: { to: number; label?: string }) {
  return (
    <form action={goToStepAction}>
      <input type="hidden" name="step" value={to} />
      <button className="btn-ghost" type="submit">{label}</button>
    </form>
  );
}

function BackLink({ to }: { to: number }) {
  return (
    <form action={goToStepAction}>
      <input type="hidden" name="step" value={to} />
      <button className="text-sm text-ink-2 hover:text-ink" type="submit">← Back</button>
    </form>
  );
}

/** Clickable pine step rail (design: onboarding.dc.html). Each step posts to goToStepAction. */
function StepRail({ current }: { current: number }) {
  return (
    <aside className="flex flex-col rounded-2xl bg-pine-dark p-5 text-white sm:p-6 lg:sticky lg:top-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gold/90">Welcome to {APP_NAME}</p>
      <h1 className="mt-1.5 font-display text-[26px] leading-tight text-white">Set up your studio</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/70">A few minutes now and you can send your first gallery today.</p>
      <nav aria-label="Setup steps" className="mt-6 flex flex-col gap-1">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <form key={label} action={goToStepAction}>
              <input type="hidden" name="step" value={n} />
              <button
                type="submit"
                aria-current={active ? "step" : undefined}
                className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", active ? "bg-white/15" : "hover:bg-white/5")}
              >
                <span
                  className={cx(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    done ? "border-transparent bg-gold text-pine-deep" : active ? "border-transparent bg-white text-pine-dark" : "border-white/30 text-white/60",
                  )}
                >
                  {done ? <Icon.Check size={14} /> : n}
                </span>
                <span className={cx("text-sm", active ? "font-semibold text-white" : done ? "text-white/80" : "text-white/55")}>{label}</span>
              </button>
            </form>
          );
        })}
      </nav>
      <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/55">
        {TRIAL_DAYS}-day trial · no card needed.<br />You can change any of this later.
      </p>
    </aside>
  );
}

export default async function WelcomePage({ searchParams }: PageProps<"/studio/welcome">) {
  const ctx = await requireStudioPage("admin");
  const s = ctx.studio;
  if (s.onboarding?.wizard_done) redirect("/studio");
  const sp = await searchParams;
  const savedStep = typeof s.onboarding?.wizard_step === "number" ? (s.onboarding.wizard_step as number) : 1;
  const step = clampStep(typeof sp.step === "string" ? sp.step : savedStep);
  const packages = step === 3 ? await listPackages(s.id) : [];
  const settings = (s.settings ?? {}) as Record<string, unknown>;
  const paymentsReady = s.stripe_account_status === "enabled" || s.stripe_connect_method === "manual";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid items-start gap-6 lg:grid-cols-[260px_1fr]">
        <StepRail current={step} />
        <div>
          <div className="card card-pad">
            <p className="eyebrow mb-3">Step {step} of {WIZARD_STEPS}</p>
        {step === 1 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-2xl">Your brand</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">Name, logo and color. These appear on your galleries, emails and website.</p>
            <BrandForm name={s.name} color={s.brand_color} logoUrl={s.logo_url} />
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-2xl">Pick a website template</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">Two clean templates. Change it any time; your content stays.</p>
            <form action={saveTemplateAction} className="space-y-4">
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="sr-only">Template</legend>
                {TEMPLATE_INFO.map((t) => (
                  <label key={t.id} className="relative flex cursor-pointer flex-col rounded-xl border border-line-2 p-4 has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-accent/30">
                    <input type="radio" name="template" value={t.id} defaultChecked={s.site_template === t.id} className="absolute right-4 top-4 h-4 w-4" />
                    <div className="aspect-[4/3] rounded-lg bg-surface-2 mb-3 grid grid-cols-3 gap-1 p-2" aria-hidden>
                      {t.id === "editorial" ? (
                        <div className="col-span-3 rounded bg-line-2" />
                      ) : (
                        Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded bg-line-2" />)
                      )}
                    </div>
                    <span className="font-medium">{t.name}</span>
                    <span className="mt-1 text-xs text-ink-2">{t.desc}</span>
                  </label>
                ))}
              </fieldset>
              <div className="flex items-center justify-between">
                <BackLink to={1} />
                <button type="submit" className="btn-primary">Save and continue</button>
              </div>
            </form>
          </section>
        ) : null}

        {step === 3 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-2xl">Your packages</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">We added three to start. Edit the prices and included photos to match how you work.</p>
            <PackagesForm packages={packages} />
            <div className="mt-4"><BackLink to={2} /></div>
          </section>
        ) : null}

        {step === 4 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-2xl">Get paid</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">Connect Stripe so clients can pay deposits and balances by card, straight into your own account. We take 0%.</p>
            {paymentsReady ? (
              <div className="rounded-lg border border-success/30 bg-success-bg p-4 text-sm text-success">Payments are set up. You can manage them in settings.</div>
            ) : (
              <div className="space-y-3">
                <form action="/api/connect/oauth/start" method="post">
                  <input type="hidden" name="next" value="/studio/welcome?step=5" />
                  <button type="submit" className="btn-primary w-full">Connect an existing Stripe account</button>
                </form>
                <form action="/api/connect/onboard" method="post">
                  <input type="hidden" name="next" value="/studio/welcome?step=5" />
                  <button type="submit" className="btn-secondary w-full">Create a new Stripe account</button>
                </form>
                <p className="text-xs text-muted text-center">Stripe verifies your business, not us. You can also record cash or bank payments by hand.</p>
              </div>
            )}
            <div className="mt-5 flex items-center justify-between">
              <BackLink to={3} />
              <SkipButton to={5} label={paymentsReady ? "Continue" : "Skip for now"} />
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-2xl">Email sender</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">The name and reply-to for the emails you send. Verify your own domain later so mail comes from you.</p>
            <EmailSenderForm fromName={(settings.email_from_name as string) || s.name} replyTo={s.email} />
            <div className="mt-4"><BackLink to={4} /></div>
          </section>
        ) : null}

        {step === 6 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-2xl">Install the Lightroom plugin</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">Publish galleries straight from Lightroom Classic and get client favorites and notes back. Optional; set it up any time.</p>
            <TokenForm />
            <p className="mt-4 text-sm"><Link href="/lightroom" className="underline" target="_blank">Read the install guide</Link></p>
            <div className="mt-5 flex items-center justify-between">
              <BackLink to={5} />
              <SkipButton to={7} label="Continue" />
            </div>
          </section>
        ) : null}

        {step === 7 ? (
          <section aria-labelledby="step-h" className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-success text-white flex items-center justify-center text-2xl" aria-hidden>✓</div>
            <h2 id="step-h" className="mt-4 text-2xl">You are set up</h2>
            <p className="mt-1 text-sm text-ink-2 max-w-md mx-auto">Your studio is ready. You have {TRIAL_DAYS} days of Pro to try everything; after that you stay on the Free plan or upgrade for {formatPrice(PRO_SEAT_CENTS)} per seat. The dashboard has a checklist for anything you skipped.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <form action={finishWizardAction}>
                <button type="submit" className="btn-primary btn-lg">Go to the dashboard</button>
              </form>
              <Link href="/studio/website" className="btn-secondary btn-lg">Edit my website</Link>
            </div>
            <div className="mt-5"><BackLink to={6} /></div>
          </section>
        ) : null}
          </div>
          {step < WIZARD_STEPS ? (
            <p className="mt-5 text-center text-xs text-muted"><SkipToEnd /></p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SkipToEnd() {
  return (
    <form action={goToStepAction} className="inline">
      <input type="hidden" name="step" value={WIZARD_STEPS} />
      <button type="submit" className="underline hover:text-ink">Skip setup</button>
    </form>
  );
}
