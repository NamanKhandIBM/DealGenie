import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" removed — only needed for Docker/Render.
  // Vercel handles Next.js natively without standalone mode.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
