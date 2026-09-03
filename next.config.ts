import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  // Do not emit the generated agent instruction files into the project root.
  agentRules: false,
};

export default nextConfig;
