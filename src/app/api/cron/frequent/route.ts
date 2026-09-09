import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, runJobs } from "@/lib/cron";
import { releaseExpiredHolds } from "@/lib/booking";
import { advanceRunningImports } from "@/lib/imports";

export const maxDuration = 300;

/** Every 15 minutes (vercel.json): short, chunked work. */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const results = await runJobs("frequent", {
    releaseExpiredBookingHolds: releaseExpiredHolds,
    advanceImports: advanceRunningImports,
  });
  return NextResponse.json(results);
}
