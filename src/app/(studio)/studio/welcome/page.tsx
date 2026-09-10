import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudioPage } from "@/lib/auth";
import { listPackages } from "@/lib/packages";
import { APP_NAME } from "@/lib/env";
import { PLAN, TRIAL_DAYS, formatPrice } from "@/lib/plans";
import { Stepper } from "@/components/ui/stepper";
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Welcome to {APP_NAME}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set up your studio</h1>
        <p className="mt-1 text-sm text-ink-2">A few minutes now and you can send your first gallery today. You can change any of this later.</p>
      </div>
      <div className="mb-8 overflow-x-auto">
        <Stepper steps={STEP_LABELS} current={step - 1} />
      </div>

      <div className="card card-pad">
        {step === 1 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-lg font-semibold">Your brand</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">Name, logo and color. These appear on your galleries, emails and website.</p>
            <BrandForm name={s.name} color={s.brand_color} logoUrl={s.logo_url} />
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-lg font-semibold">Pick a website template</h2>
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
            <h2 id="step-h" className="text-lg font-semibold">Your packages</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">We added three to start. Edit the prices and included photos to match how you work.</p>
            <PackagesForm packages={packages} />
            <div className="mt-4"><BackLink to={2} /></div>
          </section>
        ) : null}

        {step === 4 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-lg font-semibold">Get paid</h2>
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
            <h2 id="step-h" className="text-lg font-semibold">Email sender</h2>
            <p className="mt-1 text-sm text-ink-2 mb-5">The name and reply-to for the emails you send. Verify your own domain later so mail comes from you.</p>
            <EmailSenderForm fromName={(settings.email_from_name as string) || s.name} replyTo={s.email} />
            <div className="mt-4"><BackLink to={4} /></div>
          </section>
        ) : null}

        {step === 6 ? (
          <section aria-labelledby="step-h">
            <h2 id="step-h" className="text-lg font-semibold">Install the Lightroom plugin</h2>
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
            <h2 id="step-h" className="mt-4 text-lg font-semibold">You are set up</h2>
            <p className="mt-1 text-sm text-ink-2 max-w-md mx-auto">Your studio is ready. Your trial runs for {TRIAL_DAYS} days, then it is {formatPrice(PLAN.monthlyCents)} a month with everything included. The dashboard has a checklist for anything you skipped.</p>
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
        <p className="mt-6 text-center text-xs text-muted">
          Step {step} of {WIZARD_STEPS}. <SkipToEnd />
        </p>
      ) : null}
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
