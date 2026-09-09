import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/env";
import { PLAN, formatPrice } from "@/lib/plans";

export const alt = `${APP_NAME}: cull in Lightroom, deliver in one click, get paid in your own Stripe`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Site-wide Open Graph image, generated at build time (plan 8.19). */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fafaf9", color: "#111111", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 600 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#111111", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{APP_NAME.charAt(0)}</div>
          {APP_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 68, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
          <div>Cull in Lightroom.</div>
          <div>Deliver in one click.</div>
          <div>Get paid in your own Stripe.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#4b4b4b" }}>
          <div>Galleries, website, CRM and email for photographers</div>
          <div>{`${formatPrice(PLAN.monthlyCents)}/month, 0% commission`}</div>
        </div>
      </div>
    ),
    size
  );
}
