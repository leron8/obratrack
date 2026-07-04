import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
const DEFAULT_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || "";

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
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data === "object" && data && "error" in data ? String((data as { error?: string }).error) : res.statusText;
    throw new Error(message || `Request failed with ${res.status}`);
  }
  return data;
}

function getRoleLabel(role: "admin" | "viewer") {
  return role === "admin" ? "Admin (demo, full access)" : "Viewer";
}

function useDemoRole() {
  // TODO: remove the admin default before release and require real auth/role selection.
  const [role, setRole] = useState<"admin" | "viewer">("admin");
  return [role, setRole] as const;
}

export { API_BASE_URL, DEFAULT_COMPANY_ID, formatMoney, fetchJson, getRoleLabel, useDemoRole };
