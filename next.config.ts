import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admin home is the survey list; signed-out visitors are sent on to /login from there.
  async redirects() {
    return [{ source: "/", destination: "/surveys", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page may be framed by another site, so buttons like Delete can't be clickjacked.
          // ponytail: relax for /s/:path* if embedding survey forms on other sites becomes a feature.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Survey and admin URLs never leak to other sites through the Referer header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
