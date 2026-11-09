import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Business card photos / PDFs (max 4 MB) are sent through server actions.
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Invoice PDFs embed these fonts; read from disk at runtime, so ship them
  // with the serverless functions on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/*.ttf"],
  },
};

export default nextConfig;
