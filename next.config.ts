import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["node-pptx-parser", "unzipper"],
};

export default nextConfig;
