import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cfo/catalog",
    "@cfo/content",
    "@cfo/db",
    "@cfo/domain",
    "@cfo/ui",
  ],
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
