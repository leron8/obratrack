"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { MovementDirection, MovementKind, MovementResponse, ProjectResponse } from "@expenses/shared";
import { Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
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
import {
  API_BASE_URL,
  fetchJson,
  formatMoney
} from "../../lib/finance-demo";

const PAGE_SIZE = 8;

type AccountOption = {
  id: string;
  name: string;
  account_type: string;
  currency?: string | null;
};

type MovementFormState = {
  movement_date: string;
  description: string;
  amount: string;
  currency: string;
  movement_kind: MovementKind;
  account_id: string;
  project_id: string;
  notes: string;
};

type MovementKindOption = {
  value: MovementKind;
  label: string;
};

type Accent = "cyan" | "rose";

type MovementCrudPageProps = {
  direction: MovementDirection;
  accent: Accent;
  eyebrow: string;
  title: string;
  description: string;
  totalLabel: string;
  totalHint: string;
  createLabel: string;
  editLabel: string;
  recordLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  defaultMovementKind: MovementKind;
  movementKindOptions: MovementKindOption[];
  movementKindLabels: Record<string, string>;
  amountToneClass: string;
};

const accentStyles: Record<
  Accent,
  {
    primaryButton: string;
    accentText: string;
    accentBadge: string;
    accentPanel: string;
    focusRing: string;
    searchRing: string;
  }
> = {
  cyan: {
    primaryButton: "bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400",
    accentText: "text-cyan-300",
    accentBadge: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    accentPanel: "from-cyan-500/12 via-cyan-500/5 to-slate-950",
    focusRing: "focus:border-cyan-400 focus:ring-cyan-400/20",
    searchRing: "focus-within:ring-cyan-400/20"
  },
  rose: {
    primaryButton: "bg-rose-500 text-white hover:bg-rose-400 disabled:hover:bg-rose-500",
    accentText: "text-rose-300",
    accentBadge: "border-rose-500/20 bg-rose-500/10 text-rose-200",
    accentPanel: "from-rose-500/14 via-rose-500/6 to-slate-950",
    focusRing: "focus:border-rose-400 focus:ring-rose-400/20",
    searchRing: "focus-within:ring-rose-400/20"
  }
};

function getTodayDate() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function createDefaultForm(defaultMovementKind: MovementKind): MovementFormState {
  return {
    movement_date: getTodayDate(),
    description: "",
    amount: "",
    currency: "MXN",
    movement_kind: defaultMovementKind,
    account_id: "",
    project_id: "",
    notes: ""
  };
}

function formatCreatedAt(dateString: string) {
  return new Date(dateString).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function MovementCrudPage({
  direction,
  accent,
  eyebrow,
  title,
  description,
  totalLabel,
  totalHint,
  createLabel,
  editLabel,
  recordLabel,
  emptyTitle,
  emptyDescription,
  defaultMovementKind,
  movementKindOptions,
  movementKindLabels,
  amountToneClass
}: MovementCrudPageProps) {
  const styles = accentStyles[accent];
  const { activeCompany } = useAuth();
  const { isFinancialManager, canCreateMovement } = useAuthorization();
  const [movements, setMovements] = useState<MovementResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [form, setForm] = useState<MovementFormState>(() => createDefaultForm(defaultMovementKind));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MovementResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MovementResponse | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const companyId = activeCompany?.id ?? "";

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setMovements([]);
      setAccounts([]);
      setProjects([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [movementsData, accountsData, projectsData] = await Promise.all([
        fetchJson(
          `${API_BASE_URL}/movements?company_id=${encodeURIComponent(targetCompanyId)}&direction=${direction}&limit=120`
        ),
        fetchJson(`${API_BASE_URL}/accounts?company_id=${encodeURIComponent(targetCompanyId)}&status=active`),
        fetchJson(`${API_BASE_URL}/projects?company_id=${encodeURIComponent(targetCompanyId)}&limit=200`)
      ]);

      setMovements((movementsData.movements ?? []) as MovementResponse[]);
      setAccounts((accountsData.accounts ?? []) as AccountOption[]);
      setProjects((projectsData.projects ?? []) as ProjectResponse[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, direction]);

  const filteredMovements = useMemo(() => {
    if (!deferredSearch) return movements;

    return movements.filter((movement) => {
      const kindLabel = movementKindLabels[movement.movement_kind] ?? movement.movement_kind;
      const haystack = [
        movement.description,
        movement.notes,
        movement.account_name,
        movement.account_id,
        movement.project_name,
        movement.movement_date,
        kindLabel
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, movementKindLabels, movements]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredMovements.length]);

  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMovements.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredMovements]);

  const totalAmount = useMemo(
    () => movements.reduce((sum, movement) => sum + Number(movement.amount ?? 0), 0),
    [movements]
  );

  const displayCurrency = movements[0]?.currency ?? accounts[0]?.currency ?? form.currency;
  const canCreateRecords = canCreateMovement(direction);
  const canEditRecords = isFinancialManager;
  const readOnly = !canEditRecords;
  const canSubmitForm = editingItem ? canEditRecords : canCreateRecords;

  function resetForm() {
    setForm(createDefaultForm(defaultMovementKind));
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

  function openEditDialog(item: MovementResponse) {
    setEditingItem(item);
    setForm({
      movement_date: item.movement_date,
      description: item.description ?? "",
      amount: String(item.amount ?? ""),
      currency: item.currency ?? "MXN",
      movement_kind: item.movement_kind,
      account_id: item.account_id ?? "",
      project_id: item.project_id ?? "",
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
        account_id: form.account_id || null,
        project_id: form.project_id || null,
        movement_date: form.movement_date,
        direction,
        movement_kind: form.movement_kind,
        amount: Number(form.amount),
        currency: form.currency.trim().toUpperCase(),
        description: form.description.trim() || null,
        notes: form.notes.trim() || null
      };
      const url = `${API_BASE_URL}/movements${editingItem ? `/${editingItem.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;

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
      await fetchJson(`${API_BASE_URL}/movements/${pendingDelete.id}?company_id=${encodeURIComponent(companyId)}`, {
        method: "DELETE",
        headers: {}
      });

      setPendingDelete(null);
      await load(companyId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  const tableColumns: Array<CrudTableColumn<MovementResponse>> = [
    {
      key: "movement_date",
      header: "Fecha",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">{item.movement_date}</p>
          <p className="mt-1 text-xs text-slate-500">{formatCreatedAt(item.created_at)}</p>
        </div>
      )
    },
    {
      key: "description",
      header: "Registro",
      cell: (item) => {
        const kindLabel = movementKindLabels[item.movement_kind] ?? item.movement_kind;
        return (
          <div>
            <p className="font-semibold text-white">{item.description || kindLabel}</p>
            <p className="mt-1 text-sm text-slate-400">{kindLabel}</p>
          </div>
        );
      }
    },
    {
      key: "account",
      header: "Cuenta",
      cell: (item) => (
        <div>
          <p className="font-medium text-white">{item.account_name ?? "Cuenta sin asignar"}</p>
          <p className="mt-1 text-xs text-slate-500">{item.account_id}</p>
        </div>
      )
    },
    {
      key: "project",
      header: "Obra",
      cell: (item) => (
        <div>
          <p className="font-medium text-white">{item.project_name ?? "Sin obra"}</p>
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
      key: "amount",
      header: "Monto",
      align: "right",
      cell: (item) => (
        <div>
          <p className={cn("font-semibold", amountToneClass)}>{formatMoney(Number(item.amount), item.currency || "MXN")}</p>
          <p className="mt-1 text-xs text-slate-500">{item.currency || "MXN"}</p>
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

  const inputClassName = cn(
    "w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:ring-4",
    styles.focusRing
  );

  return (
    <AppShell eyebrow={eyebrow} title={title} description={description}>
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <KpiCard label={totalLabel} value={formatMoney(totalAmount, displayCurrency)} metric={totalHint} />
          <KpiCard
            label="Registros"
            value={String(movements.length)}
            metric=""
          />
        </div>

        <Card>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
            </div>
            <div className="flex w-full min-w-0 flex-col items-end gap-3 lg:flex-1">
              <div className="flex flex-wrap justify-end gap-2">
                <span className={cn("rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]", styles.accentBadge)}>
                  {filteredMovements.length} visibles
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
                    placeholder="Descripcion, notas, cuenta..."
                    ariaLabel="Buscar registros"
                    ringClassName={styles.searchRing}
                  />
                </div>
                <Button variant="secondary" className="shrink-0 gap-2" disabled={loading} onClick={() => void load(companyId)}>
                  <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                  {loading ? "Cargando..." : "Actualizar"}
                </Button>
                <Button className={cn("shrink-0 gap-2", styles.primaryButton)} disabled={!canCreateRecords} onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  {createLabel}
                </Button>
              </div>
            </div>
          </div>

          <CrudTable
            columns={tableColumns}
            rows={paginatedMovements}
            loading={loading}
            totalItems={filteredMovements.length}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        </Card>
      </div>

      <Dialog
        open={isFormOpen}
        onClose={closeFormDialog}
        title={editingItem ? editLabel : createLabel}
        description={`Completa los campos para ${editingItem ? "actualizar" : "crear"} este ${recordLabel}.`}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => closeFormDialog()}>
              Cancelar
            </Button>
            <Button className={cn(styles.primaryButton)} disabled={saving || !canSubmitForm} type="submit" form="movement-form">
              {saving ? "Guardando..." : editingItem ? "Guardar cambios" : createLabel}
            </Button>
          </div>
        }
      >
        <form id="movement-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Descripcion</label>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe el movimiento"
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Fecha del movimiento</label>
            <DateInput
              value={form.movement_date}
              onChange={(value) => setForm((current) => ({ ...current, movement_date: value }))}
              placeholder="DD/MM/AAAA"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Monto</label>
            <MoneyInput
              value={form.amount}
              onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Cuenta</label>
            <select
              value={form.account_id}
              onChange={(event) => setForm((current) => ({ ...current, account_id: event.target.value }))}
              className={inputClassName}
              required
            >
              <option value="">Selecciona una cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.account_type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Obra</label>
            <select
              value={form.project_id}
              onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}
              className={inputClassName}
            >
              <option value="">Sin obra asignada</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.code ? ` (${project.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Tipo</label>
            <select
              value={form.movement_kind}
              onChange={(event) =>
                setForm((current) => ({ ...current, movement_kind: event.target.value as MovementKind }))
              }
              className={inputClassName}
            >
              {movementKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Notas</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Contexto opcional"
              rows={4}
              className={cn(inputClassName, "resize-none")}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Eliminar ${recordLabel}`}
        description={
          pendingDelete
            ? `El registro "${pendingDelete.description || movementKindLabels[pendingDelete.movement_kind] || pendingDelete.movement_kind}" se eliminara de esta lista.`
            : ""
        }
        confirmLabel="Eliminar registro"
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
