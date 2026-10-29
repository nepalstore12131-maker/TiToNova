import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
