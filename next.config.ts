import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // agentmail dynamically imports the optional peer @x402/fetch; keep it
  // external so the bundler doesn't try to statically resolve that import.
  serverExternalPackages: ["agentmail"],
};

export default nextConfig;
