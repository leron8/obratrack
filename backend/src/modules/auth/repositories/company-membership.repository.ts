import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthCompanySummary, CompanyRole } from "@expenses/shared";

type CompanyMembershipRow = {
  role: CompanyRole;
  companies: {
    id: string;
    name: string;
    owner_user_id: string | null;
    created_at: string;
    timezone: string;
  } | null;
};

function normalizeMembership(row: CompanyMembershipRow): AuthCompanySummary | null {
  if (!row.companies) return null;

  return {
    id: row.companies.id,
    name: row.companies.name,
    owner_user_id: row.companies.owner_user_id,
    created_at: row.companies.created_at,
    timezone: row.companies.timezone,
    role: row.role
  };
}

export class CompanyMembershipRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByUserId(userId: string): Promise<AuthCompanySummary[]> {
    const { data, error } = await this.db
      .from("company_members")
      .select("role, companies!inner(id, name, owner_user_id, created_at, timezone)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? [])
      .map((row) => normalizeMembership(row as CompanyMembershipRow))
      .filter((company): company is AuthCompanySummary => company !== null)
      .sort((left, right) => left.name.localeCompare(right.name, "es-MX"));
  }

  async findByUserIdAndCompanyId(userId: string, companyId: string): Promise<AuthCompanySummary | null> {
    const { data, error } = await this.db
      .from("company_members")
      .select("role, companies!inner(id, name, owner_user_id, created_at, timezone)")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return normalizeMembership(data as CompanyMembershipRow);
  }
}
