"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { EmployeeResponse, ProjectResponse, VehicleResponse } from "@expenses/shared";
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
const VEHICLE_STATUS_SUGGESTIONS = ["active", "maintenance", "inactive", "sold"] as const;

type VehicleFormState = {
  plate: string;
  economic_number: string;
  vin: string;
  brand: string;
  model_name: string;
  model_year: string;
  color: string;
  vehicle_type: string;
  status: string;
  purchase_date: string;
  purchase_value: string;
  default_project_id: string;
  responsible_employee_id: string;
  notes: string;
};

function createDefaultForm(): VehicleFormState {
  return {
    plate: "",
    economic_number: "",
    vin: "",
    brand: "",
    model_name: "",
    model_year: "",
    color: "",
    vehicle_type: "",
    status: "active",
    purchase_date: "",
    purchase_value: "",
    default_project_id: "",
    responsible_employee_id: "",
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

function formatVehicleDate(dateString: string | null) {
  if (!dateString) return "Sin fecha";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "maintenance":
      return "border-sky-500/20 bg-sky-500/10 text-sky-200";
    case "inactive":
      return "border-slate-600/40 bg-slate-800/80 text-slate-200";
    case "sold":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function getStatusLabel(status: string) {
  if (!status) return "Sin estado";
  return status;
}

export function VehicleCrudPage() {
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [companyIdInput, setCompanyIdInput] = useState(DEFAULT_COMPANY_ID);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [form, setForm] = useState<VehicleFormState>(() => createDefaultForm());
  const [loading, setLoading] = useState(Boolean(DEFAULT_COMPANY_ID));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<VehicleResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VehicleResponse | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [role, setRole] = useDemoRole();
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setVehicles([]);
      setProjects([]);
      setEmployees([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [vehiclesData, projectsData, employeesData] = await Promise.all([
        fetchJson(`${API_BASE_URL}/vehicles?company_id=${encodeURIComponent(targetCompanyId)}&limit=120`),
        fetchJson(`${API_BASE_URL}/projects?company_id=${encodeURIComponent(targetCompanyId)}&limit=120`),
        fetchJson(`${API_BASE_URL}/employees?company_id=${encodeURIComponent(targetCompanyId)}&limit=120`)
      ]);

      setVehicles((vehiclesData.vehicles ?? []) as VehicleResponse[]);
      setProjects((projectsData.projects ?? []) as ProjectResponse[]);
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

  const filteredVehicles = useMemo(() => {
    if (!deferredSearch) return vehicles;

    return vehicles.filter((vehicle) => {
      const haystack = [
        vehicle.plate,
        vehicle.economic_number,
        vehicle.vin,
        vehicle.brand,
        vehicle.model_name,
        vehicle.color,
        vehicle.vehicle_type,
        vehicle.status,
        vehicle.default_project_name,
        vehicle.default_project_code,
        vehicle.responsible_employee_name,
        vehicle.responsible_employee_code
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, vehicles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredVehicles.length]);

  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredVehicles.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredVehicles]);

  const totalPurchaseValue = useMemo(
    () => vehicles.reduce((sum, vehicle) => sum + Number(vehicle.purchase_value ?? 0), 0),
    [vehicles]
  );
  const activeCount = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status.toLowerCase() === "active").length,
    [vehicles]
  );
  const assignedProjectCount = useMemo(
    () => vehicles.filter((vehicle) => Boolean(vehicle.default_project_id)).length,
    [vehicles]
  );
  const assignedResponsibleCount = useMemo(
    () => vehicles.filter((vehicle) => Boolean(vehicle.responsible_employee_id)).length,
    [vehicles]
  );

  const latestUpdatedAt =
    vehicles[0]?.updated_at ? formatDateTime(vehicles[0].updated_at) : "Sin actividad reciente";
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

  function openEditDialog(item: VehicleResponse) {
    setEditingItem(item);
    setForm({
      plate: item.plate ?? "",
      economic_number: item.economic_number ?? "",
      vin: item.vin ?? "",
      brand: item.brand ?? "",
      model_name: item.model_name,
      model_year: item.model_year === null ? "" : String(item.model_year),
      color: item.color ?? "",
      vehicle_type: item.vehicle_type ?? "",
      status: item.status,
      purchase_date: item.purchase_date ?? "",
      purchase_value: item.purchase_value === null ? "" : String(item.purchase_value),
      default_project_id: item.default_project_id ?? "",
      responsible_employee_id: item.responsible_employee_id ?? "",
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
        plate: form.plate.trim() || null,
        economic_number: form.economic_number.trim() || null,
        vin: form.vin.trim() || null,
        brand: form.brand.trim() || null,
        model_name: form.model_name.trim(),
        model_year: form.model_year === "" ? null : Number(form.model_year),
        color: form.color.trim() || null,
        vehicle_type: form.vehicle_type.trim() || null,
        status: form.status.trim() || "active",
        purchase_date: form.purchase_date || null,
        purchase_value: form.purchase_value === "" ? null : Number(form.purchase_value),
        default_project_id: form.default_project_id || null,
        responsible_employee_id: form.responsible_employee_id || null,
        notes: form.notes.trim() || null
      };

      const url = `${API_BASE_URL}/vehicles${editingItem ? `/${editingItem.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;

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
      await fetchJson(`${API_BASE_URL}/vehicles/${pendingDelete.id}?company_id=${encodeURIComponent(companyId)}`, {
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

  const tableColumns: Array<CrudTableColumn<VehicleResponse>> = [
    {
      key: "unit",
      header: "Unidad",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">
            {[item.brand, item.model_name].filter(Boolean).join(" ") || item.model_name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {item.plate || "Sin placas"} {item.economic_number ? ` / ${item.economic_number}` : ""}
          </p>
        </div>
      )
    },
    {
      key: "assignment",
      header: "Asignacion",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>Obra: {item.default_project_name || "Sin obra"}</p>
          <p>Responsable: {item.responsible_employee_name || "Sin responsable"}</p>
        </div>
      )
    },
    {
      key: "purchase",
      header: "Compra",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>Fecha: {formatVehicleDate(item.purchase_date)}</p>
          <p>
            Valor: {item.purchase_value === null ? "Sin valor" : formatMoney(item.purchase_value, "MXN")}
          </p>
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
            {getStatusLabel(item.status)}
          </span>
          <p className="max-w-xs text-sm leading-6 text-slate-400">
            {item.vehicle_type || "Sin tipo"} {item.color ? ` / ${item.color}` : ""}
          </p>
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
    "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20";

  return (
    <AppShell
      eyebrow="Vehiculos"
      title="Catalogo de vehiculos"
      description="Administra las unidades de la empresa con una tabla clara, asignacion rapida a obra y responsable, y el mismo flujo de alta, edicion y baja logica que en los otros modulos."
    >
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <KpiCard
            label="Vehiculos activos"
            value={String(activeCount)}
            metric={`${assignedProjectCount} con obra y ${assignedResponsibleCount} con responsable.`}
          />
          <KpiCard
            label="Valor de compra"
            value={formatMoney(totalPurchaseValue, "MXN")}
            metric={`${vehicles.length} unidades cargadas desde el backend.`}
          />
          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/14 via-amber-500/5 to-slate-950">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Estado del espacio</p>
            <p className="mt-3 text-2xl font-semibold text-white">{getRoleLabel(role)}</p>
            <p className="mt-2 text-sm text-slate-300">
              {readOnly
                ? "El modo de solo lectura deja visible el parque vehicular sin permitir cambios."
                : "El modo administrador deja listo el mantenimiento del catalogo de unidades."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
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
              <label className="text-sm font-medium text-slate-300">Buscar vehiculos</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Placas, modelo, obra, responsable..."
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
                className="h-[52px] w-full gap-2 bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:hover:bg-amber-400"
                disabled={readOnly}
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4" />
                Agregar vehiculo
              </Button>
            </div>
          </form>

          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 text-sm text-slate-400">
            {companyId
              ? `Empresa activa: ${companyId}`
              : "Define un ID de empresa y actualiza para cargar las unidades en la tabla."}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Unidades registradas</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Catalogo de vehiculos</h2>
              <p className="mt-2 text-sm text-slate-400">
                Revisa estatus, compra y asignacion de cada unidad sin salir de la tabla.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                {filteredVehicles.length} visibles
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
            rows={paginatedVehicles}
            loading={loading}
            totalItems={filteredVehicles.length}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            emptyTitle="No se encontraron vehiculos"
            emptyDescription="Crea tu primera unidad y aparecera aqui al instante."
          />
        </Card>
      </div>

      <Dialog
        open={isFormOpen}
        onClose={closeFormDialog}
        title={editingItem ? "Editar vehiculo" : "Agregar vehiculo"}
        description={`Completa los campos para ${editingItem ? "actualizar" : "crear"} este vehiculo.`}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => closeFormDialog()}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:hover:bg-amber-400"
              disabled={saving || readOnly}
              type="submit"
              form="vehicle-form"
            >
              {saving ? "Guardando..." : editingItem ? "Guardar cambios" : "Agregar vehiculo"}
            </Button>
          </div>
        }
      >
        <form id="vehicle-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Marca</label>
            <input
              value={form.brand}
              onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
              placeholder="Ford"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Modelo</label>
            <input
              value={form.model_name}
              onChange={(event) => setForm((current) => ({ ...current, model_name: event.target.value }))}
              placeholder="F-350"
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Placas</label>
            <input
              value={form.plate}
              onChange={(event) => setForm((current) => ({ ...current, plate: event.target.value }))}
              placeholder="ABC-123-A"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Numero economico</label>
            <input
              value={form.economic_number}
              onChange={(event) => setForm((current) => ({ ...current, economic_number: event.target.value }))}
              placeholder="VEH-001"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">VIN</label>
            <input
              value={form.vin}
              onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))}
              placeholder="Numero de serie"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Ano modelo</label>
            <input
              type="number"
              min="1900"
              max="2100"
              value={form.model_year}
              onChange={(event) => setForm((current) => ({ ...current, model_year: event.target.value }))}
              placeholder="2024"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Color</label>
            <input
              value={form.color}
              onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              placeholder="Blanco"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Tipo de vehiculo</label>
            <input
              value={form.vehicle_type}
              onChange={(event) => setForm((current) => ({ ...current, vehicle_type: event.target.value }))}
              placeholder="Camioneta, retroexcavadora, camion..."
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Estado</label>
            <input
              list="vehicle-status-options"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              placeholder="active"
              className={inputClassName}
              required
            />
            <datalist id="vehicle-status-options">
              {VEHICLE_STATUS_SUGGESTIONS.map((status) => (
                <option key={status} value={status} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fecha de compra</label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(event) => setForm((current) => ({ ...current, purchase_date: event.target.value }))}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Valor de compra</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.purchase_value}
              onChange={(event) => setForm((current) => ({ ...current, purchase_value: event.target.value }))}
              placeholder="0.00"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Obra por defecto</label>
            <select
              value={form.default_project_id}
              onChange={(event) => setForm((current) => ({ ...current, default_project_id: event.target.value }))}
              className={inputClassName}
            >
              <option value="">Sin obra asignada</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} {project.code ? `(${project.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Responsable</label>
            <select
              value={form.responsible_employee_id}
              onChange={(event) =>
                setForm((current) => ({ ...current, responsible_employee_id: event.target.value }))
              }
              className={inputClassName}
            >
              <option value="">Sin responsable</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} {employee.employee_code ? `(${employee.employee_code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Notas</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Observaciones operativas, mecanicas o administrativas"
              rows={4}
              className={cn(inputClassName, "resize-none")}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar vehiculo"
        description={
          pendingDelete
            ? `El vehiculo "${[pendingDelete.brand, pendingDelete.model_name, pendingDelete.plate].filter(Boolean).join(" ")}" se eliminara del catalogo.`
            : ""
        }
        confirmLabel="Eliminar vehiculo"
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
