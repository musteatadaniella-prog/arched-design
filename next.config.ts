import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Business card photos / PDFs (max 4 MB) are sent through server actions.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
