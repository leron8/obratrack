"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLoadingScreen } from "../../components/auth/AuthLoadingScreen";
import { useAuth } from "../../hooks/use-auth";
import { getDefaultRouteForRole } from "../../lib/authorization";

function getDefaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export default function OnboardingPage() {
  const router = useRouter();
  const { loading, isAuthenticated, onboardingComplete, completeOnboarding, authUser, activeRole } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    country: "",
    timezone: getDefaultTimezone()
  });

  const defaultCompanyName = useMemo(() => "Personal", []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!loading && onboardingComplete) {
      router.replace(getDefaultRouteForRole(activeRole));
    }
  }, [activeRole, isAuthenticated, loading, onboardingComplete, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const session = await completeOnboarding({
        ...form,
        company_name: defaultCompanyName
      });
      router.replace(getDefaultRouteForRole(session.active_role));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !isAuthenticated) {
    return <AuthLoadingScreen title="Preparing onboarding" description="Checking your authenticated session." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-2xl rounded-[36px] border border-slate-800 bg-slate-900/90 p-8 shadow-soft md:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">First login</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Complete your workspace profile</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          We’ll create your initial company as <span className="text-slate-200">{defaultCompanyName}</span> and make
          you the owner.
        </p>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
          Signed in as <span className="font-medium text-white">{authUser?.email}</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="Leonardo Rivera"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="phone_number">
              WhatsApp phone number
            </label>
            <input
              id="phone_number"
              value={form.phone_number}
              onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
              className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="+52 55 5555 5555"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="country">
              Country
            </label>
            <input
              id="country"
              value={form.country}
              onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
              className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="Mexico"
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="timezone">
              Time zone
            </label>
            <input
              id="timezone"
              value={form.timezone}
              onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="America/Mexico_City"
              required
            />
          </div>

          {error ? <p className="md:col-span-2 text-sm text-rose-300">{error}</p> : null}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Creating workspace..." : "Finish onboarding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
