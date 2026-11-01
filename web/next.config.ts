import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal server for the Docker image (only the files the app needs)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Game pictures come from BoardGameGeek's image server
    remotePatterns: [{ protocol: "https", hostname: "cf.geekdo-images.com", pathname: "/**" }],
  },
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
