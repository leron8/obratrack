"use client";

import type { AuthSessionResponse, AuthenticatedAuthUser, AuthCompanySummary, AuthUserProfile, CompanyRole } from "@expenses/shared";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type OnboardingPayload = {
  full_name: string;
  phone_number: string;
  country: string;
  timezone: string;
  company_name?: string;
};

type AuthContextValue = {
  supabase: SupabaseClient;
  loading: boolean;
  session: Session | null;
  authUser: AuthenticatedAuthUser | null;
  user: AuthUserProfile | null;
  companies: AuthCompanySummary[];
  activeCompany: AuthCompanySummary | null;
  activeRole: CompanyRole | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  sendMagicLink: (email: string, nextPath?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  completeOnboarding: (payload: OnboardingPayload) => Promise<AuthSessionResponse>;
  setActiveCompany: (companyId: string) => Promise<AuthSessionResponse>;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  authUser: AuthenticatedAuthUser | null;
  user: AuthUserProfile | null;
  companies: AuthCompanySummary[];
  activeCompany: AuthCompanySummary | null;
  activeRole: CompanyRole | null;
};

const initialState: AuthState = {
  loading: true,
  session: null,
  authUser: null,
  user: null,
  companies: [],
  activeCompany: null,
  activeRole: null
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applySnapshot(snapshot: AuthSessionResponse, session: Session | null): AuthState {
  return {
    loading: false,
    session,
    authUser: snapshot.auth_user,
    user: snapshot.user,
    companies: snapshot.companies,
    activeCompany: snapshot.active_company,
    activeRole: snapshot.active_role
  };
}

async function requestAuthJson(
  supabase: SupabaseClient,
  path: string,
  init?: RequestInit
): Promise<AuthSessionResponse> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active Supabase session.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<AuthSessionResponse> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || response.statusText || "Request failed.");
  }

  return payload as AuthSessionResponse;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const [state, setState] = useState<AuthState>(initialState);
  const requestCounter = useRef(0);

  useEffect(() => {
    let mounted = true;

    const syncStateFromSession = async (session: Session | null) => {
      const requestId = ++requestCounter.current;

      if (!session) {
        if (!mounted) return;
        startTransition(() => {
          setState({
            ...initialState,
            loading: false
          });
        });
        return;
      }

      startTransition(() => {
        setState((current) => ({
          ...current,
          loading: true,
          session
        }));
      });

      try {
        const snapshot = await requestAuthJson(supabase, "/auth/session");
        if (!mounted || requestId !== requestCounter.current) return;

        startTransition(() => {
          setState(applySnapshot(snapshot, session));
        });
      } catch {
        if (!mounted || requestId !== requestCounter.current) return;

        await supabase.auth.signOut();
        startTransition(() => {
          setState({
            ...initialState,
            loading: false
          });
        });
      }
    };

    void supabase.auth.getSession().then(({ data }) => syncStateFromSession(data.session));

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncStateFromSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      loading: state.loading,
      session: state.session,
      authUser: state.authUser,
      user: state.user,
      companies: state.companies,
      activeCompany: state.activeCompany,
      activeRole: state.activeRole,
      isAuthenticated: Boolean(state.session && state.authUser),
      onboardingComplete: Boolean(state.user?.onboarding_completed_at),
      async sendMagicLink(email: string, nextPath?: string | null) {
        const redirectUrl = new URL("/auth/callback", window.location.origin);
        if (nextPath && nextPath.startsWith("/")) {
          redirectUrl.searchParams.set("next", nextPath);
        }

        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            emailRedirectTo: redirectUrl.toString(),
            shouldCreateUser: true
          }
        });

        if (error) throw error;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        startTransition(() => {
          setState({
            ...initialState,
            loading: false
          });
        });
      },
      async refreshSession() {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
          startTransition(() => {
            setState({
              ...initialState,
              loading: false
            });
          });
          return;
        }

        const snapshot = await requestAuthJson(supabase, "/auth/session");
        startTransition(() => {
          setState(applySnapshot(snapshot, session));
        });
      },
      async completeOnboarding(payload: OnboardingPayload) {
        const snapshot = await requestAuthJson(supabase, "/auth/onboarding", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        startTransition(() => {
          setState((current) => applySnapshot(snapshot, current.session));
        });

        return snapshot;
      },
      async setActiveCompany(companyId: string) {
        const snapshot = await requestAuthJson(supabase, "/auth/active-company", {
          method: "PUT",
          body: JSON.stringify({ company_id: companyId })
        });

        startTransition(() => {
          setState((current) => applySnapshot(snapshot, current.session));
        });

        return snapshot;
      }
    }),
    [state.activeCompany, state.activeRole, state.authUser, state.companies, state.loading, state.session, state.user, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider.");
  }

  return context;
}
