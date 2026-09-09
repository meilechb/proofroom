import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-2">Enter your email and we will send a link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-6 text-sm text-ink-2"><Link href="/login" className="underline">Back to sign in</Link></p>
    </div>
  );
}
