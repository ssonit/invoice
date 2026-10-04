import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { ADMIN_CREDENTIALS, appCommand, EMAIL_KEYS_OFF } from "./tests/support/app-command";

export default {
  targets: [
    {
      name: "email-off",
      engine: web({ browser: "chromium" }),
      app: {
        url: "http://127.0.0.1:0",
        command: appCommand(EMAIL_KEYS_OFF),
        readyUrl: "http://127.0.0.1:{port}/login",
      },
    },
  ],
  tests: ["tests/email-off/**/*.e2e.ts", "tests/auth.setup.e2e.ts"],
  credentials: ADMIN_CREDENTIALS,
  retries: 0,
  workers: 1,
  output: ".e2e/email-off",
  reporters: ["list", "markdown"],
} satisfies E2EConfig;
