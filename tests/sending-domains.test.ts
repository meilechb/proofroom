import { describe, expect, it } from "vitest";
import { dmarcSuggestion, dnsRows, domainProblem, mapStatus } from "@/lib/sending-domains";

describe("sending domains", () => {
  it("maps Resend statuses onto our five states", () => {
    expect(mapStatus("verified")).toBe("verified");
    expect(mapStatus("partially_verified")).toBe("verified");
    expect(mapStatus("pending")).toBe("pending");
    expect(mapStatus("partially_failed")).toBe("pending");
    expect(mapStatus("failed")).toBe("failed");
    expect(mapStatus("temporary_failure")).toBe("temporary_failure");
    expect(mapStatus("not_started")).toBe("not_started");
    expect(mapStatus("something_new")).toBe("not_started");
  });

  it("validates domains", () => {
    expect(domainProblem("mail.acmestudio.com")).toBeNull();
    expect(domainProblem("Mail.Acme-Studio.co.uk ")).toBeNull();
    expect(domainProblem("gmail.com")).toMatch(/public mail provider/);
    expect(domainProblem("not a domain")).toMatch(/Enter a domain/);
    expect(domainProblem("acme")).toMatch(/Enter a domain/);
  });

  it("formats DNS rows and the DMARC suggestion", () => {
    const rows = dnsRows([
      { record: "SPF", name: "send", type: "MX", ttl: "Auto", status: "not_started", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10 },
      { record: "DKIM", name: "resend._domainkey", type: "TXT", ttl: "Auto", status: "not_started", value: "p=MIGf..." },
    ]);
    expect(rows[0]).toEqual({ purpose: "SPF", host: "send", type: "MX", value: "10 feedback-smtp.us-east-1.amazonses.com", ttl: "Auto", status: "not_started" });
    expect(rows[1].value).toBe("p=MIGf...");
    expect(dmarcSuggestion("mail.acmestudio.com", "dmarc@acmestudio.com")).toEqual({ host: "_dmarc.acmestudio.com", type: "TXT", value: "v=DMARC1; p=none; rua=mailto:dmarc@acmestudio.com;" });
  });
});
