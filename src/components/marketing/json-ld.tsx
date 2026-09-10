import { APP_NAME, appUrl, supportEmail } from "@/lib/env";
import { PLANS, PRO_SEAT_CENTS, TRIAL_DAYS } from "@/lib/plans";

/** Organization and SoftwareApplication structured data for the marketing site (plan 8.20). */
export function MarketingJsonLd() {
  const base = appUrl();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: base,
    logo: `${base}/opengraph-image`,
    email: supportEmail(),
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: supportEmail(), url: `${base}/contact` }],
  };
  const application = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    url: base,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Lightroom Classic plugin for macOS and Windows",
    description: "Client galleries, a two-way Lightroom Classic plugin, a website, CRM and email for photographers. Payments go to the studio's own Stripe account with no commission.",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", category: "subscription", description: "Free plan: 1 user, client galleries, proofing and payments into your own Stripe.", url: `${base}/pricing` },
      { "@type": "Offer", name: "Pro", price: (PRO_SEAT_CENTS / 100).toFixed(2), priceCurrency: "USD", category: "subscription", description: `Pro plan, $${(PRO_SEAT_CENTS / 100).toFixed(0)} per seat per month. ${TRIAL_DAYS}-day free trial of Pro.`, url: `${base}/pricing` },
    ],
    featureList: PLANS.pro.highlights,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(application) }} />
    </>
  );
}
