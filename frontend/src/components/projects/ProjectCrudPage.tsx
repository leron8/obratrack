"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ProjectResponse, ProjectStatus } from "@expenses/shared";
import { Pencil, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import AppShell from "../AppShell";
import { CrudTable, type CrudTableColumn } from "../crud/CrudTable";
import { ConfirmDialog } from "../crud/ConfirmDialog";
import { Card } from "../ui/Card";
import { Dialog } from "../ui/Dialog";
import { KpiCard } from "../ui/KpiCard";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/use-auth";
import { useAuthorization } from "../../hooks/use-authorization";
import {
  API_BASE_URL,
  fetchJson,
  formatMoney,
  getRoleLabel
} from "../../lib/finance-demo";

const PAGE_SIZE = 8;

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "planning", label: "Planeacion" },
  { value: "active", label: "Activa" },
  { value: "paused", label: "Pausada" },
  { value: "completed", label: "Terminada" },
  { value: "cancelled", label: "Cancelada" }
];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planeacion",
  active: "Activa",
  paused: "Pausada",
  completed: "Terminada",
  cancelled: "Cancelada"
};

type ClientOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type ProjectFormState = {
  code: string;
  name: string;
  description: string;
  client_id: string;
  status: ProjectStatus;
  budget: string;
  start_date: string;
  estimated_end_date: string;
  completed_at: string;
  address: string;
};

function getTodayDate() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function createDefaultForm(): ProjectFormState {
  return {
    code: "",
    name: "",
    description: "",
    client_id: "",
    status: "active",
    budget: "",
    start_date: "",
    estimated_end_date: "",
    completed_at: "",
    address: ""
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

function formatProjectDate(dateString: string | null) {
  if (!dateString) return "Sin fecha";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getStatusBadgeClass(status: ProjectStatus) {
  switch (status) {
    case "planning":
      return "border-sky-500/20 bg-sky-500/10 text-sky-200";
    case "active":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "paused":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "completed":
      return "border-violet-500/20 bg-violet-500/10 text-violet-200";
    case "cancelled":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

export function ProjectCrudPage() {
  const { activeCompany, activeRole } = useAuth();
  const { isFinancialManager } = useAuthorization();
  const companyId = activeCompany?.id ?? "";
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState<ProjectFormState>(() => createDefaultForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ProjectResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectResponse | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setProjects([]);
      setClients([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectsData, clientsData] = await Promise.all([
        fetchJson(`${API_BASE_URL}/projects?company_id=${encodeURIComponent(targetCompanyId)}&limit=120`),
        fetchJson(
          `${API_BASE_URL}/business-partners?company_id=${encodeURIComponent(targetCompanyId)}&partner_type=client&status=active`
        )
      ]);

      setProjects((projectsData.projects ?? []) as ProjectResponse[]);
      setClients((clientsData.partners ?? []) as ClientOption[]);
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

  const filteredProjects = useMemo(() => {
    if (!deferredSearch) return projects;

    return projects.filter((project) => {
      const haystack = [
        project.code,
        project.name,
        project.description,
        project.client_name,
        project.address,
        STATUS_LABELS[project.status]
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, projects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredProjects.length]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredProjects]);

  const totalBudget = useMemo(
    () => projects.reduce((sum, project) => sum + Number(project.budget ?? 0), 0),
    [projects]
  );

  const activeCount = useMemo(
    () => projects.filter((project) => project.status === "active").length,
    [projects]
  );
  const pausedCount = useMemo(
    () => projects.filter((project) => project.status === "paused").length,
    [projects]
  );
  const completedCount = useMemo(
    () => projects.filter((project) => project.status === "completed").length,
    [projects]
  );

  const latestUpdatedAt =
    projects[0]?.updated_at ? formatDateTime(projects[0].updated_at) : "Sin actividad reciente";
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

  function openEditDialog(item: ProjectResponse) {
    setEditingItem(item);
    setForm({
      code: item.code ?? "",
      name: item.name,
      description: item.description ?? "",
      client_id: item.client_id ?? "",
      status: item.status,
      budget: String(item.budget ?? ""),
      start_date: item.start_date ?? "",
      estimated_end_date: item.estimated_end_date ?? "",
      completed_at: item.completed_at ?? "",
      address: item.address ?? ""
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
        code: form.code.trim() || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        client_id: form.client_id || null,
        status: form.status,
        budget: Number(form.budget || 0),
        start_date: form.start_date || null,
        estimated_end_date: form.estimated_end_date || null,
        completed_at: form.status === "completed" ? form.completed_at || null : null,
        address: form.address.trim() || null
      };
      const url = `${API_BASE_URL}/projects${editingItem ? `/${editingItem.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;

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
      await fetchJson(`${API_BASE_URL}/projects/${pendingDelete.id}?company_id=${encodeURIComponent(companyId)}`, {
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

  const tableColumns: Array<CrudTableColumn<ProjectResponse>> = [
    {
      key: "project",
      header: "Obra",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">{item.name}</p>
          <p className="mt-1 text-xs text-slate-500">{item.code || "Sin codigo"}</p>
        </div>
      )
    },
    {
      key: "client",
      header: "Cliente",
      cell: (item) => (
        <div>
          <p className="font-medium text-white">{item.client_name ?? "Sin cliente asignado"}</p>
          <p className="mt-1 text-xs text-slate-500">{item.client_id ?? "Sin referencia"}</p>
        </div>
      )
    },
    {
      key: "timeline",
      header: "Fechas",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>Inicio: {formatProjectDate(item.start_date)}</p>
          <p>Entrega: {formatProjectDate(item.estimated_end_date)}</p>
          <p>Actualizado: {formatDateTime(item.updated_at)}</p>
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
          <p className="max-w-xs text-sm leading-6 text-slate-400">{item.description || "Sin descripcion"}</p>
        </div>
      )
    },
    {
      key: "budget",
      header: "Presupuesto",
      align: "right",
      cell: (item) => (
        <div>
          <p className="font-semibold text-cyan-300">{formatMoney(Number(item.budget), "MXN")}</p>
          <p className="mt-1 text-xs text-slate-500">{item.address || "Sin direccion"}</p>
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
    "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20";

  return (
    <AppShell
      eyebrow="Obras"
      title="Catalogo de proyectos"
      description="Administra las obras activas y terminadas desde una sola tabla, con alta, edicion y baja logica siguiendo el mismo flujo del modulo de ingresos."
    >
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <KpiCard
            label="Obras activas"
            value={String(activeCount)}
            metric={`${completedCount} terminadas y ${pausedCount} pausadas.`}
          />
          <KpiCard
            label="Presupuesto total"
            value={formatMoney(totalBudget, "MXN")}
            metric={`${projects.length} obras cargadas desde el backend.`}
          />
          <Card className="relative overflow-hidden bg-gradient-to-br from-cyan-500/12 via-cyan-500/5 to-slate-950">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Estado del espacio</p>
            <p className="mt-3 text-2xl font-semibold text-white">{getRoleLabel(activeRole)}</p>
            <p className="mt-2 text-sm text-slate-300">
              {readOnly
                ? "El modo de solo lectura mantiene visible el catalogo mientras bloquea las acciones de escritura."
                : "El modo administrador deja la creacion, edicion y eliminacion de obras a un clic."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Ultima actualizacion
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                {latestUpdatedAt}
              </span>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Buscar obras</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, cliente, codigo..."
                  className={cn(inputClassName, "pl-11")}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="secondary" className="h-[52px] w-full gap-2" disabled={loading} onClick={() => void load(companyId)}>
                <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                {loading ? "Cargando..." : "Actualizar"}
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                className="h-[52px] w-full gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400"
                disabled={readOnly}
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4" />
                Agregar obra
              </Button>
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 text-sm text-slate-400">
            {companyId
              ? `Empresa activa: ${activeCompany?.name ?? companyId}`
              : "Selecciona una empresa desde el encabezado para cargar las obras mas recientes en la tabla."}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Obras registradas</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Catalogo de proyectos</h2>
              <p className="mt-2 text-sm text-slate-400">
                Revisa el estado de cada obra y entra a editar o eliminar sin salir de la tabla.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                {filteredProjects.length} visibles
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
            rows={paginatedProjects}
            loading={loading}
            totalItems={filteredProjects.length}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            emptyTitle="No se encontraron obras"
            emptyDescription="Crea tu primera obra y aparecera aqui al instante."
          />
        </Card>
      </div>

      <Dialog
        open={isFormOpen}
        onClose={closeFormDialog}
        title={editingItem ? "Editar obra" : "Agregar obra"}
        description={`Completa los campos para ${editingItem ? "actualizar" : "crear"} esta obra.`}
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
              form="project-form"
            >
              {saving ? "Guardando..." : editingItem ? "Guardar cambios" : "Agregar obra"}
            </Button>
          </div>
        }
      >
        <form id="project-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nombre de la obra</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ej. Torre Norte"
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Codigo</label>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="OBR-2026-001"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Cliente</label>
            <select
              value={form.client_id}
              onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
              className={inputClassName}
            >
              <option value="">Sin cliente asignado</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Estado</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => {
                  const nextStatus = event.target.value as ProjectStatus;
                  return {
                    ...current,
                    status: nextStatus,
                    completed_at:
                      nextStatus === "completed"
                        ? current.completed_at || getTodayDate()
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
            <label className="text-sm font-medium text-slate-300">Presupuesto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.budget}
              onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
              placeholder="0.00"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fecha de inicio</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fecha estimada de cierre</label>
            <input
              type="date"
              value={form.estimated_end_date}
              onChange={(event) =>
                setForm((current) => ({ ...current, estimated_end_date: event.target.value }))
              }
              className={inputClassName}
            />
          </div>

          {form.status === "completed" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Fecha de termino</label>
              <input
                type="date"
                value={form.completed_at}
                onChange={(event) => setForm((current) => ({ ...current, completed_at: event.target.value }))}
                className={inputClassName}
              />
            </div>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Direccion</label>
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Ubicacion o frente de obra"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Descripcion</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Alcance, comentarios o frente de trabajo"
              rows={4}
              className={cn(inputClassName, "resize-none")}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar obra"
        description={
          pendingDelete ? `La obra "${pendingDelete.name}" se eliminara de este catalogo.` : ""
        }
        confirmLabel="Eliminar obra"
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
