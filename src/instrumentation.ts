export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { parseEnvInput } = await import("@/lib/validation/env");
  const result = parseEnvInput(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error}`);
  }
}
