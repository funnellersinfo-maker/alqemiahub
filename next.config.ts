import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Permitir que el sandbox/preview sirva los assets de dev cross-origin
  allowedDevOrigins: ["*.space-z.ai", "localhost", "127.0.0.1"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
