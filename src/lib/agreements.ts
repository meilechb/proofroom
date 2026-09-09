/**
 * Per-studio agreement templates. The studio edits Markdown with {{variables}};
 * every order stores the template version it was signed under. The default
 * below carries the same terms as the original single-studio contract.
 */

export const AGREEMENT_VARIABLES = [
  "studio_name", "studio_email", "client_name", "session_title", "session_date",
  "price", "deposit", "balance", "included_finals", "extra_final_price", "retention_days",
] as const;

export type AgreementVariable = (typeof AGREEMENT_VARIABLES)[number];
export type AgreementVars = Record<AgreementVariable, string>;

export const DEFAULT_AGREEMENT_MD = `## Parties

This agreement is between {{studio_name}} ("Photographer") and {{client_name}} ("Client") for the session "{{session_title}}" on {{session_date}}.

## Fee and payment

The session fee is {{price}}. A retainer of {{deposit}} is due to reserve the date. The remaining balance of {{balance}} is due when the final images are delivered, and may be paid at any time before that.

The price includes {{included_finals}} final retouched images. Each additional image chosen is {{extra_final_price}} and is added to the balance.

Final images are released for download once the balance is paid in full.

## Rescheduling and cancellation

The retainer reserves the date and is non-refundable. The Client may reschedule once at no charge with at least 48 hours notice, and the retainer carries over to the new date within 90 days.

If the Client cancels or does not attend, the retainer is kept. If the Photographer must cancel because of illness, emergency or equipment failure, the Photographer will offer a new date or refund every amount paid, which is the full extent of the Photographer's liability.

## The session

The Client agrees to arrive on time. Time lost to a late arrival comes out of the session and is not made up or refunded.

For on-location sessions the Client provides a suitable space with access to a power outlet.

## Proofs, selection and delivery

Lightly edited proofs are posted to a private online gallery. The Client marks the images to be retouched.

Retouched final images are delivered to the online gallery. Retouching covers skin, stray hairs, blemishes and minor clothing fixes. Requests beyond that are quoted separately.

Unedited original files are not delivered. Files stay online for {{retention_days}} days after delivery; the Client is responsible for downloading and backing them up.

## Copyright and use

The Photographer owns the copyright in all images. The Client receives a licence to use the final images for personal and business purposes, including websites, social media, print and press, without time limit.

The Client may not sell the images, enter them in competitions, or apply filters or edits that change the retouching, without written permission.

The Photographer may show the final images in a portfolio, on social media and in marketing unless the Client opts out when signing.

## Liability

The Photographer takes reasonable care with all files and keeps backups until delivery. If files are lost through no fault of the Client before delivery, the Photographer will re-shoot at no charge or refund every amount paid, whichever the Client prefers, and this is the full extent of the Photographer's liability.

Questions about this agreement can be sent to {{studio_email}}.
`;

/** Replaces {{variables}}; unknown names are left visible so a typo is noticed in preview. */
export function renderAgreement(markdown: string, vars: Partial<AgreementVars>) {
  return markdown.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, name: string) =>
    name in vars && vars[name as AgreementVariable] !== undefined ? String(vars[name as AgreementVariable]) : whole
  );
}

/** Names used in a template that are not real variables (for editor warnings). */
export function unknownAgreementVariables(markdown: string) {
  const found = new Set<string>();
  for (const m of markdown.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
    if (!(AGREEMENT_VARIABLES as readonly string[]).includes(m[1])) found.add(m[1]);
  }
  return [...found];
}

/** Plain text version for the signed copy stored with the order and for emails. */
export function agreementToPlainText(markdown: string) {
  return markdown
    .replace(/^##\s+(.*)$/gm, (_, h: string) => h.toUpperCase())
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}
