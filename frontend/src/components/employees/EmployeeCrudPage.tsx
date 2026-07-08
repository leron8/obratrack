"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { EmployeeResponse, EmployeeStatus, WorkerType } from "@expenses/shared";
import { Pencil, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
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

const STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "terminated", label: "Baja" }
];

const WORKER_TYPE_OPTIONS: Array<{ value: WorkerType; label: string }> = [
  { value: "employee", label: "Empleado" },
  { value: "contractor", label: "Contratista" },
  { value: "destajista", label: "Destajista" },
  { value: "partner", label: "Socio" }
];

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  terminated: "Baja"
};

const WORKER_TYPE_LABELS: Record<WorkerType, string> = {
  employee: "Empleado",
  contractor: "Contratista",
  destajista: "Destajista",
  partner: "Socio"
};

type EmployeeFormState = {
  employee_code: string;
  worker_type: WorkerType;
  first_name: string;
  last_name: string;
  position: string;
  email: string;
  phone: string;
  rfc: string;
  curp: string;
  nss: string;
  default_daily_rate: string;
  default_weekly_salary: string;
  status: EmployeeStatus;
  hire_date: string;
  termination_date: string;
  notes: string;
};

function getTodayDate() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function createDefaultForm(): EmployeeFormState {
  return {
    employee_code: "",
    worker_type: "employee",
    first_name: "",
    last_name: "",
    position: "",
    email: "",
    phone: "",
    rfc: "",
    curp: "",
    nss: "",
    default_daily_rate: "",
    default_weekly_salary: "",
    status: "active",
    hire_date: "",
    termination_date: "",
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

function formatEmployeeDate(dateString: string | null) {
  if (!dateString) return "Sin fecha";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getStatusBadgeClass(status: EmployeeStatus) {
  switch (status) {
    case "active":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "inactive":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "terminated":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

export function EmployeeCrudPage() {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [companyIdInput, setCompanyIdInput] = useState(DEFAULT_COMPANY_ID);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [form, setForm] = useState<EmployeeFormState>(() => createDefaultForm());
  const [loading, setLoading] = useState(Boolean(DEFAULT_COMPANY_ID));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EmployeeResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EmployeeResponse | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [role, setRole] = useDemoRole();
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setEmployees([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const employeesData = await fetchJson(
        `${API_BASE_URL}/employees?company_id=${encodeURIComponent(targetCompanyId)}&limit=120`
      );

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

  const filteredEmployees = useMemo(() => {
    if (!deferredSearch) return employees;

    return employees.filter((employee) => {
      const haystack = [
        employee.full_name,
        employee.employee_code,
        employee.position,
        employee.email,
        employee.phone,
        employee.rfc,
        STATUS_LABELS[employee.status],
        WORKER_TYPE_LABELS[employee.worker_type]
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, employees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredEmployees.length]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredEmployees]);

  const totalWeeklyBase = useMemo(
    () => employees.reduce((sum, employee) => sum + Number(employee.default_weekly_salary ?? 0), 0),
    [employees]
  );
  const activeCount = useMemo(
    () => employees.filter((employee) => employee.status === "active").length,
    [employees]
  );
  const terminatedCount = useMemo(
    () => employees.filter((employee) => employee.status === "terminated").length,
    [employees]
  );
  const contractorCount = useMemo(
    () => employees.filter((employee) => employee.worker_type === "contractor").length,
    [employees]
  );

  const latestUpdatedAt =
    employees[0]?.updated_at ? formatDateTime(employees[0].updated_at) : "Sin actividad reciente";
  const readOnly = role !== "admin";

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

  function openEditDialog(item: EmployeeResponse) {
    setEditingItem(item);
    setForm({
      employee_code: item.employee_code ?? "",
      worker_type: item.worker_type,
      first_name: item.first_name,
      last_name: item.last_name ?? "",
      position: item.position ?? "",
      email: item.email ?? "",
      phone: item.phone ?? "",
      rfc: item.rfc ?? "",
      curp: item.curp ?? "",
      nss: item.nss ?? "",
      default_daily_rate: item.default_daily_rate === null ? "" : String(item.default_daily_rate),
      default_weekly_salary: item.default_weekly_salary === null ? "" : String(item.default_weekly_salary),
      status: item.status,
      hire_date: item.hire_date ?? "",
      termination_date: item.termination_date ?? "",
      notes: item.notes ?? ""
    });
    setIsFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId) {
      setError("Primero define un ID de empresa.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        employee_code: form.employee_code.trim() || null,
        worker_type: form.worker_type,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || "",
        position: form.position.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        rfc: form.rfc.trim() || null,
        curp: form.curp.trim() || null,
        nss: form.nss.trim() || null,
        default_daily_rate: form.default_daily_rate === "" ? null : Number(form.default_daily_rate),
        default_weekly_salary: form.default_weekly_salary === "" ? null : Number(form.default_weekly_salary),
        status: form.status,
        hire_date: form.hire_date || null,
        termination_date: form.status === "terminated" ? form.termination_date || null : null,
        notes: form.notes.trim() || null
      };

      const url = `${API_BASE_URL}/employees${editingItem ? `/${editingItem.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;

      await fetchJson(url, {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "x-user-role": role },
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
      await fetchJson(`${API_BASE_URL}/employees/${pendingDelete.id}?company_id=${encodeURIComponent(companyId)}`, {
        method: "DELETE",
        headers: { "x-user-role": role }
      });

      setPendingDelete(null);
      await load(companyId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  function handleCompanySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCompanyId = companyIdInput.trim();

    if (nextCompanyId === companyId) {
      void load(nextCompanyId);
      return;
    }

    setCompanyId(nextCompanyId);
  }

  const tableColumns: Array<CrudTableColumn<EmployeeResponse>> = [
    {
      key: "employee",
      header: "Empleado",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">{item.full_name}</p>
          <p className="mt-1 text-xs text-slate-500">{item.employee_code || "Sin codigo"}</p>
        </div>
      )
    },
    {
      key: "role",
      header: "Rol",
      cell: (item) => (
        <div>
          <p className="font-medium text-white">{item.position || WORKER_TYPE_LABELS[item.worker_type]}</p>
          <p className="mt-1 text-xs text-slate-500">{WORKER_TYPE_LABELS[item.worker_type]}</p>
        </div>
      )
    },
    {
      key: "contact",
      header: "Contacto",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>{item.email || "Sin correo"}</p>
          <p>{item.phone || "Sin telefono"}</p>
        </div>
      )
    },
    {
      key: "compensation",
      header: "Base",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>Dia: {item.default_daily_rate === null ? "Sin definir" : formatMoney(item.default_daily_rate, "MXN")}</p>
          <p>Semana: {item.default_weekly_salary === null ? "Sin definir" : formatMoney(item.default_weekly_salary, "MXN")}</p>
        </div>
      )
    },
    {
      key: "status",
      header: "Estado",
      cell: (item) => (
        <div className="space-y-2">
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
              getStatusBadgeClass(item.status)
            )}
          >
            {STATUS_LABELS[item.status]}
          </span>
          <div className="text-xs text-slate-400">
            <p>Alta: {formatEmployeeDate(item.hire_date)}</p>
            <p>Baja: {formatEmployeeDate(item.termination_date)}</p>
          </div>
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
    "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20";

  return (
    <AppShell
      eyebrow="Empleados"
      title="Catalogo de empleados"
      description="Administra el padron del personal con el mismo flujo de alta, edicion y baja logica que ya usamos en obras e ingresos."
    >
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <KpiCard
            label="Empleados activos"
            value={String(activeCount)}
            metric={`${terminatedCount} bajas y ${contractorCount} contratistas.`}
          />
          <KpiCard
            label="Base semanal"
            value={formatMoney(totalWeeklyBase, "MXN")}
            metric={`${employees.length} personas cargadas desde el backend.`}
          />
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/12 via-emerald-500/5 to-slate-950">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Estado del espacio</p>
            <p className="mt-3 text-2xl font-semibold text-white">{getRoleLabel(role)}</p>
            <p className="mt-2 text-sm text-slate-300">
              {readOnly
                ? "El modo de solo lectura permite consultar la plantilla sin tocar datos."
                : "El modo administrador deja listo el mantenimiento del catalogo en una sola vista."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                Ultima actualizacion
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                {latestUpdatedAt}
              </span>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <form onSubmit={handleCompanySubmit} className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.1fr)_220px_minmax(0,1fr)_auto_auto]">
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
              <label className="text-sm font-medium text-slate-300">Buscar empleados</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, codigo, puesto..."
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
                className="h-[52px] w-full gap-2 bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:hover:bg-emerald-400"
                disabled={readOnly}
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4" />
                Agregar empleado
              </Button>
            </div>
          </form>

          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 text-sm text-slate-400">
            {companyId
              ? `Empresa activa: ${companyId}`
              : "Define un ID de empresa y actualiza para cargar la plantilla en la tabla."}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Plantilla registrada</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Catalogo de empleados</h2>
              <p className="mt-2 text-sm text-slate-400">
                Revisa el estado, la base de pago y los datos de contacto de cada persona sin salir de la tabla.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                {filteredEmployees.length} visibles
              </span>
              {deferredSearch ? (
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                  Busqueda: {search}
                </span>
              ) : null}
            </div>
          </div>

          <CrudTable
            columns={tableColumns}
            rows={paginatedEmployees}
            loading={loading}
            totalItems={filteredEmployees.length}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            emptyTitle="No se encontraron empleados"
            emptyDescription="Crea tu primer empleado y aparecera aqui al instante."
          />
        </Card>
      </div>

      <Dialog
        open={isFormOpen}
        onClose={closeFormDialog}
        title={editingItem ? "Editar empleado" : "Agregar empleado"}
        description={`Completa los campos para ${editingItem ? "actualizar" : "crear"} este empleado.`}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => closeFormDialog()}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:hover:bg-emerald-400"
              disabled={saving || readOnly}
              type="submit"
              form="employee-form"
            >
              {saving ? "Guardando..." : editingItem ? "Guardar cambios" : "Agregar empleado"}
            </Button>
          </div>
        }
      >
        <form id="employee-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nombre</label>
            <input
              value={form.first_name}
              onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
              placeholder="Juan"
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Apellidos</label>
            <input
              value={form.last_name}
              onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
              placeholder="Perez Lopez"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Codigo</label>
            <input
              value={form.employee_code}
              onChange={(event) => setForm((current) => ({ ...current, employee_code: event.target.value }))}
              placeholder="EMP-001"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Tipo de trabajador</label>
            <select
              value={form.worker_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, worker_type: event.target.value as WorkerType }))
              }
              className={inputClassName}
            >
              {WORKER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Puesto</label>
            <input
              value={form.position}
              onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))}
              placeholder="Supervisor de obra"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Estado</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => {
                  const nextStatus = event.target.value as EmployeeStatus;
                  return {
                    ...current,
                    status: nextStatus,
                    termination_date:
                      nextStatus === "terminated"
                        ? current.termination_date || getTodayDate()
                        : ""
                  };
                })
              }
              className={inputClassName}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Correo</label>
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="correo@empresa.com"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Telefono</label>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="555-123-4567"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Sueldo diario</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.default_daily_rate}
              onChange={(event) => setForm((current) => ({ ...current, default_daily_rate: event.target.value }))}
              placeholder="0.00"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Sueldo semanal</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.default_weekly_salary}
              onChange={(event) =>
                setForm((current) => ({ ...current, default_weekly_salary: event.target.value }))
              }
              placeholder="0.00"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fecha de alta</label>
            <input
              type="date"
              value={form.hire_date}
              onChange={(event) => setForm((current) => ({ ...current, hire_date: event.target.value }))}
              className={inputClassName}
            />
          </div>

          {form.status === "terminated" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Fecha de baja</label>
              <input
                type="date"
                value={form.termination_date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, termination_date: event.target.value }))
                }
                className={inputClassName}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">RFC</label>
            <input
              value={form.rfc}
              onChange={(event) => setForm((current) => ({ ...current, rfc: event.target.value }))}
              placeholder="ABC123456XYZ"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">CURP</label>
            <input
              value={form.curp}
              onChange={(event) => setForm((current) => ({ ...current, curp: event.target.value }))}
              placeholder="CURP"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">NSS</label>
            <input
              value={form.nss}
              onChange={(event) => setForm((current) => ({ ...current, nss: event.target.value }))}
              placeholder="Numero de seguridad social"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Notas</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Comentarios operativos o administrativos"
              rows={4}
              className={cn(inputClassName, "resize-none")}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar empleado"
        description={pendingDelete ? `El empleado "${pendingDelete.full_name}" se eliminara del catalogo.` : ""}
        confirmLabel="Eliminar empleado"
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
