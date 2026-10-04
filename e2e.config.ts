import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { ADMIN_CREDENTIALS, appCommand } from "./tests/support/app-command";

export default {
  targets: [
    {
      name: "email-on",
      engine: web({ browser: "chromium" }),
      app: {
        url: "http://127.0.0.1:0",
        command: appCommand(),
        readyUrl: "http://127.0.0.1:{port}/login",
      },
    },
  ],
  tests: ["tests/**/*.e2e.ts", "!tests/email-off/**"],
  credentials: ADMIN_CREDENTIALS,
  retries: 0,
  workers: 1,
  trace: "on-first-retry",
  video: "retain-on-failure",
  reporters: ["list", "markdown"],
} satisfies E2EConfig;
