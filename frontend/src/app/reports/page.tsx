"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";
import AppShell from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { KpiCard } from "../../components/ui/KpiCard";
import { Skeleton } from "../../components/ui/Skeleton";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
const DEFAULT_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || "";

function formatMoney(amount: number, currency = "MXN") {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

type ReportTab = "profitability" | "expenses" | "income" | "cashflow" | "suppliers" | "fuel";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "profitability", label: "Rentabilidad" },
  { id: "expenses", label: "Gastos" },
  { id: "income", label: "Ingresos" },
  { id: "cashflow", label: "Flujo" },
  { id: "suppliers", label: "Créditos" },
  { id: "fuel", label: "Combustible" }
];

function getDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: now.toISOString().slice(0, 10)
  };
}

export default function ReportsPage() {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [activeTab, setActiveTab] = useState<ReportTab>("profitability");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const inFlight = useRef(false);

  // Filters
  const [startDate, setStartDate] = useState(getDefaultDates().start_date);
  const [endDate, setEndDate] = useState(getDefaultDates().end_date);
  const [projectFilter, setProjectFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");

  const loadData = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      if (!companyId) {
        setError("Configura el ID de empresa.");
        setData(null);
        return;
      }

      const params = new URLSearchParams({ company_id: companyId });
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (projectFilter) params.set("project_id", projectFilter);
      if (accountFilter && activeTab === "cashflow") params.set("account_id", accountFilter);

      let endpoint = "";
      switch (activeTab) {
        case "profitability": endpoint = "project-profitability"; break;
        case "expenses": endpoint = "expenses-by-project"; break;
        case "income": endpoint = "income-by-project"; break;
        case "cashflow": endpoint = "cash-flow"; break;
        case "suppliers": endpoint = "supplier-credit"; break;
        case "fuel": endpoint = "fuel-consumption"; break;
      }

      const res = await fetch(`${API_BASE_URL}/reports/${endpoint}?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || res.statusText);
      }

      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [companyId, activeTab, startDate, endDate, projectFilter, accountFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const chartData = useMemo(() => {
    if (!data) return null;

    if (activeTab === "profitability" && data.projects) {
      const projects = data.projects as any[];
      return {
        labels: projects.map((p: any) => p.project_name),
        datasets: [
          {
            label: "Ingresos",
            data: projects.map((p: any) => p.total_income),
            backgroundColor: "rgba(34, 197, 94, 0.65)"
          },
          {
            label: "Gastos totales",
            data: projects.map((p: any) => p.total_expenses),
            backgroundColor: "rgba(239, 68, 68, 0.65)"
          },
          {
            label: "Utilidad neta",
            data: projects.map((p: any) => p.net_profit),
            backgroundColor: "rgba(59, 130, 246, 0.65)"
          }
        ]
      };
    }

    if (activeTab === "expenses" && Array.isArray(data)) {
      const rows = data as any[];
      const cats = [...new Set(rows.map((r: any) => r.category))].slice(0, 8);
      const projs = [...new Set(rows.map((r: any) => r.project_name))].slice(0, 8);

      return {
        labels: cats,
        datasets: [{
          label: "Monto",
          data: cats.map(c => rows.filter((r: any) => r.category === c).reduce((s: number, r: any) => s + r.amount, 0)),
          backgroundColor: "rgba(239, 68, 68, 0.65)"
        }]
      };
    }

    if (activeTab === "income" && Array.isArray(data)) {
      const rows = data as any[];
      return {
        labels: rows.map((r: any) => r.project_name),
        datasets: [{
          label: "Ingresos",
          data: rows.map((r: any) => r.total_income),
          backgroundColor: "rgba(34, 197, 94, 0.65)"
        }]
      };
    }

    if (activeTab === "cashflow" && Array.isArray(data)) {
      const rows = data as any[];
      return {
        labels: rows.map((r: any) => r.account_name),
        datasets: [
          {
            label: "Saldo inicial",
            data: rows.map((r: any) => r.opening_balance),
            backgroundColor: "rgba(59, 130, 246, 0.4)"
          },
          {
            label: "Saldo final",
            data: rows.map((r: any) => r.closing_balance),
            backgroundColor: "rgba(34, 197, 94, 0.4)"
          }
        ]
      };
    }

    if (activeTab === "fuel" && Array.isArray(data)) {
      const rows = data as any[];
      return {
        labels: rows.map((r: any) => r.vehicle_plate || r.vehicle_name),
        datasets: [{
          label: "Litros",
          data: rows.map((r: any) => r.total_liters),
          backgroundColor: "rgba(251, 191, 36, 0.65)"
        }]
      };
    }

    return null;
  }, [data, activeTab]);

  const exportCSV = () => {
    if (!data) return;
    let csv = "";
    const rows = Array.isArray(data) ? data : (data as any)?.projects ?? [];

    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    csv += headers.join(",") + "\n";
    for (const row of rows) {
      csv += headers.map((h: string) => String(row[h] ?? "")).join(",") + "\n";
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${activeTab}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      eyebrow="Financial Intelligence"
      title="Módulo de Reportes"
      description="Analiza la rentabilidad por obra, gastos, ingresos, flujo de efectivo, créditos y consumo de combustible."
    >
      <div className="space-y-6">
        {/* Company ID + Filters */}
        <div className="grid gap-4 rounded-[32px] border border-slate-800 bg-slate-950 p-5 shadow-soft md:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-1">
            <p className="text-xs text-cyan-300">ID Empresa</p>
            <input
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="UUID"
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Desde</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Hasta</p>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>
          <button
            onClick={() => void loadData()}
            className="h-11 rounded-3xl bg-cyan-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Actualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-3xl px-5 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {data && (
            <button
              onClick={exportCSV}
              className="ml-auto rounded-3xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              Exportar CSV
            </button>
          )}
        </div>

        {/* Error */}
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : null}

        {/* Content */}
        {!loading && data ? (
          <>
            {/* KPI Cards */}
            {activeTab === "profitability" && data.totals ? (
              <div className="grid gap-4 md:grid-cols-4">
                <KpiCard label="Ingresos totales" value={formatMoney(data.totals.total_income)} metric="Período" />
                <KpiCard label="Gastos totales" value={formatMoney(data.totals.total_expenses)} metric="Período" />
                <KpiCard label="Utilidad neta" value={formatMoney(data.totals.net_profit)} metric="Período" />
                <KpiCard label="Margen" value={formatPercent(data.totals.profit_margin_pct)} metric="Promedio" />
              </div>
            ) : null}

            {activeTab === "cashflow" && Array.isArray(data) ? (
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard
                  label="Saldo inicial total"
                  value={formatMoney(data.reduce((s: number, r: any) => s + r.opening_balance, 0))}
                  metric="Período"
                />
                <KpiCard
                  label="Saldo final total"
                  value={formatMoney(data.reduce((s: number, r: any) => s + r.closing_balance, 0))}
                  metric="Período"
                />
                <KpiCard
                  label="Cambio neto"
                  value={formatMoney(data.reduce((s: number, r: any) => s + r.net_change, 0))}
                  metric="Período"
                />
              </div>
            ) : null}

            {activeTab === "fuel" && Array.isArray(data) ? (
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard
                  label="Total litros"
                  value={`${data.reduce((s: number, r: any) => s + r.total_liters, 0).toFixed(1)} L`}
                  metric="Período"
                />
                <KpiCard
                  label="Total gasto"
                  value={formatMoney(data.reduce((s: number, r: any) => s + r.total_amount, 0))}
                  metric="Período"
                />
                <KpiCard
                  label="Transacciones"
                  value={String(data.reduce((s: number, r: any) => s + r.transaction_count, 0))}
                  metric="Período"
                />
              </div>
            ) : null}

            {/* Chart */}
            {chartData && (
              <Card>
                <div className="mb-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Gráfico</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {activeTab === "profitability" && "Rentabilidad por obra"}
                    {activeTab === "expenses" && "Gastos por categoría"}
                    {activeTab === "income" && "Ingresos por obra"}
                    {activeTab === "cashflow" && "Flujo de efectivo por cuenta"}
                    {activeTab === "fuel" && "Consumo de combustible"}
                  </h2>
                </div>
                <div className="h-[350px]">
                  {activeTab === "cashflow" ? (
                    <Bar data={chartData as any} options={{ responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: false } } }} />
                  ) : activeTab === "fuel" ? (
                    <Bar data={chartData as any} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
                  ) : (
                    <Bar data={chartData as any} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
                  )}
                </div>
              </Card>
            )}

            {/* Data Table */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Datos</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {activeTab === "profitability" && "Detalle de rentabilidad por obra"}
                    {activeTab === "expenses" && "Gastos por obra y categoría"}
                    {activeTab === "income" && "Ingresos por obra"}
                    {activeTab === "cashflow" && "Flujo de efectivo detallado"}
                    {activeTab === "suppliers" && "Créditos de proveedores"}
                    {activeTab === "fuel" && "Consumo de combustible detallado"}
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {data.totals ? `${(data.projects ?? []).length} obras` : Array.isArray(data) ? `${data.length} registros` : ""}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                      {activeTab === "profitability" && (
                        <>
                          <th className="px-3 py-3">Obra</th>
                          <th className="px-3 py-3 text-right">Ingresos</th>
                          <th className="px-3 py-3 text-right">Costos</th>
                          <th className="px-3 py-3 text-right">Nómina</th>
                          <th className="px-3 py-3 text-right">Combustible</th>
                          <th className="px-3 py-3 text-right">Gastos totales</th>
                          <th className="px-3 py-3 text-right">Overhead</th>
                          <th className="px-3 py-3 text-right">Utilidad</th>
                          <th className="px-3 py-3 text-right">Margen</th>
                        </>
                      )}
                      {activeTab === "expenses" && (
                        <>
                          <th className="px-3 py-3">Obra</th>
                          <th className="px-3 py-3">Categoría</th>
                          <th className="px-3 py-3 text-right">Monto</th>
                          <th className="px-3 py-3 text-right">Movimientos</th>
                        </>
                      )}
                      {activeTab === "income" && (
                        <>
                          <th className="px-3 py-3">Obra</th>
                          <th className="px-3 py-3 text-right">Ingresos</th>
                          <th className="px-3 py-3 text-right">Movimientos</th>
                        </>
                      )}
                      {activeTab === "cashflow" && (
                        <>
                          <th className="px-3 py-3">Cuenta</th>
                          <th className="px-3 py-3">Tipo</th>
                          <th className="px-3 py-3 text-right">Saldo inicial</th>
                          <th className="px-3 py-3 text-right">Ingresos</th>
                          <th className="px-3 py-3 text-right">Egresos</th>
                          <th className="px-3 py-3 text-right">Cambio neto</th>
                          <th className="px-3 py-3 text-right">Saldo final</th>
                        </>
                      )}
                      {activeTab === "suppliers" && (
                        <>
                          <th className="px-3 py-3">Proveedor</th>
                          <th className="px-3 py-3">Línea de crédito</th>
                          <th className="px-3 py-3 text-right">Límite</th>
                          <th className="px-3 py-3 text-right">Compras</th>
                          <th className="px-3 py-3 text-right">Pagos</th>
                          <th className="px-3 py-3 text-right">Saldo</th>
                          <th className="px-3 py-3 text-right">Disponible</th>
                        </>
                      )}
                      {activeTab === "fuel" && (
                        <>
                          <th className="px-3 py-3">Vehículo</th>
                          <th className="px-3 py-3">Placas</th>
                          <th className="px-3 py-3">Obra</th>
                          <th className="px-3 py-3">Producto</th>
                          <th className="px-3 py-3 text-right">Litros</th>
                          <th className="px-3 py-3 text-right">Monto</th>
                          <th className="px-3 py-3 text-right">Transacciones</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === "profitability" && (data.projects ?? []).map((p: any) => (
                      <tr key={p.project_id} className="border-b border-slate-800/50 transition hover:bg-slate-900/50">
                        <td className="px-3 py-3 font-medium text-white">{p.project_name}</td>
                        <td className="px-3 py-3 text-right text-emerald-400">{formatMoney(p.total_income)}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(p.total_direct_costs)}</td>
                        <td className="px-3 py-3 text-right text-rose-300">{formatMoney(p.total_payroll)}</td>
                        <td className="px-3 py-3 text-right text-yellow-400">{formatMoney(p.total_fuel)}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(p.total_expenses)}</td>
                        <td className="px-3 py-3 text-right text-slate-400">{formatMoney(p.overhead_allocated)}</td>
                        <td className={`px-3 py-3 text-right font-semibold ${p.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatMoney(p.net_profit)}
                        </td>
                        <td className={`px-3 py-3 text-right font-semibold ${p.profit_margin_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatPercent(p.profit_margin_pct)}
                        </td>
                      </tr>
                    ))}
                    {activeTab === "expenses" && Array.isArray(data) && data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50 transition hover:bg-slate-900/50">
                        <td className="px-3 py-3 font-medium text-white">{r.project_name}</td>
                        <td className="px-3 py-3 text-slate-300">{r.category}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(r.amount)}</td>
                        <td className="px-3 py-3 text-right text-slate-400">{r.count}</td>
                      </tr>
                    ))}
                    {activeTab === "income" && Array.isArray(data) && data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50 transition hover:bg-slate-900/50">
                        <td className="px-3 py-3 font-medium text-white">{r.project_name}</td>
                        <td className="px-3 py-3 text-right text-emerald-400">{formatMoney(r.total_income)}</td>
                        <td className="px-3 py-3 text-right text-slate-400">{r.movement_count}</td>
                      </tr>
                    ))}
                    {activeTab === "cashflow" && Array.isArray(data) && data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50 transition hover:bg-slate-900/50">
                        <td className="px-3 py-3 font-medium text-white">{r.account_name}</td>
                        <td className="px-3 py-3 text-slate-400">{r.account_type}</td>
                        <td className="px-3 py-3 text-right text-slate-300">{formatMoney(r.opening_balance)}</td>
                        <td className="px-3 py-3 text-right text-emerald-400">{formatMoney(r.total_in)}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(r.total_out)}</td>
                        <td className={`px-3 py-3 text-right font-medium ${r.net_change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatMoney(r.net_change)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-white">{formatMoney(r.closing_balance)}</td>
                      </tr>
                    ))}
                    {activeTab === "suppliers" && Array.isArray(data) && data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50 transition hover:bg-slate-900/50">
                        <td className="px-3 py-3 font-medium text-white">{r.supplier_name}</td>
                        <td className="px-3 py-3 text-slate-300">{r.credit_account_name}</td>
                        <td className="px-3 py-3 text-right text-slate-300">{formatMoney(r.credit_limit)}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(r.total_purchases)}</td>
                        <td className="px-3 py-3 text-right text-emerald-400">{formatMoney(r.total_payments)}</td>
                        <td className="px-3 py-3 text-right font-medium text-yellow-400">{formatMoney(r.current_balance)}</td>
                        <td className="px-3 py-3 text-right font-medium text-emerald-400">{formatMoney(r.available_credit)}</td>
                      </tr>
                    ))}
                    {activeTab === "fuel" && Array.isArray(data) && data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-slate-800/50 transition hover:bg-slate-900/50">
                        <td className="px-3 py-3 font-medium text-white">{r.vehicle_name}</td>
                        <td className="px-3 py-3 text-slate-300">{r.vehicle_plate || "—"}</td>
                        <td className="px-3 py-3 text-slate-300">{r.project_name || "—"}</td>
                        <td className="px-3 py-3 text-slate-300">{r.product}</td>
                        <td className="px-3 py-3 text-right text-yellow-400">{r.total_liters.toFixed(1)} L</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(r.total_amount)}</td>
                        <td className="px-3 py-3 text-right text-slate-400">{r.transaction_count}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row for profitability */}
                  {activeTab === "profitability" && data.totals && (
                    <tfoot>
                      <tr className="border-t-2 border-cyan-500/30 bg-slate-900/80 text-sm font-semibold">
                        <td className="px-3 py-3 text-cyan-300">TOTALES</td>
                        <td className="px-3 py-3 text-right text-emerald-400">{formatMoney(data.totals.total_income)}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(data.totals.total_direct_costs)}</td>
                        <td className="px-3 py-3 text-right text-rose-300">{formatMoney(data.totals.total_payroll)}</td>
                        <td className="px-3 py-3 text-right text-yellow-400">{formatMoney(data.totals.total_fuel)}</td>
                        <td className="px-3 py-3 text-right text-rose-400">{formatMoney(data.totals.total_expenses)}</td>
                        <td className="px-3 py-3 text-right text-slate-400">{formatMoney(data.totals.overhead_allocated)}</td>
                        <td className={`px-3 py-3 text-right ${data.totals.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatMoney(data.totals.net_profit)}
                        </td>
                        <td className={`px-3 py-3 text-right ${data.totals.profit_margin_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatPercent(data.totals.profit_margin_pct)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </>
        ) : null}

        {!loading && !data && !error ? (
          <Card>
            <div className="flex h-40 items-center justify-center text-slate-500">
              Selecciona un reporte y haz clic en "Actualizar"
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}