import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/studio", "/admin", "/api", "/t/", "/login", "/signup", "/logout", "/verify-email", "/r/"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
