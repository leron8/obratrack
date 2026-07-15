import type { CompanyRole, MovementDirection } from "@expenses/shared";

const FINANCIAL_MANAGER_ROLES: CompanyRole[] = ["OWNER", "ADMIN", "ACCOUNTANT"];
const MEMBER_MANAGER_ROLES: CompanyRole[] = ["OWNER", "ADMIN"];

export function isFinancialManager(role: CompanyRole | null | undefined): boolean {
  return role !== null && role !== undefined && FINANCIAL_MANAGER_ROLES.includes(role);
}

export function canManageMembers(role: CompanyRole | null | undefined): boolean {
  return role !== null && role !== undefined && MEMBER_MANAGER_ROLES.includes(role);
}

export function canReadCompanyData(role: CompanyRole | null | undefined): boolean {
  return role !== null && role !== undefined;
}

export function canReadReports(role: CompanyRole | null | undefined): boolean {
  return role !== null && role !== undefined && role !== "INCOME_REGISTRAR" && role !== "EXPENSE_REGISTRAR";
}

export function canCreateMovement(role: CompanyRole | null | undefined, direction: MovementDirection): boolean {
  if (!role) return false;
  if (isFinancialManager(role)) return true;
  if (role === "INCOME_REGISTRAR") return direction === "in";
  if (role === "EXPENSE_REGISTRAR") return direction === "out";
  return false;
}

export function canUpdateOrDeleteMovement(role: CompanyRole | null | undefined): boolean {
  return isFinancialManager(role);
}
