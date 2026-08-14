"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AccountStatus, AccountType, EmployeeResponse, FinancialAccountResponse } from "@expenses/shared";
import Link from "next/link";
import { Activity, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import AppShell from "../AppShell";
import { ExpandableSearch } from "../crud/ExpandableSearch";
import { CrudTable, type CrudTableColumn } from "../crud/CrudTable";
import { ConfirmDialog } from "../crud/ConfirmDialog";
import { Card } from "../ui/Card";
import { Dialog } from "../ui/Dialog";
import { KpiCard } from "../ui/KpiCard";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { MoneyInput } from "../ui/MoneyInput";
import { DateInput } from "../ui/DateInput";
import { useAuth } from "../../hooks/use-auth";
import { useAuthorization } from "../../hooks/use-authorization";
import { API_BASE_URL, fetchJson, formatMoney } from "../../lib/finance-demo";

const PAGE_SIZE = 8;

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "bank", label: "Banco" },
  { value: "cash", label: "Efectivo" },
  { value: "petty_cash", label: "Caja chica" },
  { value: "credit_card", label: "Tarjeta de credito" },
  { value: "debit_card", label: "Tarjeta de debito" },
  { value: "fuel_card", label: "Tarjeta de combustible" },
  { value: "loan", label: "Prestamo" },
  { value: "credit_line", label: "Linea de credito" },
  { value: "investment", label: "Inversion" },
  { value: "clearing", label: "Liquidacion" }
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<AccountType, string>;

const ACCOUNT_STATUS_OPTIONS: Array<{ value: AccountStatus; label: string }> = [
  { value: "active", label: "Activa" },
  { value: "inactive", label: "Inactiva" },
  { value: "closed", label: "Cerrada" }
];

const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Activa",
  inactive: "Inactiva",
  closed: "Cerrada"
};

type AccountFormState = {
  name: string;
  account_type: AccountType;
  bank_name: string;
  account_number: string;
  card_last4: string;
  owner_employee_id: string;
  currency: string;
  opening_balance: string;
  opening_balance_date: string;
  credit_limit: string;
  status: AccountStatus;
  notes: string;
};

function getTodayDate() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function createDefaultForm(): AccountFormState {
  return {
    name: "",
    account_type: "bank",
    bank_name: "",
    account_number: "",
    card_last4: "",
    owner_employee_id: "",
    currency: "MXN",
    opening_balance: "",
    opening_balance_date: getTodayDate(),
    credit_limit: "",
    status: "active",
    notes: ""
  };
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusBadgeClass(status: AccountStatus) {
  switch (status) {
    case "active":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "inactive":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "closed":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

export function AccountCrudPage() {
  const { activeCompany } = useAuth();
  const { isFinancialManager } = useAuthorization();
  const companyId = activeCompany?.id ?? "";
  const [accounts, setAccounts] = useState<FinancialAccountResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [form, setForm] = useState<AccountFormState>(() => createDefaultForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FinancialAccountResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FinancialAccountResponse | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setAccounts([]);
      setEmployees([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [accountsData, employeesData] = await Promise.all([
        fetchJson(`${API_BASE_URL}/accounts?company_id=${encodeURIComponent(targetCompanyId)}`),
        fetchJson(`${API_BASE_URL}/employees?company_id=${encodeURIComponent(targetCompanyId)}&limit=200`)
      ]);

      setAccounts((accountsData.accounts ?? []) as FinancialAccountResponse[]);
      setEmployees((employeesData.employees ?? []) as EmployeeResponse[]);
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

  const filteredAccounts = useMemo(() => {
    if (!deferredSearch) return accounts;

    return accounts.filter((account) => {
      const haystack = [
        account.name,
        account.bank_name,
        account.account_number,
        account.card_last4,
        account.owner_employee_name,
        account.currency,
        ACCOUNT_TYPE_LABELS[account.account_type],
        ACCOUNT_STATUS_LABELS[account.status]
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, accounts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredAccounts.length]);

  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAccounts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredAccounts]);

  const activeCount = useMemo(
    () => accounts.filter((account) => account.status === "active").length,
    [accounts]
  );
  const totalOpeningBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.opening_balance ?? 0), 0),
    [accounts]
  );
  const displayCurrency = accounts[0]?.currency ?? "MXN";

  const readOnly = !isFinancialManager;

  function resetForm() {
    setForm(createDefaultForm());
  }

  function closeFormDialog(force = false) {
    if (saving && !force) return;
    setIsFormOpen(false);
    setEditingItem(null);
    resetForm();
  }

  function openCreateDialog() {
    setEditingItem(null);
    resetForm();
    setIsFormOpen(true);
  }

  function openEditDialog(item: FinancialAccountResponse) {
    setEditingItem(item);
    setForm({
      name: item.name,
      account_type: item.account_type,
      bank_name: item.bank_name ?? "",
      account_number: item.account_number ?? "",
      card_last4: item.card_last4 ?? "",
      owner_employee_id: item.owner_employee_id ?? "",
      currency: item.currency ?? "MXN",
      opening_balance: String(item.opening_balance ?? ""),
      opening_balance_date: item.opening_balance_date ?? "",
      credit_limit: item.credit_limit === null ? "" : String(item.credit_limit),
      status: item.status,
      notes: item.notes ?? ""
    });
    setIsFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId) {
      setError("Selecciona una empresa activa antes de guardar.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        account_type: form.account_type,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        card_last4: form.card_last4.trim() || null,
        owner_employee_id: form.owner_employee_id || null,
        currency: form.currency.trim().toUpperCase() || "MXN",
        opening_balance: Number(form.opening_balance || 0),
        opening_balance_date: form.opening_balance_date || null,
        credit_limit: form.credit_limit === "" ? null : Number(form.credit_limit),
        status: form.status,
        notes: form.notes.trim() || null
      };
      const url = `${API_BASE_URL}/accounts${editingItem ? `/${editingItem.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;

      await fetchJson(url, {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setCurrentPage(1);
      closeFormDialog(true);
      await load(companyId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || !companyId) return;

    setDeleting(true);
    setError(null);

    try {
      await fetchJson(`${API_BASE_URL}/accounts/${pendingDelete.id}?company_id=${encodeURIComponent(companyId)}`, {
        method: "DELETE"
      });

      setPendingDelete(null);
      await load(companyId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  const tableColumns: Array<CrudTableColumn<FinancialAccountResponse>> = [
    {
      key: "account",
      header: "Cuenta",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">{item.name}</p>
          <p className="mt-1 text-xs text-slate-500">{ACCOUNT_TYPE_LABELS[item.account_type]}</p>
        </div>
      )
    },
    {
      key: "bank",
      header: "Banco / referencia",
      cell: (item) => (
        <div>
          <p className="font-medium text-white">{item.bank_name ?? "Sin banco"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {item.card_last4 ? `Termina en ${item.card_last4}` : item.account_number ?? ""}
          </p>
        </div>
      )
    },
    {
      key: "holder",
      header: "Titular",
      cell: (item) => (
        <p className="font-medium text-white">{item.owner_employee_name ?? "Sin titular"}</p>
      )
    },
    {
      key: "status",
      header: "Estado",
      cell: (item) => (
        <span
          className={cn(
            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
            getStatusBadgeClass(item.status)
          )}
        >
          {ACCOUNT_STATUS_LABELS[item.status]}
        </span>
      )
    },
    {
      key: "balance",
      header: "Saldo inicial",
      align: "right",
      cell: (item) => (
        <div>
          <p className="font-semibold text-cyan-300">{formatMoney(Number(item.opening_balance), item.currency || "MXN")}</p>
          <p className="mt-1 text-xs text-slate-500">{item.currency || "MXN"}</p>
        </div>
      )
    },
    {
      key: "notes",
      header: "Notas",
      cell: (item) => (
        <p className="max-w-xs text-sm leading-6 text-slate-300">{item.notes || "Sin notas"}</p>
      )
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (item) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            className="gap-2 px-3 py-2 text-xs"
            disabled={readOnly}
            onClick={() => openEditDialog(item)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="secondary"
            className="gap-2 border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-200 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100"
            disabled={readOnly}
            onClick={() => setPendingDelete(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      )
    }
  ];

  const inputClassName =
    "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20";

return (
    <AppShell
      eyebrow="Cuentas"
      title="Catalogo de cuentas"
      description="Administra las cuentas bancarias, tarjetas y fondos de efectivo que se usan como destino en los registros de ingresos y egresos."
    >
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <KpiCard
            label="Cuentas activas"
            value={String(activeCount)}
            metric={`${accounts.length} cuentas cargadas desde el backend.`}
          />
          <KpiCard
            label="Saldo inicial total"
            value={formatMoney(totalOpeningBalance, displayCurrency)}
            metric={"Suma de los saldos iniciales de todas las cuentas."}
          />        </div>

        <Card>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Cuentas registradas</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Catalogo de cuentas</h2>
              <p className="mt-2 text-sm text-slate-400">
                Revisa el estado de cada cuenta y entra a editar o eliminar sin salir de la tabla.
              </p>
              {companyId ? (
                <p className="mt-2 text-xs text-slate-500">Empresa activa: {activeCompany?.name ?? companyId}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Selecciona una empresa desde el encabezado para cargar las cuentas en la tabla.
                </p>
              )}
            </div>
            <div className="flex w-full min-w-0 flex-col items-end gap-3 lg:flex-1">
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  {filteredAccounts.length} visibles
                </span>
                {deferredSearch ? (
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                    Busqueda: {search}
                  </span>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <ExpandableSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Nombre, banco, tipo..."
                    ariaLabel="Buscar cuentas"
                    ringClassName="focus-within:ring-cyan-400/20"
                  />
                </div>
                <Button variant="secondary" className="shrink-0 gap-2" disabled={loading} onClick={() => void load(companyId)}>
                  <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                  {loading ? "Cargando..." : "Actualizar"}
                </Button>
                <Link
                  href="/accounts/movements"
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  <Activity className="h-4 w-4" />
                  Ver saldos
                </Link>
                <Button
                  className="shrink-0 gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
                  disabled={readOnly}
                  onClick={openCreateDialog}
                >
                  <Plus className="h-4 w-4" />
                  Agregar cuenta
                </Button>
              </div>
            </div>
          </div>

          <CrudTable
            columns={tableColumns}
            rows={paginatedAccounts}
            loading={loading}
            totalItems={filteredAccounts.length}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            emptyTitle="No se encontraron cuentas"
            emptyDescription="Crea tu primera cuenta y aparecera aqui al instante."
          />
        </Card>
      </div>

      <Dialog
        open={isFormOpen}
        onClose={closeFormDialog}
        title={editingItem ? "Editar cuenta" : "Agregar cuenta"}
        description={`Completa los campos para ${editingItem ? "actualizar" : "crear"} esta cuenta.`}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => closeFormDialog()}>
              Cancelar
            </Button>
            <Button
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
              disabled={saving || readOnly}
              type="submit"
              form="account-form"
            >
              {saving ? "Guardando..." : editingItem ? "Guardar cambios" : "Agregar cuenta"}
            </Button>
          </div>
        }
      >
        <form id="account-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Tipo de cuenta</label>
            <select
              value={form.account_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, account_type: event.target.value as AccountType }))
              }
              className={inputClassName}
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Banco</label>
            <input
              value={form.bank_name}
              onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))}
              placeholder="Nombre del banco"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Numero de cuenta</label>
            <input
              value={form.account_number}
              onChange={(event) => setForm((current) => ({ ...current, account_number: event.target.value }))}
              placeholder="0000 0000 0000"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Ultimos 4 digitos (tarjeta)</label>
            <input
              value={form.card_last4}
              onChange={(event) =>
                setForm((current) => ({ ...current, card_last4: event.target.value.replace(/\D/g, "").slice(0, 4) }))
              }
              placeholder="1234"
              maxLength={4}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Titular (empleado)</label>
            <select
              value={form.owner_employee_id}
              onChange={(event) => setForm((current) => ({ ...current, owner_employee_id: event.target.value }))}
              className={inputClassName}
            >
              <option value="">Sin titular asignado</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Moneda</label>
            <input
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              placeholder="MXN"
              maxLength={12}
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Estado</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as AccountStatus }))
              }
              className={inputClassName}
            >
              {ACCOUNT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Saldo inicial</label>
            <MoneyInput
              value={form.opening_balance}
              onChange={(value) => setForm((current) => ({ ...current, opening_balance: value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fecha saldo inicial</label>
            <DateInput
              value={form.opening_balance_date}
              onChange={(value) => setForm((current) => ({ ...current, opening_balance_date: value }))}
              placeholder="DD/MM/AAAA"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Limite de credito</label>
            <MoneyInput
              value={form.credit_limit}
              onChange={(value) => setForm((current) => ({ ...current, credit_limit: value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Notas</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Contexto opcional"
              rows={3}
              className={cn(inputClassName, "resize-none")}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar cuenta"
        description={pendingDelete ? `La cuenta "${pendingDelete.name}" se eliminara de este catalogo.` : ""}
        confirmLabel="Eliminar cuenta"
        loading={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </AppShell>
  );
}
