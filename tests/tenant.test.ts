import { describe, expect, it } from "vitest";
import { areaUrl, bookingUrl, classifyHost, clientHubUrl, galleryUrl, payUrl, studioBaseUrl, tenantPath } from "@/lib/tenant";

const ROOT = "example.com";

describe("classifyHost", () => {
  it("treats the root domain, www, localhost and loopback as root", () => {
    expect(classifyHost("example.com", ROOT)).toEqual({ kind: "root" });
    expect(classifyHost("www.example.com", ROOT)).toEqual({ kind: "root" });
    expect(classifyHost("localhost:3000", ROOT)).toEqual({ kind: "root" });
    expect(classifyHost("127.0.0.1:3000", ROOT)).toEqual({ kind: "root" });
    expect(classifyHost(null, ROOT)).toEqual({ kind: "root" });
  });

  it("extracts the studio slug from a subdomain, ignoring port and case", () => {
    expect(classifyHost("Acme.Example.com:443", ROOT)).toEqual({ kind: "subdomain", slug: "acme" });
    expect(classifyHost("acme.example.com", "Example.com")).toEqual({ kind: "subdomain", slug: "acme" });
  });

  it("does not treat www or nested subdomains as studios", () => {
    expect(classifyHost("www.example.com", ROOT)).toEqual({ kind: "root" });
    expect(classifyHost("a.b.example.com", ROOT)).toEqual({ kind: "root" });
  });

  it("treats Vercel preview hosts as root", () => {
    expect(classifyHost("headshots-git-branch-team.vercel.app", ROOT)).toEqual({ kind: "root" });
  });

  it("treats any other host as a custom domain", () => {
    expect(classifyHost("photos.acmestudio.com", ROOT)).toEqual({ kind: "custom", host: "photos.acmestudio.com" });
  });

  it("works when the root domain itself carries a port", () => {
    expect(classifyHost("acme.localhost:3000", "localhost:3000")).toEqual({ kind: "subdomain", slug: "acme" });
  });
});

describe("studio URLs", () => {
  const verified = { slug: "acme", custom_domain: "photos.acme.com", custom_domain_verified_at: "2026-09-01T00:00:00Z" };
  const unverified = { slug: "acme", custom_domain: "photos.acme.com", custom_domain_verified_at: null };
  const plain = { slug: "acme", custom_domain: null, custom_domain_verified_at: null };

  it("prefers a verified custom domain", () => {
    expect(studioBaseUrl(verified)).toBe("https://photos.acme.com");
  });

  it("ignores an unverified custom domain", () => {
    // Default app domain in tests is localhost:3000, so the path form is used.
    expect(studioBaseUrl(unverified)).toBe("http://localhost:3000/t/acme");
    expect(studioBaseUrl(plain)).toBe("http://localhost:3000/t/acme");
  });

  it("builds the client-facing paths", () => {
    expect(galleryUrl(verified, "spring-proofs")).toBe("https://photos.acme.com/g/spring-proofs");
    expect(payUrl(verified, "order-1")).toBe("https://photos.acme.com/pay/order-1");
    expect(bookingUrl(verified)).toBe("https://photos.acme.com/book");
    expect(clientHubUrl(verified, "tok")).toBe("https://photos.acme.com/my/tok");
    expect(areaUrl(verified, "brooklyn")).toBe("https://photos.acme.com/headshots/brooklyn");
    expect(tenantPath("acme", "/g/x")).toBe("/t/acme/g/x");
  });
});
