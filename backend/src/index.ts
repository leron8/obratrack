import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { loadEnv } from "./env";
import { createAuthenticationMiddleware, createCompanyContextMiddleware } from "./middleware/authentication";
import { AuthService } from "./modules/auth/services/auth.service";
import { createOpenAIClient } from "./services/openai";
import { createSupabaseClient } from "./services/supabase";
import { auditContextMiddleware } from "./routes/audit";
import { createAuthRouter } from "./routes/auth";
import { createWhatsappRouter } from "./routes/whatsapp";
import { createTransactionsRouter } from "./routes/transactions";
import { createDashboardRouter } from "./routes/dashboard";
import { createProjectsRouter } from "./routes/projects";
import { createDirectoryRouter } from "./routes/directory";
import { createPayrollRouter } from "./routes/payroll";
import { createReportsRouter } from "./routes/reports";

async function main() {
  const env = loadEnv();

  const openaiClient = createOpenAIClient(env.OPENAI_API_KEY);
  const db = createSupabaseClient({
    url: env.SUPABASE_URL,
    key: env.SUPABASE_SERVER_KEY
  });
  const authService = new AuthService(env, db);

  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
      allowedHeaders: [
        "authorization",
        "content-type",
        "idempotency-key",
        "x-company-id",
        "x-request-id"
      ]
    })
  );

  // Twilio webhook comes as form-encoded.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(auditContextMiddleware(env));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(createWhatsappRouter({ env, openaiClient, db }));
  app.use(createAuthenticationMiddleware(authService));
  app.use(createAuthRouter({ authService }));
  app.use(createCompanyContextMiddleware(authService));
  app.use(createTransactionsRouter({ env, openaiClient, db }));
  app.use(createProjectsRouter({ env, db }));
  app.use(createDirectoryRouter({ env, db }));
  app.use(createPayrollRouter({ env, db }));
  app.use(createReportsRouter({ db }));
  app.use(createDashboardRouter({ db }));

  app.listen(env.PORT, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
