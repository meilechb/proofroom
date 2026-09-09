/**
 * Copy and data for /compare/* (plan 8.12). Every figure comes from
 * docs/MARKET-RESEARCH.md (repo root); `lastChecked` is the month the vendor
 * pages were read. Keep the wording factual: these pages name real companies.
 */

export type CompareRow = { label: string; us: string; them: string };

export type ComparePage = {
  slug: string;
  vendor: string;
  metaTitle: string;
  description: string;
  lead: string;
  lastChecked: string;
  pricing: CompareRow[];
  features: CompareRow[];
  lightroom: CompareRow[];
  betterFit: string[];
  faq: Array<{ q: string; a: string }>;
  sources: Array<{ label: string; url: string }>;
};

import { APP_NAME } from "@/lib/env";

const US = APP_NAME;


export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "pixieset",
    vendor: "Pixieset",
    metaTitle: `${US} vs Pixieset`,
    description: "Pixieset sells galleries, a website builder and a separate Studio Manager. Compare pricing, commission, contracts and what its Lightroom plugin sends back.",
    lead: "Pixieset is the most widely used client-gallery tool. It splits galleries, website and studio management into separate products, and its Lightroom plugin publishes but does not bring favorites back.",
    lastChecked: "September 2026",
    pricing: [
      { label: "Unlimited-storage gallery plan", us: "$40 a month, everything included", them: "$40 a month (Ultimate)" },
      { label: "Entry paid plan", us: "One plan only", them: "$8 a month for 10 GB" },
      { label: "Free tier", us: "14-day trial, no card", them: "3 GB with a 15% commission on sales" },
      { label: "Commission on sales", us: "0%, always", them: "15% on the free plan, 0% on paid plans" },
      { label: "Studio management / CRM", us: "Included", them: "Separate Studio Manager: free, $12 or $18 a month; Suite bundles $28 to $55" },
      { label: "Where client money goes", us: "Your own Stripe account", them: "Through Pixieset's payment processing" },
    ],
    features: [
      { label: "Per-photo client notes", us: "Yes, on any photo", them: "Notes on favorites" },
      { label: "Selection limit (pick N)", us: "Yes, per package", them: "Yes" },
      { label: "N included, extras added to the balance", us: "Yes, automatic", them: "Not native; extras sell through the print store cart" },
      { label: "Downloads locked until the balance is paid", us: "Yes", them: "Not documented" },
      { label: "Contracts with e-signature", us: "Included", them: "3 free, unlimited on paid Studio Manager" },
      { label: "Deposit now, balance later", us: "Included", them: "Studio Manager Pro" },
      { label: "Website", us: "Two templates, own domain, included", them: "Website builder, included on gallery plans" },
      { label: "Team headshot day mode", us: "Per-person galleries, coordinator view", them: "Not offered" },
    ],
    lightroom: [
      { label: "Publish Service", us: "Yes", them: "Yes" },
      { label: "Republish replaces in place", us: "Yes, keeps notes", them: "Yes" },
      { label: "Client favorites back into Lightroom", us: "Yes, as a flag and keyword", them: "No. A copy list of filenames to paste into Library search" },
      { label: "Client notes back into Lightroom", us: "Yes, as keywords", them: "No" },
    ],
    betterFit: [
      "You sell prints and products through an integrated print lab. Pixieset's store connects to labs; we sell line items into your Stripe instead.",
      "You want a free tier for occasional use and accept a 15% commission on sales.",
      "You need a large template library for the website. We offer two.",
    ],
    faq: [
      { q: "Can I move my galleries from Pixieset?", a: "Yes. The importer reads a Pixieset client export and re-uploads gallery photos from your own files. Client emails, session dates and gallery names come across." },
      { q: "Does Pixieset take a commission?", a: "On the free plan, 15% of sales. Paid plans are 0%. Payments run through Pixieset's processing rather than your own Stripe account." },
    ],
    sources: [
      { label: "Pixieset pricing", url: "https://pixieset.com/pricing/" },
      { label: "Pixieset Studio Manager pricing", url: "https://pixieset.com/pricing-studio-manager/" },
      { label: "Pixieset Lightroom plugin help", url: "https://help.pixieset.com/hc/en-us/articles/115003505192" },
    ],
  },
  {
    slug: "pic-time",
    vendor: "Pic-Time",
    metaTitle: `${US} vs Pic-Time`,
    description: "Pic-Time pairs galleries with a print store and marketing automation, and keeps 6% to 15% of markup. Compare pricing, commission, contracts and Lightroom sync.",
    lead: "Pic-Time is strong on print sales and marketing automation. It charges a share of your markup on every plan, has no contracts, and its Lightroom favorites sync is limited to paid plans and its older galleries.",
    lastChecked: "September 2026",
    pricing: [
      { label: "Unlimited-storage gallery plan", us: "$40 a month, everything included", them: "$42 a month" },
      { label: "Entry paid plan", us: "One plan only", them: "$7 a month for 20 GB" },
      { label: "Free tier", us: "14-day trial, no card", them: "10 GB, drops to 3 GB after 6 months" },
      { label: "Commission on sales", us: "0%, always", them: "6% to 15% of markup depending on plan" },
      { label: "Studio management / CRM", us: "Included", them: "Not offered; reviewers ask for client management" },
      { label: "Where client money goes", us: "Your own Stripe account", them: "Through Pic-Time" },
    ],
    features: [
      { label: "Per-photo client notes", us: "Yes, on any photo", them: "No" },
      { label: "Selection limit (pick N)", us: "Yes, per package", them: "Yes" },
      { label: "N included, extras added to the balance", us: "Yes, automatic", them: "Yes, through its Simple Sales System" },
      { label: "Downloads locked until the balance is paid", us: "Yes", them: "Not documented" },
      { label: "Contracts with e-signature", us: "Included", them: "Not offered" },
      { label: "Deposit now, balance later", us: "Included", them: "Not offered" },
      { label: "Galleries kept after a missed payment", us: "30-day grace, then read-only; 90-day retention", them: "Reviews in 2026 report galleries removed after inactivity or late payment" },
      { label: "Team headshot day mode", us: "Per-person galleries, coordinator view", them: "Not offered" },
    ],
    lightroom: [
      { label: "Publish Service", us: "Yes", them: "Yes" },
      { label: "Republish replaces in place", us: "Yes, keeps notes", them: "Yes" },
      { label: "Client favorites back into Lightroom", us: "Yes, as a flag and keyword", them: "Yes, as collections under a Selections folder. Paid plans only; not available on the new 2.0 galleries" },
      { label: "Client notes back into Lightroom", us: "Yes, as keywords", them: "No" },
    ],
    betterFit: [
      "Print sales are a large part of your revenue and you want automated store marketing (holiday campaigns, abandoned carts).",
      "You want a print lab fulfilment network connected to the gallery.",
    ],
    faq: [
      { q: "Can I move my galleries from Pic-Time?", a: "Yes. The importer reads a Pic-Time client export; photos are re-uploaded from your own files or from Lightroom." },
      { q: "What does 6% to 15% of markup mean?", a: "Pic-Time keeps that share of the difference between the lab cost and your selling price, on top of the subscription. We keep nothing." },
    ],
    sources: [
      { label: "Pic-Time pricing", url: "https://www.pic-time.com/pricing" },
      { label: "Pic-Time Lightroom plugin help", url: "https://help.pic-time.com/en/articles/7834728" },
      { label: "Pic-Time reviews on Trustpilot", url: "https://www.trustpilot.com/review/pic-time.com" },
    ],
  },
  {
    slug: "shootproof",
    vendor: "ShootProof",
    metaTitle: `${US} vs ShootProof`,
    description: "ShootProof combines galleries, contracts and invoices with 0% commission. Compare pricing, per-photo notes, connected workflow and Lightroom sync.",
    lead: "ShootProof has never charged commission and includes contracts and invoices on every plan. Its gallery notes are limited to cart items, and favorites do not come back into Lightroom.",
    lastChecked: "September 2026",
    pricing: [
      { label: "Unlimited-storage gallery plan", us: "$40 a month, everything included", them: "$50 a month" },
      { label: "Entry paid plan", us: "One plan only", them: "$10.99 a month" },
      { label: "Free tier", us: "14-day trial, no card", them: "100 photos (3 GB from September 23, 2026)" },
      { label: "Commission on sales", us: "0%, always", them: "0%, always" },
      { label: "Studio management / CRM", us: "Included: inbox, clients, sessions, tasks, calendar", them: "Contracts and invoices; reviewers say gallery, contract and invoice do not all connect" },
      { label: "Where client money goes", us: "Your own Stripe account", them: "Through ShootProof's processing options" },
    ],
    features: [
      { label: "Per-photo client notes", us: "Yes, on any photo", them: "Cart items only" },
      { label: "Selection limit (pick N)", us: "Yes, per package", them: "Yes" },
      { label: "N included, extras added to the balance", us: "Yes, automatic", them: "Not native; extras sell through the store" },
      { label: "Downloads locked until the balance is paid", us: "Yes", them: "Not documented" },
      { label: "Contracts with e-signature", us: "Included", them: "All plans" },
      { label: "Deposit now, balance later", us: "Included", them: "Yes, through invoices" },
      { label: "Website", us: "Two templates, own domain, included", them: "Not offered" },
      { label: "Team headshot day mode", us: "Per-person galleries, coordinator view", them: "Not offered" },
    ],
    lightroom: [
      { label: "Publish Service", us: "Yes", them: "Yes, labeled third-party" },
      { label: "Republish replaces in place", us: "Yes, keeps notes", them: "Yes, by filename" },
      { label: "Client favorites back into Lightroom", us: "Yes, as a flag and keyword", them: "No. Copy filenames from Gallery Visitors; ShootProof's blog puts this at about an hour per 300 to 600 photo job" },
      { label: "Client notes back into Lightroom", us: "Yes, as keywords", them: "No" },
    ],
    betterFit: [
      "You rely on integrated print lab fulfilment and a mature store.",
      "You want a long track record: ShootProof has been at 0% commission since it started.",
    ],
    faq: [
      { q: "Can I move my galleries from ShootProof?", a: "Yes. The importer reads a ShootProof contacts export and orders CSV. Photos are re-uploaded from your own files." },
      { q: "Is ShootProof changing its plans?", a: "ShootProof moves to GB-based plans on September 23, 2026 at the same prices, per its help center." },
    ],
    sources: [
      { label: "ShootProof pricing", url: "https://www.shootproof.com/pricing" },
      { label: "ShootProof plan change notice", url: "https://help.shootproof.com/hc/en-us/articles/42846503437591" },
      { label: "ShootProof Lightroom plugin help", url: "https://help.shootproof.com/hc/en-us/articles/115009451587" },
      { label: "ShootProof blog on favorites in Lightroom", url: "https://www.shootproof.com/blog/shootproof-favorites-lightroom/" },
    ],
  },
  {
    slug: "cloudspot",
    vendor: "CloudSpot",
    metaTitle: `${US} vs CloudSpot`,
    description: "CloudSpot bundles galleries with a CRM from its $17 plan. Compare pricing, commission, per-photo notes, contracts and Lightroom sync.",
    lead: "CloudSpot is one of the few gallery tools that includes a CRM. Its free tier carries a 15% commission, its Lightroom plugin is one-way, and clients cannot leave notes on photos.",
    lastChecked: "September 2026",
    pricing: [
      { label: "Unlimited-storage gallery plan", us: "$40 a month, everything included", them: "$50 a month" },
      { label: "Entry paid plan", us: "One plan only", them: "$7 a month for 15 GB (Lite)" },
      { label: "Free tier", us: "14-day trial, no card", them: "5 GB, 3 galleries, 15% commission" },
      { label: "Commission on sales", us: "0%, always", them: "15% on free, 0% from Lite" },
      { label: "Studio management / CRM", us: "Included", them: "Included from the $17 plan" },
      { label: "Where client money goes", us: "Your own Stripe account", them: "Through CloudSpot" },
    ],
    features: [
      { label: "Per-photo client notes", us: "Yes, on any photo", them: "No" },
      { label: "Selection limit (pick N)", us: "Yes, per package", them: "Unverified" },
      { label: "N included, extras added to the balance", us: "Yes, automatic", them: "Not native" },
      { label: "Downloads locked until the balance is paid", us: "Yes", them: "Not documented" },
      { label: "Contracts with e-signature", us: "Included", them: "Lite and up" },
      { label: "Deposit now, balance later", us: "Included", them: "Payment schedules" },
      { label: "Website", us: "Two templates, own domain, included", them: "Not offered" },
      { label: "Team headshot day mode", us: "Per-person galleries, coordinator view", them: "Not offered" },
    ],
    lightroom: [
      { label: "Publish Service", us: "Yes", them: "Yes" },
      { label: "Republish replaces in place", us: "Yes, keeps notes", them: "Undocumented" },
      { label: "Client favorites back into Lightroom", us: "Yes, as a flag and keyword", them: "No. Described as one-way sync; copy filenames" },
      { label: "Client notes back into Lightroom", us: "Yes, as keywords", them: "No" },
    ],
    betterFit: [
      "You want a free plan for a handful of galleries and accept the 15% commission.",
      "You sell prints through an integrated lab store.",
    ],
    faq: [
      { q: "Can I move from CloudSpot?", a: "Yes. The importer reads a CloudSpot contacts export; photos are re-uploaded from your own files." },
    ],
    sources: [
      { label: "CloudSpot pricing", url: "https://www.cloudspot.io/pricing" },
      { label: "CloudSpot Lightroom plugin help", url: "https://help.cloudspot.io/en/articles/114552" },
    ],
  },
  {
    slug: "honeybook",
    vendor: "HoneyBook",
    metaTitle: `${US} vs HoneyBook`,
    description: "HoneyBook is a general small-business CRM that added photo galleries in 2026 and processes payments itself for 2.7% plus 10 cents. Compare pricing, galleries and Lightroom.",
    lead: "HoneyBook is a strong general CRM with contracts, proposals and scheduling for any service business. Payments run through HoneyBook at 2.7% plus 10 cents, galleries arrived in July 2026, and there is no Lightroom plugin.",
    lastChecked: "September 2026",
    pricing: [
      { label: "Monthly price", us: "$40 a month, everything included", them: "$29, $49 or $109 a month on annual billing" },
      { label: "Card fees", us: "Stripe's standard fee, paid to Stripe on your own account", them: "2.7% plus 10 cents processed by HoneyBook" },
      { label: "Free tier", us: "14-day trial, no card", them: "Trial" },
      { label: "Gallery storage", us: "No cap", them: "200 GB on the $29 Starter plan" },
      { label: "Seats", us: "Unlimited", them: "Varies by plan" },
      { label: "Where client money goes", us: "Your own Stripe account", them: "HoneyBook's payment processing, paid out to you" },
    ],
    features: [
      { label: "Per-photo client notes", us: "Yes, on any photo", them: "Unverified" },
      { label: "Selection limit (pick N)", us: "Yes, per package", them: "Not documented" },
      { label: "N included, extras added to the balance", us: "Yes, automatic", them: "Not documented" },
      { label: "Downloads locked until the balance is paid", us: "Yes", them: "Not documented" },
      { label: "Contracts with e-signature", us: "Included", them: "Yes" },
      { label: "Deposit now, balance later", us: "Included", them: "Yes" },
      { label: "Client galleries", us: "Included, built for proofing", them: "Since July 2026: favorites and downloads" },
      { label: "Website", us: "Two templates, own domain, included", them: "Not offered" },
      { label: "Built for photographers", us: "Yes, only", them: "General service businesses" },
    ],
    lightroom: [
      { label: "Publish Service", us: "Yes", them: "No plugin" },
      { label: "Client favorites back into Lightroom", us: "Yes, as a flag and keyword", them: "No" },
      { label: "Client notes back into Lightroom", us: "Yes, as keywords", them: "No" },
    ],
    betterFit: [
      "You run a business that is not mainly photography, or you sell proposals and packages across several service types.",
      "You want HoneyBook's scheduler, proposal builder and lead forms and do not need a Lightroom workflow.",
    ],
    faq: [
      { q: "Can I use both?", a: `Some studios keep HoneyBook for proposals and use ${US} for galleries and payments. The gallery links work anywhere.` },
      { q: "Can I move from HoneyBook?", a: "Yes. Export your contacts as CSV and import them; the guided importer maps the columns." },
    ],
    sources: [
      { label: "HoneyBook pricing", url: "https://www.honeybook.com/pricing" },
      { label: "HoneyBook galleries help", url: "https://help.honeybook.com/en/articles/15714707-create-and-share-photo-galleries-in-honeybook" },
    ],
  },
];

export function comparePage(slug: string) {
  return COMPARE_PAGES.find((c) => c.slug === slug) ?? null;
}
