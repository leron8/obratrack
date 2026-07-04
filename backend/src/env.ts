import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),

  // Twilio (WhatsApp)
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),
  OPENAI_PARSING_MODEL: z.string().default("gpt-4o-mini"),

  // Supabase
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // For the demo we store a single company_id unless overridden.
  DEFAULT_COMPANY_ID: z.string().min(1),
  DEFAULT_CURRENCY: z.string().default("MXN")
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return parsed.data;
}

