import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, supportEmail } from "@/lib/env";
import { Heading, Lead, Section } from "@/components/marketing/sections";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: `Questions about ${APP_NAME}, switching from another tool, or a team headshot program? Send a message; we reply within one business day.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="eyebrow">Contact</p>
          <Heading level={1} className="mt-3 text-4xl">Talk to a person</Heading>
          <Lead>Questions before you start, help moving from another tool, or a large team headshot program to set up. We reply within one business day.</Lead>
          <dl className="mt-8 space-y-4 text-sm">
            <div>
              <dt className="font-medium">Email</dt>
              <dd className="text-ink-2"><a href={`mailto:${supportEmail()}`} className="underline">{supportEmail()}</a></dd>
            </div>
            <div>
              <dt className="font-medium">Already a customer?</dt>
              <dd className="text-ink-2">Sign in and use the help link in the app so we can see your studio. <Link href="/login" className="underline">Sign in</Link></dd>
            </div>
            <div>
              <dt className="font-medium">Security reports</dt>
              <dd className="text-ink-2">See the <Link href="/security" className="underline">security page</Link>.</dd>
            </div>
          </dl>
        </div>
        <div className="card card-pad">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
