// Both configs start the SAME production build on a free port; only env differs.
// `next start` (not `next dev`) so two instances don't fight over the .next/dev lock.
// Run through `node` directly: the runner spawns without a shell, so `npx` (a .cmd on
// Windows) would not resolve.
export function appCommand(env: Record<string, string> = {}) {
  return {
    executable: "node",
    args: ["node_modules/next/dist/bin/next", "start", "-p", "{port}"],
    env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...env },
  };
}

export const EMAIL_KEYS_OFF = {
  AGENTMAIL_API_KEY: "",
  AGENTMAIL_WEBHOOK_SECRET: "",
  TRIGGER_SECRET_KEY: "",
};

// Fallbacks are the local-dev-only seed user from supabase/seed.sql.
export const ADMIN_CREDENTIALS = {
  admin: {
    username: process.env.E2E_USER_ADMIN_USERNAME ?? "admin@local.test",
    password: process.env.E2E_USER_ADMIN_PASSWORD ?? "admin12345",
  },
};
