process.env.NEXT_TELEMETRY_DISABLED ??= "1";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true
};

export default nextConfig;
