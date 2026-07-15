"use client";

import type { MovementDirection } from "@expenses/shared";
import { canAccessPath, canCreateMovement, canReadReports, getRoleLabel, isFinancialManager } from "../lib/authorization";
import { useAuth } from "./use-auth";

export function useAuthorization() {
  const { activeRole } = useAuth();

  return {
    role: activeRole,
    roleLabel: getRoleLabel(activeRole),
    isFinancialManager: isFinancialManager(activeRole),
    canReadReports: canReadReports(activeRole),
    canAccessPath: (pathname: string) => canAccessPath(activeRole, pathname),
    canCreateMovement: (direction: MovementDirection) => canCreateMovement(activeRole, direction)
  };
}
