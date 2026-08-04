import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUserProfile, AuthenticatedAuthUser } from "@expenses/shared";
import type { AuditContext } from "../services/supabase";
import type { AuthenticatedRequestUser } from "../modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
      db?: SupabaseClient;
      auditContext?: AuditContext;
      authUser?: AuthenticatedAuthUser;
      appUser?: AuthUserProfile | null;
      user?: AuthenticatedRequestUser;
    }
  }
}

export {};
