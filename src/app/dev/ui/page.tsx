import { notFound } from "next/navigation";
import { Badge, Button, Card, EmptyState, Field, Input, Meter, Notice, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { Stepper } from "@/components/ui/stepper";
import { ColorField, DateTimeField, MoneyField } from "@/components/ui/fields";
import { DevInteractive } from "./interactive";

export const metadata = { robots: { index: false, follow: false }, title: "UI kit" };

/** Component gallery for development only (plan 4.27). */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="container-x py-10 space-y-10">
      <PageHeader eyebrow="Development" title="UI kit" description="Every shared component in one place, so a change is visible everywhere it is used." />
      <section className="space-y-3">
        <h2 className="font-medium">Buttons and badges</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button size="sm">Small</Button><Button size="lg">Large</Button><Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap gap-2"><Badge>Neutral</Badge><Badge tone="success">Success</Badge><Badge tone="warning">Warning</Badge><Badge tone="danger">Danger</Badge><Badge tone="brand">Brand</Badge></div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Input" htmlFor="i1" hint="A hint"><Input id="i1" placeholder="Type" /></Field>
        <Field label="With error" htmlFor="i2" error="Something is wrong"><Input id="i2" /></Field>
        <Field label="Select" htmlFor="s1"><Select id="s1"><option>One</option><option>Two</option></Select></Field>
        <Field label="Textarea" htmlFor="t1"><Textarea id="t1" /></Field>
        <ColorField name="color" label="Color" />
        <DateTimeField name="when" label="Date and time" timeZone="America/New_York" />
        <MoneyField name="amount" label="Amount" defaultCents={25000} />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Live galleries" value={12} hint="3 expiring soon" />
        <Card><Meter value={64} max={100} label="Storage" /></Card>
        <Card><Stepper steps={["Brand", "Template", "Packages", "Payments"]} current={2} /></Card>
      </section>
      <section className="space-y-3">
        <Notice>Neutral notice</Notice><Notice tone="success">Success notice</Notice><Notice tone="warning">Warning notice</Notice><Notice tone="danger">Danger notice</Notice>
      </section>
      <section className="flex flex-wrap gap-3 text-ink-2">
        {Object.entries(Icon).map(([name, Cmp]) => (
          <span key={name} className="inline-flex items-center gap-1 text-xs"><Cmp /> {name}</span>
        ))}
      </section>
      <EmptyState title="Nothing here yet" description="Empty states always offer one clear action." action={<Button>Add the first one</Button>} />
      <DevInteractive />
    </main>
  );
}
