import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditContext } from "../services/supabase";

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
      db?: SupabaseClient;
      auditContext?: AuditContext;
    }
  }
}

export {};
