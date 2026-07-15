import type { CompanyRole } from "@expenses/shared";

export const COMPANY_ROLES = [
  "OWNER",
  "ADMIN",
  "ACCOUNTANT",
  "INCOME_REGISTRAR",
  "EXPENSE_REGISTRAR",
  "VIEWER"
] as const satisfies readonly CompanyRole[];

export type AuthenticatedRequestUser = {
  id: string;
  email: string;
  companyId: string | null;
  role: CompanyRole | null;
};
