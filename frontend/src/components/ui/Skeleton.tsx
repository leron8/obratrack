export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-slate-800/80 ${className}`} />;
}
