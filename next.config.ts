import type { NextConfig } from "next";

// No basePath needed: confirmed by capturing the raw request Tailscale
// Serve forwards (see state/threads.md) that --set-path strips the mount
// prefix before proxying - the backend always receives plain "/", on both
// production and preview. An earlier version of this file assumed the
// opposite and was wrong; keeping this note so it doesn't get re-added.

const nextConfig: NextConfig = {
  /* config options here */
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
