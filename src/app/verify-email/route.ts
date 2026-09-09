import { NextResponse, type NextRequest } from "next/server";
import { consumeAuthToken, markEmailVerified } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeAuthToken(token, "verify_email");
  const url = request.nextUrl.clone();
  url.search = "";
  if (!userId) {
    url.pathname = "/login";
    url.searchParams.set("verify", "invalid");
    return NextResponse.redirect(url);
  }
  await markEmailVerified(userId);
  await audit({ actorUserId: userId, action: "user.email_verified" });
  const current = await getCurrentUser();
  url.pathname = current && current.id === userId ? "/studio" : "/login";
  url.searchParams.set("verified", "1");
  return NextResponse.redirect(url);
}
