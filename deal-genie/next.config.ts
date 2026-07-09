import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Dockerfile Stage 3: copies a minimal self-contained server
  // into .next/standalone so the image doesn't need the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
