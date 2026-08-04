import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { buildAuditHeaders } from "../routes/audit";
import { RequestError, getErrorResponse } from "../routes/http-helpers";
import { AuthService } from "../modules/auth/services/auth.service";

const CompanyIdSchema = z.string().uuid();

function extractBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}

function getRequestedCompanyId(req: Request): string | undefined {
  const fromHeader = req.header("x-company-id");
  const fromQuery = typeof req.query.company_id === "string" ? req.query.company_id : undefined;
  const candidate = fromHeader ?? fromQuery;
  if (!candidate) return undefined;
  return CompanyIdSchema.parse(candidate.trim());
}

function sendAuthError(res: Response, error: unknown, fallback: string) {
  const { status, message } = getErrorResponse(error, fallback);
  return res.status(status).json({ error: message });
}

export function createAuthenticationMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = extractBearerToken(req);
      if (!accessToken) {
        throw new RequestError(401, "Missing Supabase access token.");
      }

      const auditHeaders = req.auditContext ? buildAuditHeaders(req.auditContext) : undefined;
      const result = await authService.verifyAccessToken(accessToken, auditHeaders);

      req.db = result.requestDb;
      req.authUser = result.authUser;
      req.appUser = result.user;
      req.user = {
        id: result.authUser.id,
        email: result.authUser.email,
        companyId: result.user?.active_company_id ?? null,
        role: null
      };

      next();
    } catch (error) {
      return sendAuthError(res, error, "Unable to validate the Supabase session.");
    }
  };
}

export function createCompanyContextMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new RequestError(401, "Authentication is required.");
      }

      const requestedCompanyId = getRequestedCompanyId(req);
      const companyContext = await authService.getCompanyContextForRequest({
        userId: req.user.id,
        requestedCompanyId,
        activeCompanyId: req.appUser?.active_company_id ?? null
      });

      if (!companyContext.activeCompany || !companyContext.activeRole) {
        throw new RequestError(409, "You need to complete onboarding before accessing company data.");
      }

      req.companyId = companyContext.activeCompany.id;
      req.user = {
        ...req.user,
        companyId: companyContext.activeCompany.id,
        role: companyContext.activeRole
      };

      next();
    } catch (error) {
      return sendAuthError(res, error, "Unable to load the active company.");
    }
  };
}
