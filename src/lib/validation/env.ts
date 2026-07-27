import { z } from "zod";

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

const PROVIDER_KEY_VARS = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
} as const;

const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
    AGENTMAIL_API_KEY: z.string().min(1, "AGENTMAIL_API_KEY is required"),
    AGENTMAIL_WEBHOOK_SECRET: z.string().min(1, "AGENTMAIL_WEBHOOK_SECRET is required"),
    EXTRACTION_PROVIDER: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const provider = (env.EXTRACTION_PROVIDER || "anthropic").toLowerCase();
    if (!(provider in PROVIDER_KEY_VARS)) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown EXTRACTION_PROVIDER "${provider}" — use anthropic, google, or deepseek.`,
      });
      return;
    }

    const requiredVar = PROVIDER_KEY_VARS[provider as keyof typeof PROVIDER_KEY_VARS];
    const hasKey =
      provider === "google"
        ? Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY)
        : Boolean(env[requiredVar as "ANTHROPIC_API_KEY" | "DEEPSEEK_API_KEY"]);

    if (!hasKey) {
      ctx.addIssue({
        code: "custom",
        message: `EXTRACTION_PROVIDER is "${provider}" but ${requiredVar} is not set.`,
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function parseEnvInput(input: unknown): ValidationResult<EnvConfig> {
  const result = envSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  const messages = result.error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
  );
  return { success: false, error: messages.join("; ") };
}
