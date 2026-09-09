import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) {
    return (
      <div className="card card-pad">
        <h1 className="text-xl font-semibold">Link missing</h1>
        <p className="mt-2 text-sm text-ink-2">Open the reset link from your email, or <Link href="/forgot-password" className="underline">request a new one</Link>.</p>
      </div>
    );
  }
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <ResetForm token={token} />
    </div>
  );
}
