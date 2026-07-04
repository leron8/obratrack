"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Card } from "../../components/ui/Card";
import { API_BASE_URL, DEFAULT_COMPANY_ID, fetchJson, formatMoney, getRoleLabel, useDemoRole } from "../../lib/finance-demo";

const MOVEMENT_KIND_LABELS: Record<string, string> = {
  client_income: "Ingreso de cliente",
  cash_income: "Ingreso en efectivo",
  invoice_exchange: "Intercambio factura",
  partner_loan_repayment: "Pago préstamo socio",
  employee_loan_repayment: "Pago préstamo empleado"
};

const defaultForm = {
  description: "",
  amount: "",
  currency: "MXN",
  movement_kind: "client_income",
  account_id: "",
  notes: ""
};

export default function IncomePage() {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [movements, setMovements] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [role, setRole] = useDemoRole();

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [movData, accData] = await Promise.all([
        fetchJson(`${API_BASE_URL}/movements?company_id=${encodeURIComponent(companyId)}&direction=in`),
        fetchJson(`${API_BASE_URL}/accounts?company_id=${encodeURIComponent(companyId)}`)
      ]);
      setMovements(movData.movements ?? []);
      setAccounts(accData.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!companyId) {
      setError("Set a company ID first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        account_id: form.account_id || null,
        movement_date: new Date().toISOString().slice(0, 10),
        direction: "in" as const,
        movement_kind: form.movement_kind,
        amount: Number(form.amount),
        currency: form.currency,
        description: form.description || null,
        notes: form.notes || null
      };
      const url = `${API_BASE_URL}/movements${editingId ? `/${editingId}` : ""}?company_id=${encodeURIComponent(companyId)}`;
      await fetchJson(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-user-role": role },
        body: JSON.stringify(payload)
      });
      setForm(defaultForm);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(item: any) {
    setEditingId(item.id);
    setForm({
      description: item.description ?? "",
      amount: String(item.amount ?? ""),
      currency: item.currency ?? "MXN",
      movement_kind: item.movement_kind ?? "client_income",
      account_id: item.account_id ?? "",
      notes: item.notes ?? ""
    });
  }

  async function handleDelete(itemId: string) {
    if (!companyId) return;
    try {
      await fetchJson(`${API_BASE_URL}/movements/${itemId}?company_id=${encodeURIComponent(companyId)}`, {
        method: "DELETE",
        headers: { "x-user-role": role }
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const totalIncome = useMemo(() => movements.reduce((sum, row) => sum + Number(row.amount ?? 0), 0), [movements]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Income</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Manage incoming records</h1>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            Demo role: <span className="ml-2 font-semibold text-cyan-300">{getRoleLabel(role)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={submit} className="space-y-4">
            <input
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="Company ID"
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              required
            />
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount"
              type="number"
              step="0.01"
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              required
            />
            <select
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              required
            >
              <option value="">-- Select account --</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>
              ))}
            </select>
            <select
              value={form.movement_kind}
              onChange={(e) => setForm({ ...form, movement_kind: e.target.value })}
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
            >
              <option value="client_income">Ingreso de cliente</option>
              <option value="cash_income">Ingreso en efectivo</option>
              <option value="invoice_exchange">Intercambio factura</option>
              <option value="partner_loan_repayment">Pago préstamo socio</option>
              <option value="employee_loan_repayment">Pago préstamo empleado</option>
            </select>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes"
              className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
              rows={3}
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400">Demo role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "viewer")} className="rounded-3xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button disabled={saving || role !== "admin"} className="rounded-3xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update income record" : "Add income record"}
            </button>
          </form>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Current total</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatMoney(totalIncome, form.currency)}</p>
            <p className="mt-3 text-sm text-slate-400">Records shown below are loaded from the backend and will also appear in the dashboard.</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Income entries</h2>
          <span className="text-sm text-slate-400">{movements.length} records</span>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div className="space-y-3">
          {movements.map((item) => {
            const kindLabel = MOVEMENT_KIND_LABELS[item.movement_kind] ?? item.movement_kind;
            return (
              <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{item.description}</p>
                    <p className="mt-1 text-sm text-slate-500">{kindLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-600">Mov date: {item.movement_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-400">{formatMoney(Number(item.amount), item.currency || "MXN")}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("es-MX")}</p>
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => void handleEdit(item)} className="rounded-2xl border border-slate-700 px-3 py-2 text-xs text-slate-300">Edit</button>
                      <button onClick={() => void handleDelete(item.id)} className="rounded-2xl border border-rose-600/40 px-3 py-2 text-xs text-rose-300">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}