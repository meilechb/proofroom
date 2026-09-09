import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/** Numbered progress for wizards (plan 4.24). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span className={cx("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium border", done ? "bg-brand text-brand-ink border-brand" : active ? "border-ink text-ink" : "border-line-2 text-muted")}>
              {done ? <Icon.Check size={14} /> : i + 1}
            </span>
            <span className={cx(active ? "font-medium" : "text-ink-2", done && "text-ink-2")}>{label}</span>
            {i < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-line-2" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
