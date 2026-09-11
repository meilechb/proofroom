import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, runJobs } from "@/lib/cron";
import { releaseExpiredHolds } from "@/lib/booking";
import { advanceRunningImports } from "@/lib/imports";
import { recheckPendingCustomDomains } from "@/lib/domains";
import { recheckPendingDomains } from "@/lib/sending-domains";
import { processBroadcasts } from "@/lib/broadcasts";

export const maxDuration = 300;

/** Every 15 minutes (vercel.json): short, chunked work. */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const results = await runJobs("frequent", {
    releaseExpiredBookingHolds: releaseExpiredHolds,
    advanceImports: advanceRunningImports,
    recheckCustomDomains: recheckPendingCustomDomains,
    recheckSendingDomains: recheckPendingDomains,
    sendBroadcasts: processBroadcasts,
  });
  return NextResponse.json(results);
}
