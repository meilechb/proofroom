import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export async function GET(request: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
