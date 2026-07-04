import { cn } from "../../lib/utils";

export function KpiCard({ label, value, metric, className }: { label: string; value: string; metric: string; className?: string }) {
  return (
    <div className={cn("rounded-[28px] border border-slate-800 bg-slate-950 p-6 shadow-soft", className)}>
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{metric}</p>
        </div>
      </div>
    </div>
  );
}
