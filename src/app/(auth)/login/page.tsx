import type { Metadata } from "next";
import Link from "next/link";
import { configured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const GOOGLE_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't complete. Try again, or use your email and password.",
  google_unverified: "That Google account's email isn't verified, so we can't sign you in with it.",
  google_unconfigured: "Google sign-in isn't set up on this studio yet.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/studio";
  const notice = sp.verified === "1" ? "Email verified. Sign in to continue." : sp.reset === "1" ? "Password updated. Sign in with your new password." : null;
  const error = typeof sp.error === "string" ? GOOGLE_ERRORS[sp.error] : null;
  const googleHref = configured.google() ? `/auth/google/start${next && next !== "/studio" ? `?next=${encodeURIComponent(next)}` : ""}` : undefined;
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {notice ? <p className="mt-2 text-sm text-success">{notice}</p> : null}
      {error ? <p className="mt-2 rounded-lg border border-danger/20 bg-danger-bg p-2.5 text-sm text-danger-fg">{error}</p> : null}
      <LoginForm next={next} googleHref={googleHref} />
      <div className="mt-6 flex justify-between text-sm text-ink-2">
        <Link href="/forgot-password" className="underline">Forgot password?</Link>
        <Link href="/signup" className="underline">Create a studio</Link>
      </div>
    </div>
  );
}
