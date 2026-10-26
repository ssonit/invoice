// Needed to receive and process forwarded email. Trigger.dev is optional: with
// TRIGGER_SECRET_KEY set the webhook queues background tasks; without it the
// webhook processes the email itself (see `isTriggerConfigured`).
export const EMAIL_INTAKE_ENV_KEYS = [
  "AGENTMAIL_API_KEY",
  "AGENTMAIL_WEBHOOK_SECRET",
] as const;

export type EmailIntakeEnvKey = (typeof EMAIL_INTAKE_ENV_KEYS)[number];
// Index signature (not Partial<Record<EmailIntakeEnvKey, …>>) so `process.env` is assignable.
export type EmailIntakeEnv = Readonly<Record<string, string | undefined>>;

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function missingEmailIntakeKeys(env: EmailIntakeEnv): EmailIntakeEnvKey[] {
  return EMAIL_INTAKE_ENV_KEYS.filter((key) => !isSet(env[key]));
}

/** True only when every key needed to receive forwarded email is set. */
export function isEmailIntakeConfigured(env: EmailIntakeEnv): boolean {
  return missingEmailIntakeKeys(env).length === 0;
}

/** True when background tasks can be queued; otherwise the webhook runs inline. */
export function isTriggerConfigured(env: EmailIntakeEnv): boolean {
  return isSet(env.TRIGGER_SECRET_KEY);
}
