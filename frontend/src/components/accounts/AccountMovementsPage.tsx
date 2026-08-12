"use client";

import { useEffect, useState } from "react";
import type { AccountBalancesSummary, MovementResponse } from "@expenses/shared";
import { ArrowDownLeft, ArrowUpRight, RefreshCcw } from "lucide-react";
import AppShell from "../AppShell";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/use-auth";
import { API_BASE_URL, fetchJson, formatMoney } from "../../lib/finance-demo";

const MOVEMENT_KIND_LABELS: Record<string, string> = {
  client_income: "Ingreso de cliente",
  cash_income: "Ingreso en efectivo",
  invoice_exchange: "Intercambio de factura",
  partner_loan_repayment: "Pago de prestamo de socio",
  employee_loan_repayment: "Pago de prestamo de empleado",
  credit_line_disbursement: "Dispersion de linea de credito",
  expense: "Gasto general",
  supplier_payment: "Pago a proveedor",
  supplier_credit_purchase: "Compra a credito",
  fuel_expense: "Gasolina",
  payroll_payment: "Nomina",
  employee_loan_disbursement: "Prestamo a empleado",
  partner_loan_disbursement: "Prestamo de socio",
  card_funding: "Fondeo de tarjeta",
  bank_fee: "Comision bancaria",
  tax_payment: "Pago de impuestos",
  internal_transfer: "Transferencia interna",
  adjustment: "Ajuste"
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Banco",
  cash: "Efectivo",
  petty_cash: "Caja chica",
  credit_card: "Tarjeta de credito",
  debit_card: "Tarjeta de debito",
  fuel_card: "Tarjeta de combustible",
  loan: "Prestamo",
  credit_line: "Linea de credito",
  investment: "Inversion",
  clearing: "Liquidacion"
};

function SummaryRow({ label, amount, currency, tone }: { label: string; amount: number; currency: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/70 py-3 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cn("text-sm font-semibold", tone ?? "text-slate-100")}>
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

function runningBalance(movements: MovementResponse[]): Map<string, number> {
  const map = new Map<string, number>();
  let balance = 0;
  for (const m of movements) {
    balance += m.direction === "in" ? m.amount : -m.amount;
    map.set(m.id, balance);
  }
  return map;
}

export function AccountMovementsPage() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? "";
  const [summary, setSummary] = useState<AccountBalancesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson(
        `${API_BASE_URL}/accounts/balances?company_id=${encodeURIComponent(targetCompanyId)}`
      );
      setSummary(data as AccountBalancesSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const currency = summary?.currency ?? "MXN";

  return (
    <AppShell
      eyebrow="Cuentas"
      title="Movimientos y saldo de cuentas"
      description="Cuanto dinero hay en cada cuenta y como se llego a ese saldo: saldo inicial + ingresos - egresos."
    >
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="secondary" className="gap-2" disabled={loading} onClick={() => void load(companyId)}>
            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
            {loading ? "Cargando..." : "Actualizar saldos"}
          </Button>
        </div>

        {/* Resumen general de todas las cuentas */}
        <Card className="p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Todas las cuentas</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Saldos generales</h2>
          <p className="mt-2 text-sm text-slate-400">
            {companyId
              ? `Empresa activa: ${activeCompany?.name ?? companyId}`
              : "Selecciona una empresa desde el encabezado."}
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <SummaryRow label="Saldo inicial" amount={summary?.opening_total ?? 0} currency={currency} />
              <SummaryRow label="Ingresos" amount={summary?.income_total ?? 0} currency={currency} tone="text-emerald-300" />
              <SummaryRow label="Egresos" amount={summary?.expense_total ?? 0} currency={currency} tone="text-rose-300" />
              <SummaryRow label="Saldo actual" amount={summary?.current_total ?? 0} currency={currency} tone="text-cyan-300" />
            </div>
            <div className="flex items-center justify-center rounded-[28px] border border-cyan-500/20 bg-cyan-500/10 p-6 text-center">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Saldo actual total</p>
                <p className="mt-2 text-3xl font-semibold text-cyan-200">
                  {loading ? "..." : formatMoney(summary?.current_total ?? 0, currency)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Detalle por cuenta */}
        {loading ? (
          <Card className="p-6 text-center text-sm text-slate-400">Cargando saldos por cuenta...</Card>
        ) : !summary || summary.accounts.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-400">
            No hay cuentas activas con movimientos para mostrar.
          </Card>
        ) : (
          summary.accounts.map((account) => {
            const balances = runningBalance(account.movements);
            return (
              <Card key={account.account_id} className="overflow-hidden p-0">
                <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{account.account_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-cyan-200">
                    {formatMoney(account.current_balance, account.currency || currency)}
                  </p>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-2">
                  <div>
                    <div className="rounded-[24px] border border-slate-800 bg-slate-950/40 p-5">
                      <SummaryRow label="Saldo inicial" amount={account.opening_balance} currency={account.currency || currency} />
                      <SummaryRow
                        label="Ingresos"
                        amount={account.income_total}
                        currency={account.currency || currency}
                        tone="text-emerald-300"
                      />
                      <SummaryRow
                        label="Egresos"
                        amount={account.expense_total}
                        currency={account.currency || currency}
                        tone="text-rose-300"
                      />
                      <SummaryRow
                        label="Egresos a proyectos"
                        amount={account.project_expense_total}
                        currency={account.currency || currency}
                        tone="text-amber-300"
                      />
                      <SummaryRow
                        label="Saldo actual"
                        amount={account.current_balance}
                        currency={account.currency || currency}
                        tone="text-cyan-300"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 pb-3 text-sm text-slate-300">Movimientos de la cuenta</div>
                    {account.movements.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-[24px] border border-slate-800">
                        <table className="w-full border-collapse text-sm">
                          <thead className="bg-slate-950/80">
                            <tr className="border-b border-slate-800">
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fecha</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Concepto</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Proyecto</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ingreso/Egreso</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.movements.map((m) => {
                              const kindLabel = MOVEMENT_KIND_LABELS[m.movement_kind] ?? m.movement_kind;
                              const isIn = m.direction === "in";
                              return (
                                <tr key={m.id} className="border-b border-slate-800/70 last:border-b-0">
                                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">{m.movement_date}</td>
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium text-slate-200">{m.description || kindLabel}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{kindLabel}</p>
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-300">{m.project_name ?? "—"}</td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 font-semibold",
                                        isIn ? "text-emerald-300" : "text-rose-300"
                                      )}
                                    >
                                      {isIn ? (
                                        <ArrowDownLeft className="h-3.5 w-3.5" />
                                      ) : (
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                      )}
                                      {formatMoney(m.amount, m.currency || currency)}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-100">
                                    {formatMoney(balances.get(m.id) ?? 0, m.currency || currency)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
