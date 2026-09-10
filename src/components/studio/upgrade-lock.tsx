import Link from "next/link";
import { Badge, Card } from "@/components/ui";

/**
 * Shown in place of a Pro-only feature's controls when the studio is on Free.
 * Server component; callers decide when to render it from `ctx.entitlements`.
 */
export function UpgradeLock({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h2 className="font-medium">{title}</h2>
        <Badge tone="brand">Pro</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {children ? <>{children} </> : null}
        <Link href="/studio/billing" className="underline">Upgrade to Pro</Link> to unlock it.
      </p>
    </Card>
  );
}
