import Link from "next/link";

export function UnauthorizedState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-lg rounded-[32px] border border-rose-500/20 bg-slate-900/90 p-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.28em] text-rose-300">Unauthorized</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">This role cannot open this area.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Your account is authenticated, but the active company role does not include permission for this module.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-3xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Return to dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-3xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Switch account
          </Link>
        </div>
      </div>
    </div>
  );
}
