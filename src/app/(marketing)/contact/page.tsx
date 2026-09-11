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
          <Heading level={1} className="mt-3 text-4xl sm:text-5xl">Talk to a person</Heading>
          <Lead>Questions before you start, help moving from another tool, or a large team headshot program to set up. We reply within one business day.</Lead>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-brand" aria-hidden>✉</span>
              <span>Email <a href={`mailto:${supportEmail()}`} className="underline">{supportEmail()}</a></span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-brand" aria-hidden>◆</span>
              <span className="text-ink-2">Already a customer? <Link href="/login" className="underline">Sign in</Link> and use the help link in the app so we can see your studio.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-brand" aria-hidden>⚑</span>
              <span className="text-ink-2">Security reports: see the <Link href="/security" className="underline">security page</Link>.</span>
            </li>
          </ul>
        </div>
        <div className="card card-pad">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
