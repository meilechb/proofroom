import { describe, expect, it } from "vitest";
import { agreementToPlainText, DEFAULT_AGREEMENT_MD, renderAgreement, unknownAgreementVariables } from "@/lib/agreements";

describe("agreements", () => {
  it("renders variables and leaves unknown ones visible", () => {
    const out = renderAgreement("Hi {{client_name}}, fee {{ price }} {{nope}}", { client_name: "Sam", price: "$250" });
    expect(out).toBe("Hi Sam, fee $250 {{nope}}");
  });

  it("the default template uses only known variables", () => {
    expect(unknownAgreementVariables(DEFAULT_AGREEMENT_MD)).toEqual([]);
    expect(unknownAgreementVariables("{{studio_name}} {{typo_here}}")).toEqual(["typo_here"]);
  });

  it("converts headings for the plain text copy", () => {
    expect(agreementToPlainText("## Parties\n\nText **bold**")).toBe("PARTIES\n\nText bold");
  });
});
