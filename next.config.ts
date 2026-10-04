import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // agentmail dynamically imports the optional peer @x402/fetch; keep it
  // external so the bundler doesn't try to statically resolve that import.
  serverExternalPackages: ["agentmail", "@firecrawl/pdf-inspector"],

  turbopack: {
    root: projectRoot,
  },

  // Baseline hardening headers. Deliberately not a full Content-Security-Policy —
  // this app pulls from enough third-party origins (Supabase, AgentMail,
  // LLM providers) that a CSP needs its own dedicated audit rather than a guess here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
