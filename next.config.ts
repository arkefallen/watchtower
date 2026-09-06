process.env.NEXT_TELEMETRY_DISABLED ??= "1";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
