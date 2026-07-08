"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import type { BusinessPartnerResponse } from "@expenses/shared";
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
  getRoleLabel,
  useDemoRole
} from "../../lib/finance-demo";

const PAGE_SIZE = 8;

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" }
] as const;

type ClientStatus = (typeof STATUS_OPTIONS)[number]["value"];

type Accent = "cyan" | "amber";

type PartnerCrudPageProps = {
  partnerType: "client" | "supplier";
  accent: Accent;
  eyebrow: string;
  title: string;
  description: string;
  createLabel: string;
  recordLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
};

type PartnerFormState = {
  name: string;
  legal_name: string;
  contact_name: string;
  email: string;
  phone: string;
  rfc: string;
  tax_regime: string;
  fiscal_postal_code: string;
  address: string;
  status: ClientStatus;
  notes: string;
};

const accentStyles: Record<
  Accent,
  {
    button: string;
    panel: string;
    badge: string;
    focus: string;
    activeStatus: string;
  }
> = {
  cyan: {
    button: "bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:hover:bg-cyan-400",
    panel: "from-cyan-500/12 via-cyan-500/5 to-slate-950",
    badge: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    focus: "focus:border-cyan-400 focus:ring-cyan-400/20",
    activeStatus: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"
  },
  amber: {
    button: "bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:hover:bg-amber-400",
    panel: "from-amber-500/14 via-amber-500/5 to-slate-950",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    focus: "focus:border-amber-400 focus:ring-amber-400/20",
    activeStatus: "border-amber-500/20 bg-amber-500/10 text-amber-200"
  }
};

function createDefaultForm(): PartnerFormState {
  return {
    name: "",
    legal_name: "",
    contact_name: "",
    email: "",
    phone: "",
    rfc: "",
    tax_regime: "",
    fiscal_postal_code: "",
    address: "",
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

function getStatusLabel(status: string) {
  return status === "inactive" ? "Inactivo" : "Activo";
}

function getStatusBadgeClass(status: string, accent: Accent) {
  if (status === "inactive") {
    return "border-slate-600/40 bg-slate-800/80 text-slate-200";
  }

  return accentStyles[accent].activeStatus;
}

export function PartnerCrudPage({
  partnerType,
  accent,
  eyebrow,
  title,
  description,
  createLabel,
  recordLabel,
  searchPlaceholder,
  emptyTitle,
  emptyDescription
}: PartnerCrudPageProps) {
  const styles = accentStyles[accent];
  const [companyId, setCompanyId] = useState(DEFAULT_COMPANY_ID);
  const [companyIdInput, setCompanyIdInput] = useState(DEFAULT_COMPANY_ID);
  const [partners, setPartners] = useState<BusinessPartnerResponse[]>([]);
  const [form, setForm] = useState<PartnerFormState>(() => createDefaultForm());
  const [loading, setLoading] = useState(Boolean(DEFAULT_COMPANY_ID));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<BusinessPartnerResponse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BusinessPartnerResponse | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [role, setRole] = useDemoRole();
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function load(targetCompanyId = companyId) {
    if (!targetCompanyId) {
      setLoading(false);
      setError(null);
      setPartners([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchJson(
        `${API_BASE_URL}/business-partners?company_id=${encodeURIComponent(targetCompanyId)}&partner_type=${partnerType}&limit=120`
      );

      setPartners((response.partners ?? []) as BusinessPartnerResponse[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, partnerType]);

  const filteredPartners = useMemo(() => {
    if (!deferredSearch) return partners;

    return partners.filter((partner) => {
      const haystack = [
        partner.name,
        partner.legal_name,
        partner.contact_name,
        partner.email,
        partner.phone,
        partner.rfc,
        partner.tax_regime,
        partner.fiscal_postal_code,
        partner.address,
        getStatusLabel(partner.status)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, partners]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPartners.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredPartners.length]);

  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPartners.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredPartners]);

  const activeCount = useMemo(
    () => partners.filter((partner) => partner.status === "active").length,
    [partners]
  );
  const inactiveCount = useMemo(
    () => partners.filter((partner) => partner.status === "inactive").length,
    [partners]
  );
  const contactCoverage = useMemo(
    () => partners.filter((partner) => Boolean(partner.email || partner.phone || partner.contact_name)).length,
    [partners]
  );

  const latestUpdatedAt =
    partners[0]?.updated_at ? formatDateTime(partners[0].updated_at) : "Sin actividad reciente";
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

  function openEditDialog(item: BusinessPartnerResponse) {
    setEditingItem(item);
    setForm({
      name: item.name,
      legal_name: item.legal_name ?? "",
      contact_name: item.contact_name ?? "",
      email: item.email ?? "",
      phone: item.phone ?? "",
      rfc: item.rfc ?? "",
      tax_regime: item.tax_regime ?? "",
      fiscal_postal_code: item.fiscal_postal_code ?? "",
      address: item.address ?? "",
      status: item.status === "inactive" ? "inactive" : "active",
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
        partner_type: partnerType,
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        rfc: form.rfc.trim() || null,
        tax_regime: form.tax_regime.trim() || null,
        fiscal_postal_code: form.fiscal_postal_code.trim() || null,
        address: form.address.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null
      };

      const url = `${API_BASE_URL}/business-partners${editingItem ? `/${editingItem.id}` : ""}?company_id=${encodeURIComponent(companyId)}`;

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
      await fetchJson(
        `${API_BASE_URL}/business-partners/${pendingDelete.id}?company_id=${encodeURIComponent(companyId)}`,
        {
          method: "DELETE",
          headers: { "x-user-role": role }
        }
      );

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

  const tableColumns: Array<CrudTableColumn<BusinessPartnerResponse>> = [
    {
      key: "partner",
      header: partnerType === "client" ? "Cliente" : "Proveedor",
      cell: (item) => (
        <div>
          <p className="font-semibold text-white">{item.name}</p>
          <p className="mt-1 text-xs text-slate-500">{item.legal_name || "Sin razon social"}</p>
        </div>
      )
    },
    {
      key: "contact",
      header: "Contacto",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>{item.contact_name || "Sin contacto"}</p>
          <p>{item.email || item.phone || "Sin datos de contacto"}</p>
        </div>
      )
    },
    {
      key: "fiscal",
      header: "Fiscal",
      cell: (item) => (
        <div className="space-y-1 text-sm text-slate-300">
          <p>RFC: {item.rfc || "Sin RFC"}</p>
          <p>CP: {item.fiscal_postal_code || "Sin codigo postal"}</p>
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
              getStatusBadgeClass(item.status, accent)
            )}
          >
            {getStatusLabel(item.status)}
          </span>
          <p className="max-w-xs text-sm leading-6 text-slate-400">{item.notes || item.address || "Sin notas"}</p>
        </div>
      )
    },
    {
      key: "updated_at",
      header: "Actualizado",
      cell: (item) => <p className="text-sm text-slate-300">{formatDateTime(item.updated_at)}</p>
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
    styles.focus
  );

  return (
    <AppShell eyebrow={eyebrow} title={title} description={description}>
      <div className="space-y-6">
        {error ? (
          <Card className="border border-rose-500/20 bg-rose-500/5 text-rose-200">
            <p>{error}</p>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <KpiCard
            label={partnerType === "client" ? "Clientes activos" : "Proveedores activos"}
            value={String(activeCount)}
            metric={`${inactiveCount} inactivos en el catalogo.`}
          />
          <KpiCard
            label="Cobertura de contacto"
            value={String(contactCoverage)}
            metric={`${partners.length} registros cargados desde el backend.`}
          />
          <Card className={cn("relative overflow-hidden bg-gradient-to-br", styles.panel)}>
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Estado del espacio</p>
            <p className="mt-3 text-2xl font-semibold text-white">{getRoleLabel(role)}</p>
            <p className="mt-2 text-sm text-slate-300">
              {readOnly
                ? "El modo de solo lectura deja visible el catalogo sin permitir cambios."
                : "El modo administrador deja la gestion del catalogo a un clic."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]", styles.badge)}>
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
              <label className="text-sm font-medium text-slate-300">
                Buscar {partnerType === "client" ? "clientes" : "proveedores"}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
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
              <Button className={cn("h-[52px] w-full gap-2", styles.button)} disabled={readOnly} onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                {createLabel}
              </Button>
            </div>
          </form>

          <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 text-sm text-slate-400">
            {companyId
              ? `Empresa activa: ${companyId}`
              : "Define un ID de empresa y actualiza para cargar el catalogo en la tabla."}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Catalogo registrado</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm text-slate-400">
                Revisa razon social, datos de contacto y estatus sin salir de la tabla.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={cn("rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]", styles.badge)}>
                {filteredPartners.length} visibles
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
            rows={paginatedPartners}
            loading={loading}
            totalItems={filteredPartners.length}
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
        title={editingItem ? `Editar ${recordLabel}` : createLabel}
        description={`Completa los campos para ${editingItem ? "actualizar" : "crear"} este ${recordLabel}.`}
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => closeFormDialog()}>
              Cancelar
            </Button>
            <Button className={styles.button} disabled={saving || readOnly} type="submit" form="partner-form">
              {saving ? "Guardando..." : editingItem ? "Guardar cambios" : createLabel}
            </Button>
          </div>
        }
      >
        <form id="partner-form" onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nombre comercial</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={partnerType === "client" ? "Constructora del Norte" : "Ferremayorista"}
              className={inputClassName}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Razon social</label>
            <input
              value={form.legal_name}
              onChange={(event) => setForm((current) => ({ ...current, legal_name: event.target.value }))}
              placeholder="Razon social completa"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Contacto</label>
            <input
              value={form.contact_name}
              onChange={(event) => setForm((current) => ({ ...current, contact_name: event.target.value }))}
              placeholder="Nombre del contacto"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Estado</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as ClientStatus }))
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
            <label className="text-sm font-medium text-slate-300">RFC</label>
            <input
              value={form.rfc}
              onChange={(event) => setForm((current) => ({ ...current, rfc: event.target.value }))}
              placeholder="ABC123456XYZ"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Regimen fiscal</label>
            <input
              value={form.tax_regime}
              onChange={(event) => setForm((current) => ({ ...current, tax_regime: event.target.value }))}
              placeholder="601 General de Ley Personas Morales"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Codigo postal fiscal</label>
            <input
              value={form.fiscal_postal_code}
              onChange={(event) =>
                setForm((current) => ({ ...current, fiscal_postal_code: event.target.value }))
              }
              placeholder="64000"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Direccion</label>
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Direccion fiscal o comercial"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Notas</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Observaciones comerciales o administrativas"
              rows={4}
              className={cn(inputClassName, "resize-none")}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Eliminar ${recordLabel}`}
        description={pendingDelete ? `El ${recordLabel} "${pendingDelete.name}" se eliminara del catalogo.` : ""}
        confirmLabel={`Eliminar ${recordLabel}`}
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
