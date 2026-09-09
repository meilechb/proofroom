import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { APP_NAME } from "@/lib/env";
import { db, dbConfigured, one } from "@/lib/db";
import { isReferralCodeShape, normalizeReferralCode, REFERRAL_REWARD_TEXT } from "@/lib/referrals";
import { Notice } from "@/components/ui";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Start free", robots: { index: false } };

/** Studio name behind a referral code, if it exists (plan 5.4). */
async function referrerName(code: string | null) {
  if (!code || !isReferralCodeShape(code) || !dbConfigured()) return null;
  const row = one<{ name: string }>(await db()`select name from studios where referral_code = ${normalizeReferralCode(code)} and deleted_at is null`);
  return row?.name ?? null;
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const fromQuery = typeof sp.ref === "string" ? sp.ref : null;
  const code = fromQuery ?? (await cookies()).get("ref")?.value ?? null;
  const referrer = await referrerName(code);
  return (
    <div className="card card-pad">
      <h1 className="text-xl font-semibold">Create your studio</h1>
      <p className="mt-1 text-sm text-ink-2">14-day free trial. No card needed. One plan, everything included.</p>
      {referrer ? (
        <Notice tone="success" className="mt-4">
          Referred by <strong>{referrer}</strong>: you both get {REFERRAL_REWARD_TEXT} once your subscription starts.
        </Notice>
      ) : null}
      <SignupForm refCode={referrer && code ? normalizeReferralCode(code) : ""} />
      <p className="mt-6 text-sm text-ink-2">
        Already using {APP_NAME}? <Link href="/login" className="font-medium text-ink underline">Sign in</Link>
      </p>
    </div>
  );
}
