"use client";

import { useAuthorization } from "../hooks/use-authorization";
import { getRoleLabel as getAuthRoleLabel } from "./authorization";
import { getSupabaseBrowserClient } from "./supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
const DEFAULT_COMPANY_ID = "";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

async function fetchJson(url: string, init?: RequestInit) {
  const client = getSupabaseBrowserClient();
  const {
    data: { session }
  } = await client.auth.getSession();

  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data ? String((data as { error?: string }).error) : res.statusText;
    throw new Error(message || `La solicitud fallo con estado ${res.status}`);
  }
  return data;
}

function getRoleLabel(role: Parameters<typeof getAuthRoleLabel>[0]) {
  return getAuthRoleLabel(role);
}

function useDemoRole() {
  const { isFinancialManager } = useAuthorization();
  const mappedRole = isFinancialManager ? "admin" : "viewer";
  return [mappedRole, () => undefined] as const;
}

export { API_BASE_URL, DEFAULT_COMPANY_ID, formatMoney, fetchJson, getRoleLabel, useDemoRole };
