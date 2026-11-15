import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // pin the project root (a stray lockfile in a parent folder confuses inference)
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
