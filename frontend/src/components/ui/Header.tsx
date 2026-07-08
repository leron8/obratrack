import { Search, Calendar, Bell, ChevronDown } from "lucide-react";

export function Header() {
  return (
    <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm text-cyan-300">Gestion de construccion</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Panel de operaciones financieras</h1>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-3">
        <div className="relative flex items-center rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-soft">
          <Search className="mr-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar proyectos, facturas..."
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>

        <button className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 shadow-soft">
          <span>Ultimos 30 dias</span>
          <Calendar className="h-4 w-4 text-slate-400" />
        </button>

        <button className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 shadow-soft">
          <span>Todos los proyectos</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-slate-400 transition hover:border-cyan-400 hover:text-cyan-300">
          <Bell className="h-5 w-5" />
        </button>
        <button className="flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 shadow-soft">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">JD</span>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Jordan Doe</p>
            <p className="text-xs text-slate-500">Administrador de proyectos</p>
          </div>
        </button>
      </div>
    </div>
  );
}
