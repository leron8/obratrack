import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthCompanySummary,
  AuthSessionResponse,
  AuthUserProfile,
  AuthenticatedAuthUser
} from "@expenses/shared";
import { RequestError } from "../../../routes/http-helpers";
import type { Env } from "../../../env";
import { createSupabaseUserClient } from "../../../services/supabase";
import { CompanyMembershipRepository } from "../repositories/company-membership.repository";
import { UserRepository } from "../repositories/user.repository";
import type { CompleteOnboardingDto } from "../dto/complete-onboarding.dto";

type VerifyAccessTokenResult = {
  authUser: AuthenticatedAuthUser;
  user: AuthUserProfile | null;
  requestDb: SupabaseClient;
};

type CompanyContext = {
  companies: AuthCompanySummary[];
  activeCompany: AuthCompanySummary | null;
  activeRole: AuthCompanySummary["role"] | null;
};

export class AuthService {
  private readonly users: UserRepository;
  private readonly memberships: CompanyMembershipRepository;

  constructor(
    private readonly env: Env,
    private readonly serviceDb: SupabaseClient
  ) {
    this.users = new UserRepository(serviceDb);
    this.memberships = new CompanyMembershipRepository(serviceDb);
  }

  async verifyAccessToken(
    accessToken: string,
    globalHeaders?: Record<string, string>
  ): Promise<VerifyAccessTokenResult> {
    const claimsResult = await this.serviceDb.auth.getClaims(accessToken);
    if (claimsResult.error || !claimsResult.data?.claims) {
      throw new RequestError(401, "Invalid or expired Supabase session.");
    }

    const claims = claimsResult.data.claims as Record<string, unknown>;
    const userId = typeof claims.sub === "string" ? claims.sub : null;
    let email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;

    if (!userId) {
      throw new RequestError(401, "The Supabase session is missing a user identifier.");
    }

    if (!email) {
      const userResult = await this.serviceDb.auth.getUser(accessToken);
      if (userResult.error || !userResult.data.user?.email) {
        throw new RequestError(401, "The Supabase session is missing an email address.");
      }
      email = userResult.data.user.email.toLowerCase();
    }

    const requestDb = createSupabaseUserClient({
      url: this.env.SUPABASE_URL,
      publishableKey: this.env.SUPABASE_PUBLIC_KEY,
      accessToken,
      globalHeaders
    });

    return {
      authUser: {
        id: userId,
        email
      },
      user: await this.users.findById(userId),
      requestDb
    };
  }

  async getSessionSnapshot(authUser: AuthenticatedAuthUser): Promise<AuthSessionResponse> {
    let user = await this.users.findById(authUser.id);

    // TEMPORARY QA BYPASS: auto-complete onboarding so QA can test core features
    // without being blocked by the broken complete_user_onboarding RPC.
    if (!user || !user.onboarding_completed_at || !user.active_company_id) {
      await this.autoCompleteOnboarding(authUser, user);
      user = await this.users.findById(authUser.id);
    }

    const companyContext = await this.resolveCompanyContext({
      userId: authUser.id,
      activeCompanyId: user?.active_company_id ?? null
    });

    return {
      auth_user: authUser,
      user,
      onboarding_complete: Boolean(user?.onboarding_completed_at),
      companies: companyContext.companies,
      active_company: companyContext.activeCompany,
      active_role: companyContext.activeRole
    };
  }

  async completeOnboarding(authUser: AuthenticatedAuthUser, payload: CompleteOnboardingDto): Promise<AuthSessionResponse> {
    // TEMPORARY QA BYPASS: perform onboarding writes directly instead of calling
    // the broken complete_user_onboarding RPC.
    await this.autoCompleteOnboarding(authUser, null, payload);
    return this.getSessionSnapshot(authUser);
  }

  async setActiveCompany(authUser: AuthenticatedAuthUser, companyId: string): Promise<AuthSessionResponse> {
    const membership = await this.memberships.findByUserIdAndCompanyId(authUser.id, companyId);
    if (!membership) {
      throw new RequestError(403, "You do not have access to that company.");
    }

    await this.users.setActiveCompany(authUser.id, companyId);
    return this.getSessionSnapshot(authUser);
  }

  async getCompanyContextForRequest({
    userId,
    requestedCompanyId,
    activeCompanyId
  }: {
    userId: string;
    requestedCompanyId?: string;
    activeCompanyId?: string | null;
  }): Promise<CompanyContext> {
    // TEMPORARY QA BYPASS: ensure onboarding is auto-completed before resolving
    // company context so protected endpoints never hit the 409 onboarding gate.
    const user = await this.users.findById(userId);
    if (!user || !user.onboarding_completed_at || !user.active_company_id) {
      await this.autoCompleteOnboarding({ id: userId, email: user?.email ?? "" }, user);
    }

    return this.resolveCompanyContext({
      userId,
      requestedCompanyId,
      activeCompanyId: activeCompanyId ?? null
    });
  }

  private async resolveCompanyContext({
    userId,
    requestedCompanyId,
    activeCompanyId
  }: {
    userId: string;
    requestedCompanyId?: string;
    activeCompanyId: string | null;
  }): Promise<CompanyContext> {
    // Use the service_db client (service_role key) which bypasses RLS.
    // The user's identity is already verified from the JWT claims above.
    const companies = await this.memberships.listByUserId(userId);
    if (companies.length === 0) {
      return {
        companies,
        activeCompany: null,
        activeRole: null
      };
    }

    if (requestedCompanyId) {
      const requestedCompany = companies.find((company) => company.id === requestedCompanyId);
      if (!requestedCompany) {
        throw new RequestError(403, "You do not have access to the requested company.");
      }

      if (activeCompanyId !== requestedCompany.id) {
        await this.users.setActiveCompany(userId, requestedCompany.id);
      }

      return {
        companies,
        activeCompany: requestedCompany,
        activeRole: requestedCompany.role
      };
    }

    const activeCompany =
      companies.find((company) => company.id === activeCompanyId) ??
      companies[0] ??
      null;

    if (activeCompany && activeCompanyId !== activeCompany.id) {
      await this.users.setActiveCompany(userId, activeCompany.id);
    }

    return {
      companies,
      activeCompany,
      activeRole: activeCompany?.role ?? null
    };
  }

  // TEMPORARY QA BYPASS: replicate the complete_user_onboarding RPC logic in
  // TypeScript so users can get into the app while the RPC is broken.
  private async autoCompleteOnboarding(
    authUser: AuthenticatedAuthUser,
    existingUser: AuthUserProfile | null,
    payload?: CompleteOnboardingDto
  ): Promise<void> {
    console.log(`[TEMP QA BYPASS] Auto-completing onboarding for user ${authUser.id} (${authUser.email})`);

    const now = new Date().toISOString();
    const defaultName = authUser.email.split("@")[0] || "there";

    const { error: userError } = await this.serviceDb.from("users").upsert(
      {
        id: authUser.id,
        email: authUser.email.toLowerCase(),
        full_name: payload?.full_name ?? existingUser?.full_name ?? defaultName,
        phone_number: payload?.phone_number ?? existingUser?.phone_number ?? null,
        country: payload?.country ?? existingUser?.country ?? null,
        timezone: payload?.timezone ?? existingUser?.timezone ?? "UTC",
        onboarding_completed_at: now,
        updated_at: now
      },
      { onConflict: "id" }
    );
    if (userError) throw userError;

    // Re-check memberships after the user upsert — a concurrent request may
    // have already created the company/membership.
    const memberships = await this.memberships.listByUserId(authUser.id);
    let targetCompanyId = existingUser?.active_company_id ?? memberships[0]?.id ?? null;

    if (!targetCompanyId) {
      const companyName = payload?.company_name ?? "Personal";
      const timezone = payload?.timezone ?? existingUser?.timezone ?? "UTC";

      // Create the company. If a concurrent first-login request already claimed
      // the same slug (unique constraint violation), retry with a fresh slug.
      for (let attempt = 0; attempt < 3; attempt++) {
        const slug = await this.generateCompanySlug(companyName);
        const { data: company, error: companyError } = await this.serviceDb
          .from("companies")
          .insert({
            name: companyName,
            slug,
            timezone,
            owner_user_id: authUser.id
          })
          .select("id")
          .single();

        if (!companyError) {
          targetCompanyId = (company as { id: string }).id;
          break;
        }

        // 23505 = unique_violation (companies_slug_key)
        if (companyError.code !== "23505") throw companyError;
      }

      if (!targetCompanyId) {
        throw new Error("Unable to create the initial company. Please try again.");
      }

      const { error: memberError } = await this.serviceDb
        .from("company_members")
        .insert({ company_id: targetCompanyId, user_id: authUser.id, role: "OWNER" });
      if (memberError) throw memberError;
    }

    await this.users.setActiveCompany(authUser.id, targetCompanyId);
  }

  private async generateCompanySlug(baseName: string): Promise<string> {
    const normalized = (baseName || "workspace")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const candidate = normalized || "workspace";

    const { data } = await this.serviceDb
      .from("companies")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) return candidate;
    return `${candidate.slice(0, 48)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
