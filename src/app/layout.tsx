import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import { APP_NAME, appUrl } from "@/lib/env";
import "./globals.css";

// Design system type pairing (design handoff): DM Sans for body/UI,
// Newsreader (serif, with italic) for display headings, prices and logo wordmark.
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], display: "swap", style: ["normal", "italic"] });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#3a6152" };

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: `${APP_NAME}: client galleries, proofing and payments for photographers`, template: `%s | ${APP_NAME}` },
  description: `${APP_NAME} gives photographers branded client galleries, favorites and notes that sync back into Lightroom, deposits and e-signed agreements, and a simple client CRM. No commission on payments.`,
  openGraph: { type: "website", siteName: APP_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
