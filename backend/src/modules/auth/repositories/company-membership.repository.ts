import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthCompanySummary, CompanyRole } from "@expenses/shared";

type CompanyMembershipCompany = {
  id: string;
  name: string;
  owner_user_id: string | null;
  created_at: string;
  timezone: string;
};

// Newer @supabase/supabase-js versions type embedded to-one resources (via
// `companies!inner(...)`) as an array, while older versions type them as a
// single object. Accept both shapes and normalize below.
type CompanyMembershipRow = {
  role: CompanyRole;
  companies: CompanyMembershipCompany | CompanyMembershipCompany[] | null;
};

function normalizeMembership(row: CompanyMembershipRow): AuthCompanySummary | null {
  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  if (!company) return null;

  return {
    id: company.id,
    name: company.name,
    owner_user_id: company.owner_user_id,
    created_at: company.created_at,
    timezone: company.timezone,
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
