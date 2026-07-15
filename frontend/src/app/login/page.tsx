"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLoadingScreen } from "../../components/auth/AuthLoadingScreen";
import { useAuth } from "../../hooks/use-auth";
import { getDefaultRouteForRole } from "../../lib/authorization";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAuthenticated, onboardingComplete, activeRole, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(onboardingComplete ? getDefaultRouteForRole(activeRole) : "/onboarding");
    }
  }, [activeRole, isAuthenticated, loading, onboardingComplete, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await sendMagicLink(email, searchParams.get("next"));
      setSuccess("Check your inbox for the secure magic link.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <div className="hidden flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(2,6,23,1))] p-12 lg:flex">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300">ObraTrack</p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight text-white">
            Secure company finance operations across WhatsApp and the web.
          </h1>
          <p className="mt-6 text-base leading-8 text-slate-300">
            Use Supabase passwordless email access to open the dashboard, complete onboarding, and switch between
            companies without losing your active workspace.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:max-w-xl">
        <div className="w-full max-w-md rounded-[32px] border border-slate-800 bg-slate-900/90 p-8 shadow-soft">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Welcome back</p>
          <h2 className="mt-4 text-3xl font-semibold text-white">Sign in with your email</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            We will send a secure Supabase magic link. No password is required.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                required
              />
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Sending magic link..." : "Continue with Magic Link"}
            </button>
          </form>

          {searchParams.get("next") ? (
            <p className="mt-6 text-xs text-slate-500">
              After signing in, you’ll return to <span className="text-slate-300">{searchParams.get("next")}</span>.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
