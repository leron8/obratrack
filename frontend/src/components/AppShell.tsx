"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthLoadingScreen } from "./auth/AuthLoadingScreen";
import { useAuth } from "../hooks/use-auth";
import { useAuthorization } from "../hooks/use-authorization";
import { getDefaultRouteForRole } from "../lib/authorization";
import { Header } from "./ui/Header";
import { Sidebar } from "./ui/Sidebar";

type AppShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
};

export default function AppShell({ children, eyebrow, title, description }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAuthenticated, activeRole } = useAuth();
  const { canAccessPath } = useAuthorization();

  useEffect(() => {
    if (!loading && isAuthenticated && !canAccessPath(pathname)) {
      const defaultPath = getDefaultRouteForRole(activeRole);
      router.replace(defaultPath !== pathname && canAccessPath(defaultPath) ? defaultPath : "/unauthorized");
    }
  }, [activeRole, canAccessPath, isAuthenticated, loading, pathname, router]);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !canAccessPath(pathname)) {
    return <AuthLoadingScreen title="Opening your workspace" description="Checking your session and permissions." />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content-area">
        <Header eyebrow={eyebrow} title={title} description={description} />
        {children}
      </main>
    </div>
  );
}
