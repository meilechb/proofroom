import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/studio";
  const notice = sp.verified === "1" ? "Email verified. Sign in to continue." : sp.reset === "1" ? "Password updated. Sign in with your new password." : null;
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {notice ? <p className="mt-2 text-sm text-success">{notice}</p> : null}
      <LoginForm next={next} />
      <div className="mt-6 flex justify-between text-sm text-ink-2">
        <Link href="/forgot-password" className="underline">Forgot password?</Link>
        <Link href="/signup" className="underline">Create a studio</Link>
      </div>
    </div>
  );
}
