import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "standalone", // Required for Docker deployment
  serverExternalPackages: ["node-pptx-parser", "unzipper"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    // Increase body size limit for file uploads to 25MB (slightly above the 20MB app limit)
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
