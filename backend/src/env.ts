import { z } from "zod";

const BaseEnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),

  // Twilio (WhatsApp)
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),
  OPENAI_PARSING_MODEL: z.string().default("gpt-4o-mini"),

  // Supabase
  SUPABASE_URL: z.string().min(1),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Optional fallback company for unauthenticated WhatsApp/demo flows.
  DEFAULT_COMPANY_ID: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().uuid().optional()
  ),
  DEFAULT_CURRENCY: z.string().default("MXN")
});

export type Env = z.infer<typeof BaseEnvSchema> & {
  DEFAULT_COMPANY_ID: string;
  SUPABASE_PUBLIC_KEY: string;
  SUPABASE_SERVER_KEY: string;
};

export function loadEnv(): Env {
  const parsed = BaseEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  const supabasePublicKey = parsed.data.SUPABASE_PUBLISHABLE_KEY ?? parsed.data.SUPABASE_ANON_KEY;
  const supabaseServerKey = parsed.data.SUPABASE_SECRET_KEY ?? parsed.data.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabasePublicKey) {
    throw new Error("Missing Supabase public key. Set SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY.");
  }

  if (!supabaseServerKey) {
    throw new Error("Missing Supabase server key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    ...parsed.data,
    DEFAULT_COMPANY_ID: parsed.data.DEFAULT_COMPANY_ID ?? "",
    SUPABASE_PUBLIC_KEY: supabasePublicKey,
    SUPABASE_SERVER_KEY: supabaseServerKey
  };
}
