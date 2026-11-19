import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admin home is the survey list; signed-out visitors are sent on to /login from there.
  async redirects() {
    return [{ source: "/", destination: "/surveys", permanent: false }];
  },
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
