import { z } from "zod";

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

const PROVIDER_KEY_VARS = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
} as const;

const BILLING_ENABLED_MODES = new Set(["test", "live"]);

const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
    SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
    AGENTMAIL_API_KEY: z.string().min(1, "AGENTMAIL_API_KEY is required"),
    AGENTMAIL_WEBHOOK_SECRET: z.string().min(1, "AGENTMAIL_WEBHOOK_SECRET is required"),
    EXTRACTION_PROVIDER: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    // Non-prod dev-unlock for Team features — never set on Vercel Production.
    // See docs/billing-polar.md and src/lib/billing.ts for details.
    BILLING_DEV_UNLOCK: z.string().optional(),
    // Billing mode: "none" (disabled), "test" (Polar sandbox), or
    // "live" (Polar production). Defaults to "live" when unset or unrecognized.
    BILLING_MODE: z.string().optional(),
    // Polar (billing — Merchant of Record).
    // Required when BILLING_MODE is "test" or "live"; ignored when "none".
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_ORGANIZATION_ID: z.string().optional(),
    POLAR_TEAM_PRODUCT_ID: z.string().optional(),
    POLAR_WEBHOOK_SECRET: z.string().optional(),
    // Starter-plan monthly invoice extraction cap (default 50 if unset).
    // Set low for local testing (e.g. 3) to hit the wall quickly.
    STARTER_MONTHLY_INVOICE_LIMIT: z.string().optional(),
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
  })
  .superRefine((env, ctx) => {
    const billingMode = (env.BILLING_MODE || "live").toLowerCase();
    if (!BILLING_ENABLED_MODES.has(billingMode)) return;

    if (!env.POLAR_ACCESS_TOKEN) {
      ctx.addIssue({
        code: "custom",
        message: "POLAR_ACCESS_TOKEN is required when BILLING_MODE is test or live.",
      });
    }
    if (!env.POLAR_TEAM_PRODUCT_ID) {
      ctx.addIssue({
        code: "custom",
        message: "POLAR_TEAM_PRODUCT_ID is required when BILLING_MODE is test or live.",
      });
    }
    if (!env.POLAR_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        message: "POLAR_WEBHOOK_SECRET is required when BILLING_MODE is test or live.",
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
