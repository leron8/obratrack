import Link from "next/link";
import { LayoutDashboard, Folder, DollarSign, Users, ClipboardList, Truck, Building2, FileText, Settings2, CalendarCheck, CreditCard } from "lucide-react";

const navItems = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/projects", label: "Proyectos", icon: Folder },
  { href: "/income", label: "Ingresos", icon: DollarSign },
  { href: "/expenses", label: "Gastos", icon: CreditCard },
  { href: "/employees", label: "Empleados", icon: Users },
  { href: "/payroll", label: "Nomina", icon: ClipboardList },
  { href: "/vehicles", label: "Vehiculos", icon: Truck },
  { href: "/suppliers", label: "Proveedores", icon: Building2 },
  { href: "/clients", label: "Clientes", icon: FileText },
  { href: "/reports", label: "Reportes", icon: CalendarCheck },
  { href: "/settings", label: "Configuracion", icon: Settings2 }
];

export function Sidebar() {
  return (
    <aside className="hidden h-full w-full max-w-[280px] shrink-0 border-r border-slate-800 bg-slate-950 px-5 py-6 lg:block">
      <div className="mb-10">
        <div className="mb-3 text-sm uppercase tracking-[0.3em] text-slate-500">ObraTrack</div>
        <div className="text-2xl font-semibold text-slate-100">SaaS de construccion</div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              <Icon className="h-4.5 w-4.5 text-slate-400 transition group-hover:text-cyan-400" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
