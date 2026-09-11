"use client";

import { useActionState, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { AUTOMATION_RULES, type AutomationSettings } from "@/lib/automations-shared";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { cx } from "@/components/ui";
import { saveAutomationsAction } from "./actions";

export function AutomationsForm({ settings, paused }: { settings: AutomationSettings; paused: boolean }) {
  const [state, action] = useActionState(saveAutomationsAction, initialActionState);
  const [isPaused, setPaused] = useState(paused);

  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />

      <label className={cx("flex items-start gap-3 rounded-lg border p-3", isPaused ? "border-warning bg-warning-bg" : "border-line")}>
        <input type="checkbox" name="automations_paused" checked={isPaused} onChange={(e) => setPaused(e.target.checked)} className="mt-1 h-4 w-4" />
        <span className="text-sm"><strong>Pause all automations.</strong> Turn this on while you are away; no automatic emails go out until you turn it back off. Nothing is lost.</span>
      </label>

      <ul className="space-y-2">
        {AUTOMATION_RULES.map((def) => {
          const s = settings[def.rule];
          return (
            <li key={def.rule} className={cx("flex items-center justify-between gap-4 rounded-[12px] border border-line bg-surface p-4", isPaused && "opacity-60")}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{def.label}</p>
                <p className="mt-0.5 text-xs text-ink-2">{def.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="number" name={`days_${def.rule}`} defaultValue={s.days} min={0} max={60} className="h-8 w-16 rounded border border-line-2 bg-surface px-2 text-sm text-ink" />
                  days
                </label>
                <label className="cursor-pointer" title={`Turn ${def.label} on or off`}>
                  <input type="checkbox" name={`enabled_${def.rule}`} defaultChecked={s.enabled} className="peer sr-only" />
                  <span aria-hidden className="relative block h-[26px] w-[46px] shrink-0 rounded-full bg-line-2 transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-1 after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-[19px]" />
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      <SubmitButton>Save automations</SubmitButton>
    </form>
  );
}
