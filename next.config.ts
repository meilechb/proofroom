import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in saas/ inside a repo that has its own lockfile at the root.
  // Pin the Turbopack root so module and PostCSS resolution stay inside saas/.
  turbopack: { root: path.join(__dirname) },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  // Server Actions compare Origin to Host. Tenant galleries are served on
  // studio subdomains and custom domains, so list the wildcard app domain.
  experimental: {
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000",
        `*.${process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000"}`,
      ],
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
