export const EMAIL_INTAKE_ENV_KEYS = [
  "AGENTMAIL_API_KEY",
  "AGENTMAIL_WEBHOOK_SECRET",
  "TRIGGER_SECRET_KEY",
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

/** True only when every key needed to receive and process forwarded email is set. */
export function isEmailIntakeConfigured(env: EmailIntakeEnv): boolean {
  return missingEmailIntakeKeys(env).length === 0;
}
