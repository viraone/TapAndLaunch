import type { NextConfig } from "next";

// Optional, for trying the local site on a phone over Wi-Fi (see `npm run dev:phone`).
const devOrigins = process.env.DEV_ORIGINS?.split(",").filter(Boolean);

const nextConfig: NextConfig = {
  ...(devOrigins?.length ? { allowedDevOrigins: devOrigins } : {}),
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
