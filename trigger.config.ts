import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Project ref from the Trigger.dev dashboard (Project settings). Not secret.
  project: "proj_glkyuruvgwugfznpnrxd",
  runtime: "node-22",
  // Required by current SDK; extraction + LLM calls can take a few minutes.
  maxDuration: 300,
  dirs: ["./src/trigger"],
  retries: {
    // Let retries run in the local `trigger.dev dev` CLI too, so we can
    // observe backoff behaviour during the smoke test.
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    // Optional AgentMail peer used only for x402 payments; not needed for inbox replies.
    external: ["@x402/fetch"],
  },
});
