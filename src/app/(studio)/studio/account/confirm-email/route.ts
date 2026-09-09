import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/env";
import { confirmEmailChange } from "../actions";

/** Landing route for the email-change confirmation link (plan 5.18). */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await confirmEmailChange(token);
  const target = new URL("/studio/account", appUrl());
  target.searchParams.set("email", "error" in result ? "invalid" : "changed");
  return NextResponse.redirect(target);
}
