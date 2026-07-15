import type { CompanyRole, MovementDirection } from "@expenses/shared";

const FINANCIAL_MANAGER_ROLES: CompanyRole[] = ["OWNER", "ADMIN", "ACCOUNTANT"];

export function isFinancialManager(role: CompanyRole | null | undefined): boolean {
  return Boolean(role && FINANCIAL_MANAGER_ROLES.includes(role));
}

export function canCreateMovement(role: CompanyRole | null | undefined, direction: MovementDirection): boolean {
  if (!role) return false;
  if (isFinancialManager(role)) return true;
  if (role === "INCOME_REGISTRAR") return direction === "in";
  if (role === "EXPENSE_REGISTRAR") return direction === "out";
  return false;
}

export function canReadReports(role: CompanyRole | null | undefined): boolean {
  return Boolean(role && role !== "INCOME_REGISTRAR" && role !== "EXPENSE_REGISTRAR");
}

export function canAccessPath(role: CompanyRole | null | undefined, pathname: string): boolean {
  if (!role) return false;

  if (pathname === "/" || pathname.startsWith("/reports")) {
    return canReadReports(role);
  }

  if (pathname.startsWith("/income")) {
    return canCreateMovement(role, "in") || role === "VIEWER";
  }

  if (pathname.startsWith("/expenses")) {
    return canCreateMovement(role, "out") || role === "VIEWER";
  }

  if (pathname.startsWith("/projects")) {
    return isFinancialManager(role) || role === "VIEWER";
  }

  if (
    pathname.startsWith("/clients") ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/vehicles") ||
    pathname.startsWith("/payroll")
  ) {
    return isFinancialManager(role) || role === "VIEWER";
  }

  return true;
}

export function getRoleLabel(role: CompanyRole | "admin" | "viewer" | null | undefined): string {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    case "ACCOUNTANT":
      return "Accountant";
    case "INCOME_REGISTRAR":
      return "Income Registrar";
    case "EXPENSE_REGISTRAR":
      return "Expense Registrar";
    case "VIEWER":
      return "Viewer";
    case "admin":
      return "Administrador";
    case "viewer":
      return "Solo lectura";
    default:
      return "Sin rol asignado";
  }
}

export function getDefaultRouteForRole(role: CompanyRole | null | undefined): string {
  switch (role) {
    case "INCOME_REGISTRAR":
      return "/income";
    case "EXPENSE_REGISTRAR":
      return "/expenses";
    default:
      return "/";
  }
}
