import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { Env } from "../env";

const CompanyIdSchema = z.string().uuid();

export function tenantMiddleware(env: Env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const headerId = req.header("x-company-id");
    const queryId = typeof req.query.company_id === "string" ? req.query.company_id : undefined;
    const companyId = headerId ?? queryId ?? env.DEFAULT_COMPANY_ID;

    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id. Add x-company-id header or company_id query param." });
    }

    const parsed = CompanyIdSchema.safeParse(companyId.trim());
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid company_id. It must be a valid UUID." });
    }

    req.companyId = parsed.data;
    next();
  };
}
