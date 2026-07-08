"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  EmployeeLoanBalance,
  EmployeeResponse,
  PaymentMethod,
  PayrollLine,
  PayrollRun,
  PayrollStatus,
  ProjectResponse
} from "@expenses/shared";
import { CalendarRange, Pencil, Plus, RefreshCcw, Search, Trash2, WalletCards } from "lucide-react";
import AppShell from "../AppShell";
import { CrudTable, type CrudTableColumn } from "../crud/CrudTable";
import { ConfirmDialog } from "../crud/ConfirmDialog";
import { Card } from "../ui/Card";
import { Dialog } from "../ui/Dialog";
import { KpiCard } from "../ui/KpiCard";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import {
  API_BASE_URL,
  DEFAULT_COMPANY_ID,
  fetchJson,
  formatMoney,
  getRoleLabel,
  useDemoRole
} from "../../lib/finance-demo";

const PAGE_SIZE = 8;

const STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  paid: "Pagada",
  cancelled: "Cancelada"
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  card: "Tarjeta",
  cheque: "Cheque",
  fuel_card: "Tarjeta de combustible",
  credit: "Credito",
  payroll_discount: "Descuento via nomina",
  other: "Otro"
};

type PayrollRunFormState = {
  run_number: string;
  week_number: string;
  period_start: string;
  period_end: string;
  status: PayrollStatus;
  description: string;
};

type PayrollLineFormState = {
  employee_id: string;
  worker_name: string;
  project_id: string;
  role_or_task: string;
  days_worked: string;
  gross_amount: string;
  loan_deduction_amount: string;
  other_deduction_amount: string;
  payment_method: PaymentMethod;
  notes: string;
  source_row: string;
};

function getTodayDate() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function createDefaultRunForm(): PayrollRunFormState {
  const today = getTodayDate();
  return {
    run_number: "",
    week_number: "",
    period_start: today,
    period_end: today,
    status: "draft",
    description: ""
  };
}

function createDefaultLineForm(): PayrollLineFormState {
  return {
    employee_id: "",
    worker_name: "",
    project_id: "",
    role_or_task: "",
    days_worked: "",
    gross_amount: "",
    loan_deduction_amount: "",
    other_deduction_amount: "",
    payment_method: "cash",
    notes: "",
    source_row: ""
  };
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Sin fecha";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} - ${formatDate(end)}`;
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

function getStatusBadgeClass(status: PayrollStatus) {
  switch (status) {
    case "draft":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "approved":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
    case "paid":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "cancelled":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

export function PayrollCrudPage() {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [companyIdInput, setCompanyIdInput] = useState(DEFAULT_COMPANY_ID);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loanBalances, setLoanBalances] = useState<EmployeeLoanBalance[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runForm, setRunForm] = useState<PayrollRunFormState>(() => createDefaultRunForm());
  const [lineForm, setLineForm] = useState<PayrollLineFormState>(() => createDefaultLineForm());
  const [loading, setLoading] = useState(Boolean(DEFAULT_COMPANY_ID));
  const [savingRun, setSavingRun] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [deletingRun, setDeletingRun] = useState(false);
  const [deletingLine, setDeletingLine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRun, setEditingRun] = useState<PayrollRun | null>(null);
  const [editingLine, setEditingLine] = useState<PayrollLine | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isLineDialogOpen, setIsLineDialogOpen] = useState(false);
  const [pendingDeleteRun, setPendingDeleteRun] = useState<PayrollRun | null>(null);
  const [pendingDeleteLine, setPendingDeleteLine] = useState<PayrollLine | null>(null);
  const [runSearch, setRunSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [role, setRole] = useDemoRole();
  const deferredRunSearch = useDeferredValue(runSearch.trim().toLowerCase());
  const deferredLineSearch = useDeferredValue(lineSearch.trim().toLowerCase());

  async function load(targetCompanyId = companyId, preferredRunId: string | null = selectedRunId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setRuns([]);
      setLines([]);
      setEmployees([]);
      setProjects([]);
      setLoanBalances([]);
      setSelectedRunId(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [runsData, employeesData, projectsData, balancesData] = await Promise.all([
        fetchJson(`${API_BASE_URL}/payroll-runs?company_id=${encodeURIComponent(targetCompanyId)}&limit=120`),
        fetchJson(`${API_BASE_URL}/employees?company_id=${encodeURIComponent(targetCompanyId)}&limit=250`),
        fetchJson(`${API_BASE_URL}/projects?company_id=${encodeURIComponent(targetCompanyId)}&limit=250`),
        fetchJson(`${API_BASE_URL}/employee-loans/balances?company_id=${encodeURIComponent(targetCompanyId)}`)
      ]);

      const nextRuns = (runsData.runs ?? []) as PayrollRun[];
      const nextEmployees = (employeesData.employees ?? []) as EmployeeResponse[];
      const nextProjects = (projectsData.projects ?? []) as ProjectResponse[];
      const nextLoanBalances = (balancesData.balances ?? []) as EmployeeLoanBalance[];
      const nextSelectedRunId =
        preferredRunId && nextRuns.some((run) => run.id === preferredRunId)
          ? preferredRunId
          : nextRuns[0]?.id ?? null;

      let nextLines: PayrollLine[] = [];
      if (nextSelectedRunId) {
        const linesData = await fetchJson(
          `${API_BASE_URL}/payroll-runs/${nextSelectedRunId}/lines?company_id=${encodeURIComponent(targetCompanyId)}`
        );
        nextLines = (linesData.lines ?? []) as PayrollLine[];
      }

      setRuns(nextRuns);
      setEmployees(nextEmployees);
      setProjects(nextProjects);
      setLoanBalances(nextLoanBalances);
      setSelectedRunId(nextSelectedRunId);
      setLines(nextLines);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(companyId, selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filteredRuns = useMemo(() => {
    if (!deferredRunSearch) return runs;

    return runs.filter((run) => {
      const haystack = [
        run.run_number,
        run.description,
        run.week_number ? `semana ${run.week_number}` : "",
        STATUS_LABELS[run.status],
        run.period_start,
        run.period_end
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredRunSearch);
    });
  }, [deferredRunSearch, runs]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const filteredLines = useMemo(() => {
    if (!deferredLineSearch) return lines;

    return lines.filter((line) => {
      const haystack = [
        line.employee_name,
        line.employee_code,
        line.worker_name,
        line.project_name,
        line.project_code,
        line.role_or_task,
        line.notes,
        PAYMENT_METHOD_LABELS[line.payment_method]
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredLineSearch);
    });
  }, [deferredLineSearch, lines]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRunId, deferredLineSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredLines.length]);

  const paginatedLines = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLines.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredLines]);

  const activeLoanSummary = useMemo(() => {
    if (!lineForm.employee_id) return { count: 0, balance: 0 };
    const employeeBalances = loanBalances.filter((balance) => balance.employee_id === lineForm.employee_id);
    return {
      count: employeeBalances.length,
      balance: employeeBalances.reduce((sum, balance) => sum + Number(balance.balance_amount ?? 0), 0)
    };
  }, [lineForm.employee_id, loanBalances]);

  const selectedRunGross = selectedRun?.gross_total ?? lines.reduce((sum, line) => sum + Number(line.gross_amount ?? 0), 0);
  const selectedRunLoans =
    selectedRun?.loan_deductions_total ?? lines.reduce((sum, line) => sum + Number(line.loan_deduction_amount ?? 0), 0);
  const selectedRunOther =
    selectedRun?.other_deductions_total ?? lines.reduce((sum, line) => sum + Number(line.other_deduction_amount ?? 0), 0);
  const selectedRunNet = selectedRun?.net_total ?? lines.reduce((sum, line) => sum + Number(line.net_amount ?? 0), 0);
  const latestRunUpdate = selectedRun?.updated_at
    ? formatDateTime(selectedRun.updated_at)
    : runs[0]?.updated_at
      ? formatDateTime(runs[0].updated_at)
      : "Sin actividad reciente";
  const readOnly = role !== "admin";

  function resetRunForm() {
    setRunForm(createDefaultRunForm());
  }

  function resetLineForm() {
    setLineForm(createDefaultLineForm());
  }

  function closeRunDialog(force = false) {
    if (savingRun && !force) return;
    setIsRunDialogOpen(false);
    setEditingRun(null);
    resetRunForm();
  }

  function closeLineDialog(force = false) {
    if (savingLine && !force) return;
    setIsLineDialogOpen(false);
    setEditingLine(null);
    resetLineForm();
  }

  function openCreateRunDialog() {
    setEditingRun(null);
    resetRunForm();
    setIsRunDialogOpen(true);
  }

  function openEditRunDialog(item: PayrollRun) {
    setEditingRun(item);
    setRunForm({
      run_number: item.run_number ?? "",
      week_number: item.week_number === null ? "" : String(item.week_number),
      period_start: item.period_start,
      period_end: item.period_end,
      status: item.status,
      description: item.description ?? ""
    });
    setIsRunDialogOpen(true);
  }

  function openCreateLineDialog() {
    if (!selectedRun) {
      setError("Primero crea o selecciona una corrida de nomina.");
      return;
    }

    setEditingLine(null);
    resetLineForm();
    setIsLineDialogOpen(true);
  }

  function openEditLineDialog(item: PayrollLine) {
    setEditingLine(item);
    setLineForm({
      employee_id: item.employee_id ?? "",
      worker_name: item.worker_name ?? "",
      project_id: item.project_id ?? "",
      role_or_task: item.role_or_task ?? "",
      days_worked: item.days_worked === null ? "" : String(item.days_worked),
      gross_amount: String(item.gross_amount),
      loan_deduction_amount: String(item.loan_deduction_amount),
      other_deduction_amount: String(item.other_deduction_amount),
      payment_method: item.payment_method,
      notes: item.notes ?? "",
      source_row: item.source_row === null ? "" : String(item.source_row)
    });
    setIsLineDialogOpen(true);
  }

  async function submitRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId) {
      setError("Primero define un ID de empresa.");
      return;
    }

    setSavingRun(true);
    setError(null);

    try {
      const payload = {
        run_number: runForm.run_number.trim() || null,
        week_number: runForm.week_number === "" ? null : Number(runForm.week_number),
        period_start: runForm.period_start,
        period_end: runForm.period_end,
        status: runForm.status,
        description: runForm.description.trim() || null
      };

      const url = `${API_BASE_URL}/payroll-runs${editingRun ? `/${editingRun.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;
      const response = (await fetchJson(url, {
        method: editingRun ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-user-role": role },
        body: JSON.stringify(payload)
      })) as { run: PayrollRun };

      closeRunDialog(true);
      await load(companyId, response.run.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSavingRun(false);
    }
  }

  async function submitLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId || !selectedRun) {
      setError("Primero selecciona una corrida de nomina.");
      return;
    }

    setSavingLine(true);
    setError(null);

    try {
      const payload = {
        employee_id: lineForm.employee_id || null,
        worker_name: lineForm.worker_name.trim() || null,
        project_id: lineForm.project_id || null,
        role_or_task: lineForm.role_or_task.trim() || null,
        days_worked: lineForm.days_worked === "" ? null : Number(lineForm.days_worked),
        gross_amount: Number(lineForm.gross_amount),
        loan_deduction_amount: lineForm.loan_deduction_amount === "" ? 0 : Number(lineForm.loan_deduction_amount),
        other_deduction_amount: lineForm.other_deduction_amount === "" ? 0 : Number(lineForm.other_deduction_amount),
        payment_method: lineForm.payment_method,
        notes: lineForm.notes.trim() || null,
        source_row: lineForm.source_row === "" ? null : Number(lineForm.source_row)
      };

      const url = editingLine
        ? `${API_BASE_URL}/payroll-lines/${editingLine.id}?company_id=${encodeURIComponent(companyId)}`
        : `${API_BASE_URL}/payroll-runs/${selectedRun.id}/lines?company_id=${encodeURIComponent(companyId)}`;

      await fetchJson(url, {
        method: editingLine ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-user-role": role },
        body: JSON.stringify(payload)
      });

      closeLineDialog(true);
      await load(companyId, selectedRun.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSavingLine(false);
    }
  }

  async function confirmDeleteRun() {
    if (!pendingDeleteRun || !companyId) return;

    setDeletingRun(true);
    setError(null);

    try {
      await fetchJson(
        `${API_BASE_URL}/payroll-runs/${pendingDeleteRun.id}?company_id=${encodeURIComponent(companyId)}`,
        {
          method: "DELETE",
          headers: { "x-user-role": role }
        }
      );

      setPendingDeleteRun(null);
      const fallbackRunId = selectedRunId === pendingDeleteRun.id ? null : selectedRunId;
      await load(companyId, fallbackRunId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingRun(false);
    }
  }

  async function confirmDeleteLine() {
    if (!pendingDeleteLine || !companyId || !selectedRun) return;

    setDeletingLine(true);
    setError(null);

    try {
      await fetchJson(
        `${API_BASE_URL}/payroll-lines/${pendingDeleteLine.id}?company_id=${encodeURIComponent(companyId)}`,
        {
          method: "DELETE",
          headers: { "x-user-role": role }
        }
      );

      setPendingDeleteLine(null);
      await load(companyId, selectedRun.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingLine(false);
    }
  }

  function handleCompanySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCompanyId = companyIdInput.trim();

    if (nextCompanyId === companyId) {
      void load(nextCompanyId, selectedRunId);
      return;
    }

    setCompanyId(nextCompanyId);
  }

  function handleSelectRun(runId: string) {
    if (runId === selectedRunId) return;
    setSelectedRunId(runId);
    setLines([]);
    void load(companyId, runId);
  }

  function handleEmployeeChange(nextEmployeeId: string) {
    const employee = employees.find((item) => item.id === nextEmployeeId);
    setLineForm((current) => ({
      ...current,
      employee_id: nextEmployeeId,
      worker_name:
        nextEmployeeId && (!current.worker_name || current.worker_name === employee?.full_name || current.worker_name === "")
          ? employee?.full_name ?? ""
          : current.worker_name
    }));
  }

  const lineNetPreview =
    (lineForm.gross_amount === "" ? 0 : Number(lineForm.gross_amount)) -
    (lineForm.loan_deduction_amount === "" ? 0 : Number(lineForm.loan_deduction_amount)) -
    (lineForm.other_deduction_amount === "" ? 0 : Number(lineForm.other_deduction_amount));

  const tableColumns: Array<CrudTableColumn<PayrollLine>> = [
    {
      key: "employee",
      header: "Empleado",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">{item.employee_name || item.worker_name || "Sin asignar"}</p>
          <p className="mt-1 text-xs text-slate-500">{item.employee_code || "Captura manual o sin codigo"}</p>
        </div>
      )
    },
    {
      key: "project",
      header: "Obra y actividad",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>{item.project_name || "Sin obra ligada"}</p>
          <p>{item.role_or_task || "Sin actividad"}</p>
          <p>{item.days_worked === null ? "Sin dias capturados" : `${item.days_worked} dias trabajados`}</p>
        </div>
      )
    },
    {
      key: "amounts",
      header: "Montos",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>Bruto: {formatMoney(item.gross_amount, "MXN")}</p>
          <p>Prestamo: {formatMoney(item.loan_deduction_amount, "MXN")}</p>
          <p>Otros: {formatMoney(item.other_deduction_amount, "MXN")}</p>
          <p className="font-semibold text-emerald-300">Neto: {formatMoney(item.net_amount, "MXN")}</p>
        </div>
      )
    },
    {
      key: "payment",
      header: "Pago",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>{PAYMENT_METHOD_LABELS[item.payment_method]}</p>
          <p>{item.notes || "Sin notas"}</p>
        </div>
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
            onClick={() => openEditLineDialog(item)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="secondary"
            className="gap-2 border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-200 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100"
            disabled={readOnly}
            onClick={() => setPendingDeleteLine(item)}
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
      eyebrow="Nomina"
      title="Control semanal de nominas"
      description="Registra corridas semanales, captura lineas por empleado y obra, y manten visibles prestamos, descuentos y netos con una vista mas cercana a tus hojas operativas."
    >
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <KpiCard
            label="Corridas registradas"
            value={String(runs.length)}
            metric={`${filteredRuns.length} visibles en la lista actual.`}
          />
          <KpiCard
            label="Nomina neta seleccionada"
            value={formatMoney(selectedRunNet, "MXN")}
            metric={
              selectedRun
                ? `${selectedRun.employee_count} personas y ${selectedRun.project_count} obras relacionadas.`
                : "Selecciona una corrida para ver su total neto."
            }
          />
          <Card className="relative overflow-hidden bg-gradient-to-br from-cyan-500/12 via-cyan-500/5 to-slate-950">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Estado del espacio</p>
            <p className="mt-3 text-2xl font-semibold text-white">{getRoleLabel(role)}</p>
            <p className="mt-2 text-sm text-slate-300">
              {readOnly
                ? "Puedes revisar corridas y lineas sin tocar los datos capturados."
                : "Puedes capturar corridas de nomina, ajustar lineas y limpiar registros sin salir de esta vista."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Ultima actualizacion
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                {latestRunUpdate}
              </span>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <form
            onSubmit={handleCompanySubmit}
            className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.1fr)_220px_minmax(0,1fr)_auto_auto]"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">ID de empresa</label>
              <input
                value={companyIdInput}
                onChange={(event) => setCompanyIdInput(event.target.value)}
                placeholder="UUID de la empresa (company_id)"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Rol de demo</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as "admin" | "viewer")}
                className={inputClassName}
              >
                <option value="admin">Administrador</option>
                <option value="viewer">Solo lectura</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Buscar corridas</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={runSearch}
                  onChange={(event) => setRunSearch(event.target.value)}
                  placeholder="Nomina 01, semana 12, pagada..."
                  className={cn(inputClassName, "pl-11")}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="secondary" className="h-[52px] w-full gap-2" disabled={loading} type="submit">
                <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                {loading ? "Cargando..." : "Actualizar"}
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                className="h-[52px] w-full gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
                disabled={readOnly}
                onClick={openCreateRunDialog}
              >
                <Plus className="h-4 w-4" />
                Nueva corrida
              </Button>
            </div>
          </form>

          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 text-sm text-slate-400">
            {companyId
              ? `Empresa activa: ${companyId}`
              : "Define un ID de empresa y actualiza para cargar las corridas y lineas de nomina."}
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Corridas semanales</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Lista de nominas</h2>
              </div>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                {filteredRuns.length} visibles
              </span>
            </div>

            <div className="space-y-3">
              {loading && runs.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center text-sm text-slate-500">
                  Cargando corridas de nomina...
                </div>
              ) : filteredRuns.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
                  <p className="text-base font-semibold text-white">No hay corridas visibles</p>
                  <p className="mt-2 text-sm text-slate-400">Crea tu primera corrida semanal y aparecera aqui.</p>
                </div>
              ) : (
                filteredRuns.map((run) => {
                  const isActive = run.id === selectedRunId;
                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => handleSelectRun(run.id)}
                      className={cn(
                        "w-full rounded-[26px] border px-4 py-4 text-left transition",
                        isActive
                          ? "border-cyan-400/40 bg-cyan-500/10 ring-1 ring-cyan-400/20"
                          : "border-slate-800 bg-slate-950/55 hover:border-slate-700 hover:bg-slate-950"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{run.run_number || `Semana ${run.week_number ?? "-"}`}</p>
                          <p className="mt-1 text-sm text-slate-400">{run.description || "Sin descripcion capturada"}</p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                            getStatusBadgeClass(run.status)
                          )}
                        >
                          {STATUS_LABELS[run.status]}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4 text-cyan-300" />
                          <span>{formatDateRange(run.period_start, run.period_end)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>{run.employee_count} personas</span>
                          <span>{run.project_count} obras</span>
                          <span>Neto {formatMoney(run.net_total, "MXN")}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Detalle de corrida</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {selectedRun?.run_number || (selectedRun ? `Semana ${selectedRun.week_number ?? "-"}` : "Selecciona una corrida")}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {selectedRun
                      ? `${formatDateRange(selectedRun.period_start, selectedRun.period_end)} · ${selectedRun.description || "Sin descripcion"}`
                      : "Elige una corrida semanal para revisar lineas, deducciones y totales."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedRun ? (
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]",
                        getStatusBadgeClass(selectedRun.status)
                      )}
                    >
                      {STATUS_LABELS[selectedRun.status]}
                    </span>
                  ) : null}
                  <Button variant="secondary" className="gap-2" disabled={!selectedRun || readOnly} onClick={() => selectedRun && openEditRunDialog(selectedRun)}>
                    <Pencil className="h-4 w-4" />
                    Editar corrida
                  </Button>
                  <Button
                    className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
                    disabled={!selectedRun || readOnly}
                    onClick={openCreateLineDialog}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar linea
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-2 border-rose-500/25 bg-rose-500/5 text-rose-200 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-100"
                    disabled={!selectedRun || readOnly}
                    onClick={() => selectedRun && setPendingDeleteRun(selectedRun)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar corrida
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-[24px] border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Bruto</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatMoney(selectedRunGross, "MXN")}</p>
                </div>
                <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Prestamos</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-100">{formatMoney(selectedRunLoans, "MXN")}</p>
                </div>
                <div className="rounded-[24px] border border-rose-500/20 bg-rose-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-rose-200">Otros descuentos</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-100">{formatMoney(selectedRunOther, "MXN")}</p>
                </div>
                <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Neto</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-100">{formatMoney(selectedRunNet, "MXN")}</p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Lineas por empleado</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Detalle de nomina</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Captura la obra, actividad, metodo de pago y descuentos por persona igual que en el flujo semanal de tus hojas.
                  </p>
                </div>

                <div className="w-full max-w-sm">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Buscar dentro de la corrida</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={lineSearch}
                      onChange={(event) => setLineSearch(event.target.value)}
                      placeholder="Empleado, obra, tarea, notas..."
                      className={cn(inputClassName, "pl-11")}
                    />
                  </div>
                </div>
              </div>

              <CrudTable
                columns={tableColumns}
                rows={paginatedLines}
                loading={loading}
                totalItems={filteredLines.length}
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                emptyTitle="No hay lineas en esta corrida"
                emptyDescription="Agrega tu primera linea de nomina para empezar a desglosar montos por empleado y obra."
              />
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={isRunDialogOpen}
        onClose={closeRunDialog}
        title={editingRun ? "Editar corrida de nomina" : "Nueva corrida de nomina"}
        description="Captura la semana, el periodo y una descripcion operativa parecida a la que usas en Excel."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={savingRun} onClick={() => closeRunDialog()}>
              Cancelar
            </Button>
            <Button
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
              disabled={savingRun || readOnly}
              type="submit"
              form="payroll-run-form"
            >
              {savingRun ? "Guardando..." : editingRun ? "Guardar cambios" : "Crear corrida"}
            </Button>
          </div>
        }
      >
        <form id="payroll-run-form" onSubmit={submitRun} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Corrida / folio</label>
            <input
              value={runForm.run_number}
              onChange={(event) => setRunForm((current) => ({ ...current, run_number: event.target.value }))}
              placeholder="NOMINA 01"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Semana</label>
            <input
              value={runForm.week_number}
              onChange={(event) => setRunForm((current) => ({ ...current, week_number: event.target.value }))}
              placeholder="1"
              inputMode="numeric"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Inicio del periodo</label>
            <input
              type="date"
              value={runForm.period_start}
              onChange={(event) => setRunForm((current) => ({ ...current, period_start: event.target.value }))}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fin del periodo</label>
            <input
              type="date"
              value={runForm.period_end}
              onChange={(event) => setRunForm((current) => ({ ...current, period_end: event.target.value }))}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Estado</label>
            <select
              value={runForm.status}
              onChange={(event) => setRunForm((current) => ({ ...current, status: event.target.value as PayrollStatus }))}
              className={inputClassName}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Descripcion</label>
            <textarea
              value={runForm.description}
              onChange={(event) => setRunForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Nomina del 05 al 11 de enero de 2026"
              rows={4}
              className={cn(inputClassName, "min-h-[120px] resize-y")}
            />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isLineDialogOpen}
        onClose={closeLineDialog}
        title={editingLine ? "Editar linea de nomina" : "Agregar linea de nomina"}
        description="Relaciona a la persona, la obra y las deducciones para reflejar el desglose real de la corrida semanal."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={savingLine} onClick={() => closeLineDialog()}>
              Cancelar
            </Button>
            <Button
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
              disabled={savingLine || readOnly}
              type="submit"
              form="payroll-line-form"
            >
              {savingLine ? "Guardando..." : editingLine ? "Guardar cambios" : "Agregar linea"}
            </Button>
          </div>
        }
      >
        <form id="payroll-line-form" onSubmit={submitLine} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Empleado</label>
            <select
              value={lineForm.employee_id}
              onChange={(event) => handleEmployeeChange(event.target.value)}
              className={inputClassName}
            >
              <option value="">Selecciona un empleado</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} {employee.employee_code ? `(${employee.employee_code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nombre libre / respaldo</label>
            <input
              value={lineForm.worker_name}
              onChange={(event) => setLineForm((current) => ({ ...current, worker_name: event.target.value }))}
              placeholder="Nombre capturado en recibo o lista"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Obra</label>
            <select
              value={lineForm.project_id}
              onChange={(event) => setLineForm((current) => ({ ...current, project_id: event.target.value }))}
              className={inputClassName}
            >
              <option value="">Selecciona una obra</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.code ? `(${project.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Actividad / puesto</label>
            <input
              value={lineForm.role_or_task}
              onChange={(event) => setLineForm((current) => ({ ...current, role_or_task: event.target.value }))}
              placeholder="Albanil, operador, supervision..."
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Dias trabajados</label>
            <input
              value={lineForm.days_worked}
              onChange={(event) => setLineForm((current) => ({ ...current, days_worked: event.target.value }))}
              placeholder="6"
              inputMode="decimal"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Metodo de pago</label>
            <select
              value={lineForm.payment_method}
              onChange={(event) =>
                setLineForm((current) => ({ ...current, payment_method: event.target.value as PaymentMethod }))
              }
              className={inputClassName}
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Monto bruto</label>
            <input
              value={lineForm.gross_amount}
              onChange={(event) => setLineForm((current) => ({ ...current, gross_amount: event.target.value }))}
              placeholder="0.00"
              inputMode="decimal"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Descuento por prestamo</label>
            <input
              value={lineForm.loan_deduction_amount}
              onChange={(event) =>
                setLineForm((current) => ({ ...current, loan_deduction_amount: event.target.value }))
              }
              placeholder="0.00"
              inputMode="decimal"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Otros descuentos</label>
            <input
              value={lineForm.other_deduction_amount}
              onChange={(event) =>
                setLineForm((current) => ({ ...current, other_deduction_amount: event.target.value }))
              }
              placeholder="0.00"
              inputMode="decimal"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fila origen en Excel</label>
            <input
              value={lineForm.source_row}
              onChange={(event) => setLineForm((current) => ({ ...current, source_row: event.target.value }))}
              placeholder="15"
              inputMode="numeric"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Notas</label>
            <textarea
              value={lineForm.notes}
              onChange={(event) => setLineForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Cheque, dispersion, ajuste, diferencia de semana, etc."
              rows={4}
              className={cn(inputClassName, "min-h-[120px] resize-y")}
            />
          </div>

          <div className="md:col-span-2">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[24px] border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Neto estimado</p>
                <p className={cn("mt-2 text-2xl font-semibold", lineNetPreview >= 0 ? "text-emerald-300" : "text-rose-300")}>
                  {formatMoney(lineNetPreview, "MXN")}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Se calcula como bruto menos prestamo menos otros descuentos.
                </p>
              </div>

              <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-200">
                    <WalletCards className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Prestamos activos</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {activeLoanSummary.count === 0 ? "Sin saldo" : formatMoney(activeLoanSummary.balance, "MXN")}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {lineForm.employee_id
                        ? activeLoanSummary.count === 0
                          ? "El empleado seleccionado no tiene prestamos pendientes."
                          : `${activeLoanSummary.count} registro(s) con saldo pendiente para ayudar a capturar el descuento.`
                        : "Selecciona un empleado para ver si tiene saldo pendiente de prestamo."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteRun)}
        title="Eliminar corrida"
        description={
          pendingDeleteRun
            ? `Se eliminara la corrida ${pendingDeleteRun.run_number || `semana ${pendingDeleteRun.week_number ?? "-"}`} junto con sus lineas.`
            : ""
        }
        confirmLabel="Eliminar corrida"
        loading={deletingRun}
        onClose={() => setPendingDeleteRun(null)}
        onConfirm={confirmDeleteRun}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteLine)}
        title="Eliminar linea"
        description={
          pendingDeleteLine
            ? `Se eliminara la linea de ${pendingDeleteLine.employee_name || pendingDeleteLine.worker_name || "este registro"}.`
            : ""
        }
        confirmLabel="Eliminar linea"
        loading={deletingLine}
        onClose={() => setPendingDeleteLine(null)}
        onConfirm={confirmDeleteLine}
      />
    </AppShell>
  );
}
