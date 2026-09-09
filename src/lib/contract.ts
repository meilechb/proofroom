import { formatMoney } from "@/lib/types";

/** Bump when the wording changes; the version is stored with every signature. */
export const CONTRACT_VERSION = "2026-09-pr1";

export type ContractSection = { heading: string; body: string[] };

export type ContractInput = {
  studioLegalName: string;
  studioEmail: string;
  clientName: string;
  title: string;
  shootDate: string | null;
  priceCents: number;
  depositCents: number;
  includedFinals: number;
  extraFinalCents: number;
  currency?: string;
  /** Days files stay online after delivery. */
  retentionDays?: number;
};

function longDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * Photography services agreement built from terms that are standard in
 * portrait and headshot contracts: retainer, balance, rescheduling,
 * cancellation, delivery, copyright and usage, liability.
 */
export function contractSections(input: ContractInput): ContractSection[] {
  const cur = input.currency ?? "usd";
  const price = formatMoney(input.priceCents, cur);
  const deposit = formatMoney(input.depositCents, cur);
  const balance = formatMoney(Math.max(0, input.priceCents - input.depositCents), cur);
  const when = input.shootDate ? longDate(input.shootDate) : "a date agreed in writing";
  const retention = input.retentionDays ?? 90;
  const extras =
    input.includedFinals > 0 && input.extraFinalCents > 0
      ? `The price includes ${input.includedFinals} final retouched image${input.includedFinals === 1 ? "" : "s"}. Each additional image chosen is ${formatMoney(input.extraFinalCents, cur)} and is added to the balance.`
      : "The number of final retouched images is stated in the session description.";

  return [
    {
      heading: "Parties",
      body: [
        `This agreement is between ${input.studioLegalName} ("Photographer") and ${input.clientName} ("Client") for the session "${input.title}" on ${when}.`,
      ],
    },
    {
      heading: "Fee and payment",
      body: [
        input.depositCents > 0
          ? `The session fee is ${price}. A retainer of ${deposit} is due to reserve the date. The remaining balance of ${balance} is due when the final images are delivered, and may be paid at any time before that.`
          : `The session fee is ${price} and is due before the final images are released.`,
        extras,
        "Final images are released for download once the balance is paid in full.",
      ],
    },
    {
      heading: "Rescheduling and cancellation",
      body: [
        "The retainer reserves the date and is non-refundable. The Client may reschedule once at no charge with at least 48 hours notice, and the retainer carries over to the new date within 90 days.",
        "If the Client cancels or does not attend, the retainer is kept. If the Photographer must cancel because of illness, emergency or equipment failure, the Photographer will offer a new date or refund every amount paid, which is the full extent of the Photographer's liability.",
      ],
    },
    {
      heading: "The session",
      body: [
        "The Client agrees to arrive on time. Time lost to a late arrival comes out of the session and is not made up or refunded.",
        "For on-location sessions the Client provides a suitable space with access to a power outlet.",
      ],
    },
    {
      heading: "Proofs, selection and delivery",
      body: [
        "Lightly edited proofs are posted to a private online gallery. The Client marks the images to be retouched.",
        "Retouched final images are delivered to the online gallery. Retouching covers skin, stray hairs, blemishes and minor clothing fixes. Requests beyond that are quoted separately.",
        `Unedited original files are not delivered. Files stay online for ${retention} days after delivery; the Client is responsible for downloading and backing them up.`,
      ],
    },
    {
      heading: "Copyright and use",
      body: [
        "The Photographer owns the copyright in all images. The Client receives a licence to use the final images for personal and business purposes, including websites, social media, print and press, without time limit.",
        "The Client may not sell the images, enter them in competitions, or apply filters or edits that change the retouching, without written permission.",
        "The Photographer may show the final images in a portfolio, on social media and in marketing unless the Client opts out below.",
      ],
    },
    {
      heading: "Liability",
      body: [
        "The Photographer takes reasonable care with all files and keeps backups until delivery. If files are lost through no fault of the Client before delivery, the Photographer will re-shoot at no charge or refund every amount paid, whichever the Client prefers, and this is the full extent of the Photographer's liability.",
        `Questions about this agreement can be sent to ${input.studioEmail}.`,
      ],
    },
  ];
}

export function formatAgreementText(sections: ContractSection[]) {
  return sections.map((s) => [s.heading.toUpperCase(), ...s.body].join("\n")).join("\n\n");
}
