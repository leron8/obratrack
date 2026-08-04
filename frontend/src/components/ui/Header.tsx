"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useAuthorization } from "../../hooks/use-authorization";

type HeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function Header({ eyebrow, title, description }: HeaderProps) {
  const router = useRouter();
  const { activeCompany, activeRole, companies, setActiveCompany, signOut, user } = useAuth();
  const { roleLabel } = useAuthorization();
  const [switchingCompany, setSwitchingCompany] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleCompanyChange(companyId: string) {
    if (!companyId || companyId === activeCompany?.id) return;

    setSwitchingCompany(true);
    try {
      await setActiveCompany(companyId);
    } finally {
      setSwitchingCompany(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm text-cyan-300">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm text-slate-400">{description}</p> : null}
      </div>

      <div className="grid w-full gap-3 lg:w-auto lg:min-w-[340px]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-soft">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Active company</p>
          <div className="relative mt-2">
            <select
              value={activeCompany?.id ?? ""}
              onChange={(event) => void handleCompanyChange(event.target.value)}
              disabled={switchingCompany}
              className="w-full appearance-none bg-transparent pr-8 text-sm text-slate-100 outline-none"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id} className="bg-slate-950">
                  {company.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {switchingCompany ? "Switching company..." : activeCompany ? `Role: ${roleLabel}` : "No company selected"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 shadow-soft">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            {(user?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
          </span>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{user?.full_name || user?.email || "Authenticated user"}</p>
            <p className="text-xs text-slate-500">{activeRole ? roleLabel : "No role assigned"}</p>
          </div>
        </div>
        <button
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-600 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
