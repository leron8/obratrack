export function AuthLoadingScreen({
  title = "Loading your workspace",
  description = "Refreshing your secure session and company access."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-[32px] border border-slate-800 bg-slate-900/80 p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300" />
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">ObraTrack</p>
        <h1 className="mt-4 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}
