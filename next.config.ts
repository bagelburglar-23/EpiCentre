import type { NextConfig } from "next";

// Tailscale Serve proxies /preview/* to this instance without stripping the
// prefix, so the preview build must know its own base path. Production
// stays at "/" - this only changes anything when DEPLOY_ENV=preview.
const basePath = process.env.DEPLOY_ENV === "preview" ? "/preview" : "";

const nextConfig: NextConfig = {
  /* config options here */
  basePath,
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
