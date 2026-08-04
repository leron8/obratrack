import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUserProfile } from "@expenses/shared";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  country: string | null;
  timezone: string | null;
  active_company_id: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeUser(row: UserRow): AuthUserProfile {
  return {
    id: row.id,
    email: row.email ?? "",
    full_name: row.full_name,
    phone_number: row.phone_number,
    country: row.country,
    timezone: row.timezone,
    active_company_id: row.active_company_id,
    onboarding_completed_at: row.onboarding_completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export class UserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(userId: string): Promise<AuthUserProfile | null> {
    const { data, error } = await this.db
      .from("users")
      .select(
        "id, email, full_name, phone_number, country, timezone, active_company_id, onboarding_completed_at, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return normalizeUser(data as UserRow);
  }

  async setActiveCompany(userId: string, companyId: string): Promise<void> {
    const { error } = await this.db
      .from("users")
      .update({
        active_company_id: companyId,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (error) throw error;
  }
}
