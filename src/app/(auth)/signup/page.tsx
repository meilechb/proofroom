import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/env";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Start free", robots: { index: false } };

export default function SignupPage() {
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Create your studio</h1>
      <p className="mt-1 text-sm text-ink-2">Free plan plus a 14-day Pro trial. No card needed.</p>
      <SignupForm />
      <p className="mt-6 text-sm text-ink-2">
        Already using {APP_NAME}? <Link href="/login" className="font-medium text-ink underline">Sign in</Link>
      </p>
    </div>
  );
}
