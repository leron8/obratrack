import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { loadEnv } from "./env";
import { createOpenAIClient } from "./services/openai";
import { createSupabaseClient } from "./services/supabase";
import { auditContextMiddleware } from "./routes/audit";
import { tenantMiddleware } from "./routes/tenant";
import { createWhatsappRouter } from "./routes/whatsapp";
import { createTransactionsRouter } from "./routes/transactions";
import { createDashboardRouter } from "./routes/dashboard";
import { createProjectsRouter } from "./routes/projects";
import { createDirectoryRouter } from "./routes/directory";
import { createPayrollRouter } from "./routes/payroll";

async function main() {
  const env = loadEnv();

  const openaiClient = createOpenAIClient(env.OPENAI_API_KEY);
  const db = createSupabaseClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  });

  const app = express();
  app.use(
    cors({
      origin: "*"
    })
  );

  // Twilio webhook comes as form-encoded.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(auditContextMiddleware(env));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(createWhatsappRouter({ env, openaiClient, db }));
  app.use(tenantMiddleware(env));
  app.use(createTransactionsRouter({ env, openaiClient, db }));
  app.use(createProjectsRouter({ env, db }));
  app.use(createDirectoryRouter({ env, db }));
  app.use(createPayrollRouter({ env, db }));
  app.use(createDashboardRouter({ db }));

  app.listen(env.PORT, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
