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
    const user = await this.users.findById(authUser.id);
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
    const { error } = await this.serviceDb.rpc("complete_user_onboarding", {
      p_user_id: authUser.id,
      p_email: authUser.email,
      p_full_name: payload.full_name,
      p_phone_number: payload.phone_number,
      p_country: payload.country,
      p_timezone: payload.timezone,
      p_company_name: payload.company_name
    });

    if (error) throw error;
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
}
