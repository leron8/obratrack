import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  MovementDirection,
  MovementKind,
  MovementResponse,
  DashboardSummary,
  AccountBalance,
  ExpenseByCategory,
  ParsedMovement,
  PaymentMethod,
  AccountMovementRow,
  BusinessPartnerRow,
  BusinessPartnerResponse,
  EmployeeRow,
  EmployeeResponse,
  ProjectRow,
  ProjectResponse,
  ProjectStatus,
  PartnerType,
  VehicleRow,
  VehicleResponse,
  WhatsAppCaptureTarget,
  WhatsAppCaptureStatus,
  FinancialDocumentRow,
  PayrollRun,
  PayrollLine,
  EmployeeLoanBalance
} from "@expenses/shared";

export type AuditContext = {
  requestId: string;
  actorProfileId: string | null;
  actorType: "user" | "system" | "whatsapp_contact" | "import" | "api";
  actorLabel: string | null;
  sourceModule: string;
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string;
  httpPath: string;
  reason: string | null;
  idempotencyKey: string | null;
};

// ── Client factory ────────────────────────────────────────────────────

export function createSupabaseClient({
  url,
  key,
  serviceRoleKey,
  globalHeaders
}: {
  url: string;
  key?: string;
  serviceRoleKey?: string;
  globalHeaders?: Record<string, string>;
}): SupabaseClient {
  const resolvedKey = key ?? serviceRoleKey;
  if (!resolvedKey) {
    throw new Error("Missing Supabase key when creating a client.");
  }

  return createClient(url, resolvedKey, {
    auth: { persistSession: false },
    ...(globalHeaders ? { global: { headers: globalHeaders } } : {})
  });
}

export function createSupabaseUserClient({
  url,
  publishableKey,
  accessToken,
  globalHeaders
}: {
  url: string;
  publishableKey: string;
  accessToken: string;
  globalHeaders?: Record<string, string>;
}): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    accessToken: async () => accessToken,
    ...(globalHeaders ? { global: { headers: globalHeaders } } : {})
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function setActorColumn({
  row,
  column,
  auditContext
}: {
  row: Record<string, unknown>;
  column: "created_by" | "updated_by" | "deleted_by";
  auditContext?: AuditContext;
}) {
  if (auditContext?.actorProfileId && row[column] === undefined) {
    row[column] = auditContext.actorProfileId;
  }
}

function normalizeMovementRow(row: AccountMovementRow): MovementResponse {
  return {
    id: row.id,
    company_id: row.company_id,
    account_id: row.account_id,
    movement_date: row.movement_date,
    direction: row.direction,
    movement_kind: row.movement_kind,
    amount: Number(row.amount),
    currency: row.currency,
    payment_method: row.payment_method,
    status: row.status,
    business_partner_id: row.business_partner_id,
    employee_id: row.employee_id,
    project_id: row.project_id,
    vehicle_id: row.vehicle_id,
    expense_category_id: row.expense_category_id,
    cost_center_id: row.cost_center_id,
    description: row.description,
    notes: row.notes,
    is_internal_transfer: row.is_internal_transfer,
    created_at: row.created_at
  };
}

function normalizeProjectRow(
  row: ProjectRow & {
    business_partners?: { name?: string | null } | null;
  }
): ProjectResponse {
  return {
    id: row.id,
    company_id: row.company_id,
    client_id: row.client_id,
    client_name: row.business_partners?.name ?? null,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    budget: Number(row.budget),
    start_date: row.start_date,
    estimated_end_date: row.estimated_end_date,
    completed_at: row.completed_at,
    address: row.address,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeBusinessPartnerRow(row: BusinessPartnerRow): BusinessPartnerResponse {
  return {
    id: row.id,
    company_id: row.company_id,
    partner_type: row.partner_type,
    name: row.name,
    legal_name: row.legal_name,
    rfc: row.rfc,
    tax_regime: row.tax_regime,
    fiscal_postal_code: row.fiscal_postal_code,
    email: row.email,
    phone: row.phone,
    contact_name: row.contact_name,
    address: row.address,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeEmployeeRow(row: EmployeeRow): EmployeeResponse {
  return {
    id: row.id,
    company_id: row.company_id,
    employee_code: row.employee_code,
    worker_type: row.worker_type,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: row.full_name,
    rfc: row.rfc,
    curp: row.curp,
    nss: row.nss,
    email: row.email,
    phone: row.phone,
    position: row.position,
    default_daily_rate: row.default_daily_rate === null ? null : Number(row.default_daily_rate),
    default_weekly_salary: row.default_weekly_salary === null ? null : Number(row.default_weekly_salary),
    status: row.status,
    hire_date: row.hire_date,
    termination_date: row.termination_date,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeVehicleRow(
  row: VehicleRow & {
    projects?: { name?: string | null; code?: string | null } | null;
    employees?: { full_name?: string | null; employee_code?: string | null } | null;
  }
): VehicleResponse {
  return {
    id: row.id,
    company_id: row.company_id,
    plate: row.plate,
    economic_number: row.economic_number,
    vin: row.vin,
    brand: row.brand,
    model_name: row.model_name,
    model_year: row.model_year,
    color: row.color,
    vehicle_type: row.vehicle_type,
    status: row.status,
    purchase_date: row.purchase_date,
    purchase_value: row.purchase_value === null ? null : Number(row.purchase_value),
    default_project_id: row.default_project_id,
    default_project_name: row.projects?.name ?? null,
    default_project_code: row.projects?.code ?? null,
    responsible_employee_id: row.responsible_employee_id,
    responsible_employee_name: row.employees?.full_name ?? null,
    responsible_employee_code: row.employees?.employee_code ?? null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

type PayrollRunRow = {
  id: string;
  company_id: string;
  run_number: string | null;
  week_number: number | null;
  period_start: string;
  period_end: string;
  status: PayrollRun["status"];
  description: string | null;
  source_file: string | null;
  source_sheet: string | null;
  created_at: string;
  updated_at: string;
};

type PayrollRunSummaryRow = {
  payroll_run_id: string;
  line_count: number | string | null;
  employee_count: number | string | null;
  project_count: number | string | null;
  gross_total: number | string | null;
  loan_deductions_total: number | string | null;
  other_deductions_total: number | string | null;
  net_total: number | string | null;
};

type PayrollLineRow = {
  id: string;
  company_id: string;
  payroll_run_id: string;
  employee_id: string | null;
  worker_name: string | null;
  project_id: string | null;
  cost_center_id: string | null;
  role_or_task: string | null;
  days_worked: number | string | null;
  gross_amount: number | string;
  loan_deduction_amount: number | string;
  other_deduction_amount: number | string;
  net_amount: number | string;
  payment_method: PaymentMethod;
  account_movement_id: string | null;
  notes: string | null;
  source_row: number | null;
  created_at: string;
  updated_at: string;
};

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Number(value);
}

function normalizePayrollRunRow(
  row: PayrollRunRow,
  summary?: PayrollRunSummaryRow | null
): PayrollRun {
  return {
    id: row.id,
    company_id: row.company_id,
    run_number: row.run_number,
    week_number: row.week_number,
    period_start: row.period_start,
    period_end: row.period_end,
    status: row.status,
    description: row.description,
    source_file: row.source_file,
    source_sheet: row.source_sheet,
    created_at: row.created_at,
    updated_at: row.updated_at,
    line_count: asNumber(summary?.line_count),
    employee_count: asNumber(summary?.employee_count),
    project_count: asNumber(summary?.project_count),
    gross_total: asNumber(summary?.gross_total),
    loan_deductions_total: asNumber(summary?.loan_deductions_total),
    other_deductions_total: asNumber(summary?.other_deductions_total),
    net_total: asNumber(summary?.net_total)
  };
}

function normalizePayrollLineRow(
  row: PayrollLineRow & {
    employees?: { full_name?: string | null; employee_code?: string | null } | null;
    projects?: { name?: string | null; code?: string | null } | null;
  }
): PayrollLine {
  return {
    id: row.id,
    company_id: row.company_id,
    payroll_run_id: row.payroll_run_id,
    employee_id: row.employee_id,
    employee_name: row.employees?.full_name ?? null,
    employee_code: row.employees?.employee_code ?? null,
    worker_name: row.worker_name,
    project_id: row.project_id,
    project_name: row.projects?.name ?? null,
    project_code: row.projects?.code ?? null,
    cost_center_id: row.cost_center_id,
    role_or_task: row.role_or_task,
    days_worked: row.days_worked === null ? null : Number(row.days_worked),
    gross_amount: Number(row.gross_amount),
    loan_deduction_amount: Number(row.loan_deduction_amount),
    other_deduction_amount: Number(row.other_deduction_amount),
    net_amount: Number(row.net_amount),
    payment_method: row.payment_method,
    account_movement_id: row.account_movement_id,
    notes: row.notes,
    source_row: row.source_row,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ── Account movements CRUD ────────────────────────────────────────────

export async function insertMovement({
  db,
  companyId,
  payload,
  auditContext
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
  auditContext?: AuditContext;
}): Promise<MovementResponse> {
  const row = { ...payload, company_id: companyId };
  setActorColumn({ row, column: "created_by", auditContext });

  const { data, error } = await db
    .from("account_movements")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeMovementRow(data as AccountMovementRow);
}

export async function createMovement({
  db,
  companyId,
  payload,
  auditContext
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
  auditContext?: AuditContext;
}): Promise<MovementResponse> {
  return insertMovement({ db, companyId, payload, auditContext });
}

export async function updateMovement({
  db,
  companyId,
  movementId,
  payload,
  auditContext
}: {
  db: SupabaseClient;
  companyId: string;
  movementId: string;
  payload: Record<string, unknown>;
  auditContext?: AuditContext;
}): Promise<MovementResponse> {
  const row = { ...payload };
  setActorColumn({ row, column: "updated_by", auditContext });

  const { data, error } = await db
    .from("account_movements")
    .update(row)
    .eq("id", movementId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeMovementRow(data as AccountMovementRow);
}

export async function deleteMovement({
  db,
  companyId,
  movementId,
  auditContext,
  reason
}: {
  db: SupabaseClient;
  companyId: string;
  movementId: string;
  auditContext?: AuditContext;
  reason?: string | null;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    deleted_at: new Date().toISOString()
  };
  setActorColumn({ row: payload, column: "deleted_by", auditContext });
  const deleteReason = reason ?? auditContext?.reason ?? null;
  if (deleteReason) {
    payload.deleted_reason = deleteReason;
  }

  const { error } = await db
    .from("account_movements")
    .update(payload)
    .eq("id", movementId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function listMovements({
  db,
  companyId,
  limit,
  direction,
  movementKind
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
  direction?: MovementDirection;
  movementKind?: MovementKind;
}): Promise<MovementResponse[]> {
  let query = db
    .from("account_movements")
    .select("*, financial_accounts!account_id(name), business_partners!business_partner_id(name), employees!employee_id(full_name), projects!project_id(name), vehicles!vehicle_id(plate), expense_categories!expense_category_id(name)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (direction) {
    query = query.eq("direction", direction);
  }
  if (movementKind) {
    query = query.eq("movement_kind", movementKind);
  }

  const { data, error } = await query;

  if (error) throw error;

  return ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    company_id: row.company_id,
    account_id: row.account_id,
    account_name: row.financial_accounts?.name ?? null,
    movement_date: row.movement_date,
    direction: row.direction,
    movement_kind: row.movement_kind,
    amount: Number(row.amount),
    currency: row.currency,
    payment_method: row.payment_method,
    status: row.status,
    business_partner_id: row.business_partner_id,
    business_partner_name: row.business_partners?.name ?? null,
    employee_id: row.employee_id,
    employee_name: row.employees?.full_name ?? null,
    project_id: row.project_id,
    project_name: row.projects?.name ?? null,
    vehicle_id: row.vehicle_id,
    vehicle_plate: row.vehicles?.plate ?? null,
    expense_category_id: row.expense_category_id,
    expense_category_name: row.expense_categories?.name ?? null,
    cost_center_id: row.cost_center_id,
    description: row.description,
    notes: row.notes,
    is_internal_transfer: row.is_internal_transfer,
    created_at: row.created_at
  }));
}

export async function getMovement({
  db,
  companyId,
  movementId
}: {
  db: SupabaseClient;
  companyId: string;
  movementId: string;
}): Promise<MovementResponse | null> {
  const { data, error } = await db
    .from("account_movements")
    .select("*, financial_accounts!account_id(name), business_partners!business_partner_id(name), employees!employee_id(full_name), projects!project_id(name), vehicles!vehicle_id(plate), expense_categories!expense_category_id(name)")
    .eq("id", movementId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  const row = data as any;
  return {
    id: row.id,
    company_id: row.company_id,
    account_id: row.account_id,
    account_name: row.financial_accounts?.name ?? null,
    movement_date: row.movement_date,
    direction: row.direction,
    movement_kind: row.movement_kind,
    amount: Number(row.amount),
    currency: row.currency,
    payment_method: row.payment_method,
    status: row.status,
    business_partner_id: row.business_partner_id,
    business_partner_name: row.business_partners?.name ?? null,
    employee_id: row.employee_id,
    employee_name: row.employees?.full_name ?? null,
    project_id: row.project_id,
    project_name: row.projects?.name ?? null,
    vehicle_id: row.vehicle_id,
    vehicle_plate: row.vehicles?.plate ?? null,
    expense_category_id: row.expense_category_id,
    expense_category_name: row.expense_categories?.name ?? null,
    cost_center_id: row.cost_center_id,
    description: row.description,
    notes: row.notes,
    is_internal_transfer: row.is_internal_transfer,
    created_at: row.created_at
  };
}

// ── Projects CRUD ─────────────────────────────────────────────────────

export async function listProjects({
  db,
  companyId,
  limit,
  status
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
  status?: ProjectStatus;
}): Promise<ProjectResponse[]> {
  let query = db
    .from("projects")
    .select("*, business_partners!client_id(name)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as Array<ProjectRow & { business_partners?: { name?: string | null } | null }>).map(
    normalizeProjectRow
  );
}

export async function getProject({
  db,
  companyId,
  projectId
}: {
  db: SupabaseClient;
  companyId: string;
  projectId: string;
}): Promise<ProjectResponse | null> {
  const { data, error } = await db
    .from("projects")
    .select("*, business_partners!client_id(name)")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return normalizeProjectRow(
    data as ProjectRow & {
      business_partners?: { name?: string | null } | null;
    }
  );
}

export async function createProject({
  db,
  companyId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
}): Promise<ProjectResponse> {
  const { data, error } = await db
    .from("projects")
    .insert({ ...payload, company_id: companyId })
    .select("*, business_partners!client_id(name)")
    .single();

  if (error) throw error;
  return normalizeProjectRow(
    data as ProjectRow & {
      business_partners?: { name?: string | null } | null;
    }
  );
}

export async function updateProject({
  db,
  companyId,
  projectId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  projectId: string;
  payload: Record<string, unknown>;
}): Promise<ProjectResponse> {
  const { data, error } = await db
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .eq("company_id", companyId)
    .select("*, business_partners!client_id(name)")
    .single();

  if (error) throw error;
  return normalizeProjectRow(
    data as ProjectRow & {
      business_partners?: { name?: string | null } | null;
    }
  );
}

export async function deleteProject({
  db,
  companyId,
  projectId
}: {
  db: SupabaseClient;
  companyId: string;
  projectId: string;
}): Promise<void> {
  const { error } = await db
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// ── Employees CRUD ────────────────────────────────────────────────────

export async function listEmployees({
  db,
  companyId,
  limit,
  status
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
  status?: EmployeeResponse["status"];
}): Promise<EmployeeResponse[]> {
  let query = db
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as EmployeeRow[]).map(normalizeEmployeeRow);
}

export async function getEmployee({
  db,
  companyId,
  employeeId
}: {
  db: SupabaseClient;
  companyId: string;
  employeeId: string;
}): Promise<EmployeeResponse | null> {
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return normalizeEmployeeRow(data as EmployeeRow);
}

export async function createEmployee({
  db,
  companyId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
}): Promise<EmployeeResponse> {
  const { data, error } = await db
    .from("employees")
    .insert({ ...payload, company_id: companyId })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeEmployeeRow(data as EmployeeRow);
}

export async function updateEmployee({
  db,
  companyId,
  employeeId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  employeeId: string;
  payload: Record<string, unknown>;
}): Promise<EmployeeResponse> {
  const { data, error } = await db
    .from("employees")
    .update(payload)
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeEmployeeRow(data as EmployeeRow);
}

export async function deleteEmployee({
  db,
  companyId,
  employeeId
}: {
  db: SupabaseClient;
  companyId: string;
  employeeId: string;
}): Promise<void> {
  const { error } = await db
    .from("employees")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", employeeId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// ── Vehicles CRUD ─────────────────────────────────────────────────────

export async function listVehicles({
  db,
  companyId,
  limit,
  status
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
  status?: string;
}): Promise<VehicleResponse[]> {
  let query = db
    .from("vehicles")
    .select("*, projects!default_project_id(name, code), employees!responsible_employee_id(full_name, employee_code)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (
    (data ?? []) as Array<
      VehicleRow & {
        projects?: { name?: string | null; code?: string | null } | null;
        employees?: { full_name?: string | null; employee_code?: string | null } | null;
      }
    >
  ).map(normalizeVehicleRow);
}

export async function getVehicle({
  db,
  companyId,
  vehicleId
}: {
  db: SupabaseClient;
  companyId: string;
  vehicleId: string;
}): Promise<VehicleResponse | null> {
  const { data, error } = await db
    .from("vehicles")
    .select("*, projects!default_project_id(name, code), employees!responsible_employee_id(full_name, employee_code)")
    .eq("id", vehicleId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return normalizeVehicleRow(
    data as VehicleRow & {
      projects?: { name?: string | null; code?: string | null } | null;
      employees?: { full_name?: string | null; employee_code?: string | null } | null;
    }
  );
}

export async function createVehicle({
  db,
  companyId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
}): Promise<VehicleResponse> {
  const { data, error } = await db
    .from("vehicles")
    .insert({ ...payload, company_id: companyId })
    .select("*, projects!default_project_id(name, code), employees!responsible_employee_id(full_name, employee_code)")
    .single();

  if (error) throw error;
  return normalizeVehicleRow(
    data as VehicleRow & {
      projects?: { name?: string | null; code?: string | null } | null;
      employees?: { full_name?: string | null; employee_code?: string | null } | null;
    }
  );
}

export async function updateVehicle({
  db,
  companyId,
  vehicleId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  vehicleId: string;
  payload: Record<string, unknown>;
}): Promise<VehicleResponse> {
  const { data, error } = await db
    .from("vehicles")
    .update(payload)
    .eq("id", vehicleId)
    .eq("company_id", companyId)
    .select("*, projects!default_project_id(name, code), employees!responsible_employee_id(full_name, employee_code)")
    .single();

  if (error) throw error;
  return normalizeVehicleRow(
    data as VehicleRow & {
      projects?: { name?: string | null; code?: string | null } | null;
      employees?: { full_name?: string | null; employee_code?: string | null } | null;
    }
  );
}

export async function deleteVehicle({
  db,
  companyId,
  vehicleId
}: {
  db: SupabaseClient;
  companyId: string;
  vehicleId: string;
}): Promise<void> {
  const { error } = await db
    .from("vehicles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// ── Monthly report ────────────────────────────────────────────────────

export async function reportMonthMovements({
  db,
  companyId,
  startInclusive,
  endExclusive
}: {
  db: SupabaseClient;
  companyId: string;
  startInclusive: string;
  endExclusive: string;
}): Promise<{
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
}> {
  const { data, error } = await db
    .from("account_movements")
    .select("direction, amount")
    .eq("company_id", companyId)
    .eq("status", "posted")
    .is("deleted_at", null)
    .gte("movement_date", startInclusive)
    .lt("movement_date", endExclusive);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ direction: MovementDirection; amount: string }>;
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.direction === "in") incomeTotal += amt;
    else expenseTotal += amt;
  }

  return {
    incomeTotal,
    expenseTotal,
    balance: incomeTotal - expenseTotal
  };
}

// ── Dashboard (resilient: falls back gracefully if views/tables missing) ──

async function safeQuery<T>(
  builder: any,
  fallback: T,
  label: string
): Promise<{ data: T; error?: any }> {
  try {
    const result: { data: T | null; error: any } = await builder;
    if (result.error) {
      console.warn(`Dashboard query "${label}" returned error:`, result.error);
      return { data: fallback, error: result.error };
    }
    return { data: (result.data ?? fallback) as T };
  } catch (err) {
    console.warn(`Dashboard query "${label}" threw:`, err);
    return { data: fallback, error: err };
  }
}

export async function getDashboardSummary({
  db,
  companyId,
  limit
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
}): Promise<DashboardSummary> {
  // Use safeQuery for each parallel call so a missing table/view won't crash the whole dashboard.
  const [
    movementsResult,
    balancesResult,
    recentResult,
    projectsResult,
    vehiclesResult,
    documentsResult
  ] = await Promise.all([
    safeQuery(
      db
        .from("account_movements")
        .select("direction, amount")
        .eq("company_id", companyId)
        .eq("status", "posted")
        .is("deleted_at", null)
        .limit(2000),
      [],
      "account_movements (aggregate)"
    ),
    safeQuery(
      db
        .from("vw_account_balances")
        .select("*")
        .eq("company_id", companyId),
      [],
      "vw_account_balances"
    ),
    safeQuery(
      db
        .from("account_movements")
        .select("*, financial_accounts!account_id(name)")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("movement_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      [],
      "account_movements (recent)"
    ),
    safeQuery(
      db
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active")
        .is("deleted_at", null),
      { count: 0 },
      "projects"
    ),
    safeQuery(
      db
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active")
        .is("deleted_at", null),
      { count: 0 },
      "vehicles"
    ),
    safeQuery(
      db
        .from("vw_document_balances")
        .select("document_id")
        .eq("company_id", companyId)
        .gt("balance_amount", 0),
      [],
      "vw_document_balances"
    )
  ]);

  // Income/expense totals
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const row of (movementsResult.data ?? []) as Array<{ direction: MovementDirection; amount: string }>) {
    const amt = Number(row.amount);
    if (row.direction === "in") incomeTotal += amt;
    else expenseTotal += amt;
  }

  // Account balances
  let accountBalances: AccountBalance[] = [];
  if (balancesResult.data) {
    accountBalances = (balancesResult.data as any[]).map((row: any) => ({
      company_id: row.company_id,
      account_id: row.account_id,
      account_name: row.account_name,
      account_type: row.account_type,
      currency: row.currency,
      opening_balance: Number(row.opening_balance),
      movement_delta: Number(row.movement_delta),
      current_balance: Number(row.current_balance),
      last_movement_date: row.last_movement_date ?? null
    }));
  }

  // Recent movements
  const recentMovements: MovementResponse[] = ((recentResult.data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    company_id: row.company_id,
    account_id: row.account_id,
    account_name: row.financial_accounts?.name ?? null,
    movement_date: row.movement_date,
    direction: row.direction,
    movement_kind: row.movement_kind,
    amount: Number(row.amount),
    currency: row.currency,
    payment_method: row.payment_method,
    status: row.status,
    business_partner_id: row.business_partner_id,
    employee_id: row.employee_id,
    project_id: row.project_id,
    vehicle_id: row.vehicle_id,
    expense_category_id: row.expense_category_id,
    cost_center_id: row.cost_center_id,
    description: row.description,
    notes: row.notes,
    is_internal_transfer: row.is_internal_transfer,
    created_at: row.created_at
  }));

  // Expenses by category — query movements with direction='out' grouped by expense_category
  const expenseMovementsResult = await safeQuery(
    db
      .from("account_movements")
      .select("expense_category_id, amount")
      .eq("company_id", companyId)
      .eq("direction", "out")
      .eq("status", "posted")
      .is("deleted_at", null),
    [],
    "account_movements (expense categories)"
  );

  const expenseRows = (expenseMovementsResult.data ?? []) as Array<{
    expense_category_id: string | null;
    amount: string;
  }>;

  const categoryIds = Array.from(
    new Set(expenseRows.map((r) => r.expense_category_id).filter((id): id is string => Boolean(id)))
  );

  let categoryNameMap = new Map<string, string>();
  if (categoryIds.length > 0) {
    const catResult = await db
      .from("expense_categories")
      .select("id, name")
      .in("id", categoryIds);

    if (!catResult.error) {
      categoryNameMap = new Map(
        (catResult.data ?? []).map((row: { id: string; name: string }) => [row.id, row.name])
      );
    }
  }

  const categoryMap = new Map<string, number>();
  for (const row of expenseRows) {
    const category = row.expense_category_id
      ? categoryNameMap.get(row.expense_category_id) ?? "Uncategorized"
      : "Uncategorized";
    const amt = Number(row.amount);
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + amt);
  }

  const expensesByCategory: ExpenseByCategory[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const activeProjects = (projectsResult.data as any)?.count ?? 0;
  const activeVehicles = (vehiclesResult.data as any)?.count ?? 0;
  const pendingDocuments = ((documentsResult.data ?? []) as any[]).length;

  return {
    incomeTotal,
    expenseTotal,
    balance: incomeTotal - expenseTotal,
    accountBalances,
    recentMovements,
    expensesByCategory,
    activeProjects,
    activeVehicles,
    pendingDocuments
  };
}

// ── WhatsApp capture drafts ───────────────────────────────────────────

export type WhatsAppCaptureDraft = {
  id: string;
  company_id: string;
  contact_id: string | null;
  source_message_id: string;
  confirmation_message_id: string | null;
  status: WhatsAppCaptureStatus;
  target_type: WhatsAppCaptureTarget;
  parsed_payload: Record<string, unknown>;
  transcript: string | null;
  account_id: string | null;
  direction: MovementDirection | null;
  movement_kind: MovementKind | null;
  amount: number | null;
  currency: string;
  payment_method: PaymentMethod | null;
  movement_date: string | null;
  business_partner_id: string | null;
  employee_id: string | null;
  project_id: string | null;
  vehicle_id: string | null;
  expense_category_id: string | null;
  cost_center_id: string | null;
  description: string | null;
  account_movement_id: string | null;
  financial_document_id: string | null;
  payroll_line_id: string | null;
  fuel_transaction_id: string | null;
  employee_loan_id: string | null;
  partner_loan_id: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
  rejected_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function insertCaptureDraft({
  db,
  companyId,
  contactId,
  sourceMessageId,
  targetType,
  parsedPayload,
  transcript,
  parsed
}: {
  db: SupabaseClient;
  companyId: string;
  contactId: string | null;
  sourceMessageId: string;
  targetType: WhatsAppCaptureTarget;
  parsedPayload: Record<string, unknown>;
  transcript: string | null;
  parsed: ParsedMovement;
}): Promise<WhatsAppCaptureDraft> {
  const payload = {
    company_id: companyId,
    contact_id: contactId,
    source_message_id: sourceMessageId,
    status: "pending_confirmation" as WhatsAppCaptureStatus,
    target_type: targetType,
    parsed_payload: parsedPayload,
    transcript,
    account_id: parsed.account_id ?? null,
    direction: parsed.direction,
    movement_kind: parsed.movement_kind,
    amount: parsed.amount,
    currency: parsed.currency,
    payment_method: parsed.payment_method ?? null,
    movement_date: parsed.movement_date ?? null,
    business_partner_id: parsed.business_partner_id ?? null,
    employee_id: parsed.employee_id ?? null,
    project_id: parsed.project_id ?? null,
    vehicle_id: parsed.vehicle_id ?? null,
    expense_category_id: parsed.expense_category_id ?? null,
    cost_center_id: parsed.cost_center_id ?? null,
    description: parsed.description ?? null
  };

  const { data, error } = await db
    .from("whatsapp_capture_drafts")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as WhatsAppCaptureDraft;
}

export async function getLatestPendingDraft({
  db,
  companyId,
  contactId
}: {
  db: SupabaseClient;
  companyId: string;
  contactId: string;
}): Promise<WhatsAppCaptureDraft | null> {
  const { data, error } = await db
    .from("whatsapp_capture_drafts")
    .select("*")
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .eq("status", "pending_confirmation")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return ((data ?? [])[0] as WhatsAppCaptureDraft | undefined) ?? null;
}

export async function updateDraftStatus({
  db,
  draftId,
  status,
  accountMovementId,
  confirmationMessageId
}: {
  db: SupabaseClient;
  draftId: string;
  status: WhatsAppCaptureStatus;
  accountMovementId?: string;
  confirmationMessageId?: string;
}): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === "confirmed") {
    update.confirmed_at = new Date().toISOString();
  }
  if (status === "rejected") {
    update.rejected_at = new Date().toISOString();
  }
  if (accountMovementId) {
    update.account_movement_id = accountMovementId;
  }
  if (confirmationMessageId) {
    update.confirmation_message_id = confirmationMessageId;
  }

  const { error } = await db
    .from("whatsapp_capture_drafts")
    .update(update)
    .eq("id", draftId);

  if (error) throw error;
}

// ── WhatsApp contacts ─────────────────────────────────────────────────

export async function findOrCreateContact({
  db,
  companyId,
  phoneNumber
}: {
  db: SupabaseClient;
  companyId: string;
  phoneNumber: string;
}): Promise<{ id: string }> {
  const { data: existing, error: findErr } = await db
    .from("whatsapp_contacts")
    .select("id")
    .eq("company_id", companyId)
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await db
    .from("whatsapp_contacts")
    .insert({
      company_id: companyId,
      phone_number: phoneNumber,
      display_name: phoneNumber
    })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created;
}

// ── WhatsApp messages ─────────────────────────────────────────────────

export async function insertWhatsAppMessage({
  db,
  companyId,
  contactId,
  twilioMessageSid,
  direction,
  messageKind,
  fromNumber,
  toNumber,
  body,
  mediaUrl,
  transcript,
  rawPayload
}: {
  db: SupabaseClient;
  companyId: string;
  contactId: string | null;
  twilioMessageSid: string | null;
  direction: "inbound" | "outbound";
  messageKind: string;
  fromNumber: string;
  toNumber: string;
  body: string | null;
  mediaUrl?: string | null;
  transcript?: string | null;
  rawPayload?: Record<string, unknown> | null;
}): Promise<{ id: string }> {
  const row = {
    company_id: companyId,
    contact_id: contactId,
    twilio_message_sid: twilioMessageSid,
    direction,
    message_kind: messageKind,
    from_number: fromNumber,
    to_number: toNumber,
    body: body ?? null,
    media_url: mediaUrl ?? null,
    transcript: transcript ?? null,
    raw_payload: rawPayload ?? {}
  };

  const query = twilioMessageSid
    ? db.from("whatsapp_messages").upsert(row, { onConflict: "company_id,twilio_message_sid" })
    : db.from("whatsapp_messages").insert(row);

  const { data, error } = await query.select("id").single();

  if (error) throw error;
  return data;
}

// ── Financial accounts (simple lookup) ────────────────────────────────

export async function listAccounts({
  db,
  companyId
}: {
  db: SupabaseClient;
  companyId: string;
}) {
  const { data, error } = await db
    .from("financial_accounts")
    .select("id, name, account_type, currency, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

// ── Expenses categories (simple lookup) ───────────────────────────────

export async function listExpenseCategories({
  db,
  companyId
}: {
  db: SupabaseClient;
  companyId: string;
}) {
  const { data, error } = await db
    .from("expense_categories")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

// ── Business partners (simple lookup) ────────────────────────────────

export async function listBusinessPartners({
  db,
  companyId,
  partnerType
}: {
  db: SupabaseClient;
  companyId: string;
  partnerType?: PartnerType;
}) {
  let query = db
    .from("business_partners")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");

  if (partnerType) {
    query = query.eq("partner_type", partnerType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as BusinessPartnerRow[]).map(normalizeBusinessPartnerRow);
}

export async function getBusinessPartner({
  db,
  companyId,
  partnerId
}: {
  db: SupabaseClient;
  companyId: string;
  partnerId: string;
}): Promise<BusinessPartnerResponse | null> {
  const { data, error } = await db
    .from("business_partners")
    .select("*")
    .eq("id", partnerId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return normalizeBusinessPartnerRow(data as BusinessPartnerRow);
}

export async function createBusinessPartner({
  db,
  companyId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
}): Promise<BusinessPartnerResponse> {
  const { data, error } = await db
    .from("business_partners")
    .insert({ ...payload, company_id: companyId })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeBusinessPartnerRow(data as BusinessPartnerRow);
}

export async function updateBusinessPartner({
  db,
  companyId,
  partnerId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  partnerId: string;
  payload: Record<string, unknown>;
}): Promise<BusinessPartnerResponse> {
  const { data, error } = await db
    .from("business_partners")
    .update(payload)
    .eq("id", partnerId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeBusinessPartnerRow(data as BusinessPartnerRow);
}

export async function deleteBusinessPartner({
  db,
  companyId,
  partnerId
}: {
  db: SupabaseClient;
  companyId: string;
  partnerId: string;
}): Promise<void> {
  const { error } = await db
    .from("business_partners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", partnerId)
    .eq("company_id", companyId);

  if (error) throw error;
}

// ═════════════════════════════════════════════════════════════════════════
// Report queries
// ═════════════════════════════════════════════════════════════════════════

const REPORT_MOVEMENT_KINDS_INCOME = [
  "client_income",
  "cash_income",
  "invoice_exchange",
  "partner_loan_repayment",
  "employee_loan_repayment"
];

const REPORT_MOVEMENT_KINDS_DIRECT_COST = [
  "expense",
  "supplier_payment",
  "supplier_credit_purchase"
];

export async function getProjectProfitability({
  db,
  companyId,
  startDate,
  endDate,
  projectId
}: {
  db: SupabaseClient;
  companyId: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}): Promise<import("@expenses/shared").ProjectProfitabilityReport> {
  const now = new Date();
  const pStart = startDate || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const pEnd = endDate || now.toISOString().slice(0, 10);

  // 1. Get all active projects
  let projectsQuery = db
    .from("projects")
    .select("id, name, code, status")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (projectId) {
    projectsQuery = projectsQuery.eq("id", projectId);
  }

  const { data: projects, error: projectsErr } = await projectsQuery;
  if (projectsErr) throw projectsErr;

  const projectIds = (projects ?? []).map((p: any) => p.id);
  if (projectIds.length === 0) {
    return {
      projects: [],
      totals: {
        total_income: 0,
        total_direct_costs: 0,
        total_payroll: 0,
        total_fuel: 0,
        total_expenses: 0,
        overhead_allocated: 0,
        net_profit: 0,
        profit_margin_pct: 0
      },
      overhead_rate: 12.5,
      period_start: pStart,
      period_end: pEnd
    };
  }

  // 2. Get project income
  const { data: incomeData, error: incomeErr } = await db
    .from("account_movements")
    .select("project_id, amount")
    .eq("company_id", companyId)
    .eq("direction", "in")
    .in("movement_kind", REPORT_MOVEMENT_KINDS_INCOME)
    .eq("status", "posted")
    .is("deleted_at", null)
    .in("project_id", projectIds)
    .gte("movement_date", pStart)
    .lte("movement_date", pEnd);

  if (incomeErr) throw incomeErr;

  const incomeByProject = new Map<string, number>();
  for (const row of (incomeData ?? []) as Array<{ project_id: string; amount: string }>) {
    const pid = row.project_id;
    incomeByProject.set(pid, (incomeByProject.get(pid) ?? 0) + Number(row.amount));
  }

  // 3. Get project direct costs (expenses, supplier payments)
  const { data: costData, error: costErr } = await db
    .from("account_movements")
    .select("project_id, amount")
    .eq("company_id", companyId)
    .eq("direction", "out")
    .in("movement_kind", REPORT_MOVEMENT_KINDS_DIRECT_COST)
    .eq("status", "posted")
    .is("deleted_at", null)
    .in("project_id", projectIds)
    .gte("movement_date", pStart)
    .lte("movement_date", pEnd);

  if (costErr) throw costErr;

  const costsByProject = new Map<string, number>();
  for (const row of (costData ?? []) as Array<{ project_id: string; amount: string }>) {
    const pid = row.project_id;
    costsByProject.set(pid, (costsByProject.get(pid) ?? 0) + Number(row.amount));
  }

  // 4. Get project fuel expenses
  const { data: fuelData, error: fuelErr } = await db
    .from("fuel_transactions")
    .select("project_id, gross_amount")
    .eq("company_id", companyId)
    .in("project_id", projectIds)
    .is("deleted_at", null)
    .gte("transaction_at", pStart)
    .lte("transaction_at", pEnd);

  if (fuelErr) throw fuelErr;

  const fuelByProject = new Map<string, number>();
  for (const row of (fuelData ?? []) as Array<{ project_id: string; gross_amount: string }>) {
    const pid = row.project_id;
    fuelByProject.set(pid, (fuelByProject.get(pid) ?? 0) + Number(row.gross_amount));
  }

  // 5. Get project payroll
  const { data: payrollData, error: payrollErr } = await db
    .from("payroll_lines")
    .select("project_id, gross_amount, loan_deduction_amount, other_deduction_amount, net_amount")
    .eq("company_id", companyId)
    .in("project_id", projectIds);

  if (payrollErr) throw payrollErr;

  const payrollByProject = new Map<string, number>();
  for (const row of (payrollData ?? []) as Array<{
    project_id: string;
    gross_amount: string;
    loan_deduction_amount: string;
    other_deduction_amount: string;
    net_amount: string;
  }>) {
    const pid = row.project_id;
    payrollByProject.set(pid, (payrollByProject.get(pid) ?? 0) + Number(row.gross_amount));
  }

  // 6. Get total overhead (indirect expenses - non-project movements with 'out' direction and expense/supplier kind)
  const { data: overheadData, error: overheadErr } = await db
    .from("account_movements")
    .select("amount")
    .eq("company_id", companyId)
    .eq("direction", "out")
    .in("movement_kind", REPORT_MOVEMENT_KINDS_DIRECT_COST)
    .eq("status", "posted")
    .is("deleted_at", null)
    .is("project_id", null)  // No project = indirect/overhead
    .gte("movement_date", pStart)
    .lte("movement_date", pEnd);

  if (overheadErr) throw overheadErr;

  let totalOverhead = 0;
  for (const row of (overheadData ?? []) as Array<{ amount: string }>) {
    totalOverhead += Number(row.amount);
  }

  // Also include payroll overhead (payroll without project)
  const { data: payrollOverheadData, error: payrollOverheadErr } = await db
    .from("payroll_lines")
    .select("gross_amount")
    .eq("company_id", companyId)
    .is("project_id", null);

  if (!payrollOverheadErr) {
    for (const row of (payrollOverheadData ?? []) as Array<{ gross_amount: string }>) {
      totalOverhead += Number(row.gross_amount);
    }
  }

  // Default overhead rate = 12.5% (as seen in the Excel RESUMEN DE OBRAS)
  const overheadRate = 12.5;

  // 7. Build project rows
  const projectsResult: import("@expenses/shared").ProjectProfitabilityRow[] = (projects ?? []).map((p: any) => {
    const totalIncome = incomeByProject.get(p.id) ?? 0;
    const directCosts = costsByProject.get(p.id) ?? 0;
    const totalPayroll = payrollByProject.get(p.id) ?? 0;
    const totalFuel = fuelByProject.get(p.id) ?? 0;
    const totalExpenses = directCosts + totalPayroll + totalFuel;
    const overheadAllocated = totalExpenses * (overheadRate / 100);
    const netProfit = totalIncome - totalExpenses - overheadAllocated;
    const profitMarginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      project_id: p.id,
      project_name: p.name,
      project_code: p.code,
      project_status: p.status,
      total_income: Math.round(totalIncome * 100) / 100,
      total_direct_costs: Math.round(directCosts * 100) / 100,
      total_payroll: Math.round(totalPayroll * 100) / 100,
      total_fuel: Math.round(totalFuel * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      overhead_allocated: Math.round(overheadAllocated * 100) / 100,
      net_profit: Math.round(netProfit * 100) / 100,
      profit_margin_pct: Math.round(profitMarginPct * 100) / 100
    };
  });

  // Calculate totals
  const totals = projectsResult.reduce(
    (acc, p) => {
      acc.total_income += p.total_income;
      acc.total_direct_costs += p.total_direct_costs;
      acc.total_payroll += p.total_payroll;
      acc.total_fuel += p.total_fuel;
      acc.total_expenses += p.total_expenses;
      acc.overhead_allocated += p.overhead_allocated;
      acc.net_profit += p.net_profit;
      return acc;
    },
    {
      total_income: 0,
      total_direct_costs: 0,
      total_payroll: 0,
      total_fuel: 0,
      total_expenses: 0,
      overhead_allocated: 0,
      net_profit: 0,
      profit_margin_pct: 0
    }
  );
  totals.profit_margin_pct = totals.total_income > 0 ? (totals.net_profit / totals.total_income) * 100 : 0;

  return {
    projects: projectsResult,
    totals: {
      ...totals,
      profit_margin_pct: Math.round(totals.profit_margin_pct * 100) / 100
    },
    overhead_rate: overheadRate,
    period_start: pStart,
    period_end: pEnd
  };
}

export async function getExpensesByProject({
  db,
  companyId,
  startDate,
  endDate,
  projectId
}: {
  db: SupabaseClient;
  companyId: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}): Promise<import("@expenses/shared").ExpenseByProjectRow[]> {
  const now = new Date();
  const pStart = startDate || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const pEnd = endDate || now.toISOString().slice(0, 10);

  let query = db
    .from("account_movements")
    .select("project_id, amount, expense_category_id, financial_accounts!account_id(name)")
    .eq("company_id", companyId)
    .eq("direction", "out")
    .in("movement_kind", REPORT_MOVEMENT_KINDS_DIRECT_COST)
    .eq("status", "posted")
    .is("deleted_at", null)
    .gte("movement_date", pStart)
    .lte("movement_date", pEnd);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Get category names
  const rows = (data ?? []) as Array<{
    project_id: string | null;
    amount: string;
    expense_category_id: string | null;
    financial_accounts?: { name?: string } | null;
  }>;

  const catIds = Array.from(new Set(rows.map(r => r.expense_category_id).filter(Boolean) as string[]));
  let catMap = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: cats } = await db
      .from("expense_categories")
      .select("id, name")
      .in("id", catIds);
    if (cats) {
      catMap = new Map((cats as Array<{ id: string; name: string }>).map(c => [c.id, c.name]));
    }
  }

  // Get project names
  const projIds = Array.from(new Set(rows.map(r => r.project_id).filter(Boolean) as string[]));
  let projMap = new Map<string, { name: string; code: string | null }>();
  if (projIds.length > 0) {
    const { data: projs } = await db
      .from("projects")
      .select("id, name, code")
      .in("id", projIds);
    if (projs) {
      projMap = new Map((projs as Array<{ id: string; name: string; code: string | null }>).map(p => [p.id, { name: p.name, code: p.code }]));
    }
  }

  const aggMap = new Map<string, { project_id: string; category: string; amount: number; count: number }>();
  for (const row of rows) {
    if (!row.project_id) continue;
    const proj = projMap.get(row.project_id);
    const projectName = proj?.name ?? "Sin proyecto";
    const cat = row.expense_category_id ? (catMap.get(row.expense_category_id) ?? "Sin categoría") : "Sin categoría";
    const key = `${row.project_id}:${cat}`;
    const existing = aggMap.get(key) ?? {
      project_id: row.project_id,
      category: cat,
      amount: 0,
      count: 0
    };
    existing.amount += Number(row.amount);
    existing.count += 1;
    aggMap.set(key, existing);
  }

  return Array.from(aggMap.values())
    .map(r => ({
      ...r,
      project_name: projMap.get(r.project_id)?.name ?? "Sin proyecto",
      project_code: projMap.get(r.project_id)?.code ?? null,
      amount: Math.round(r.amount * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getIncomeByProject({
  db,
  companyId,
  startDate,
  endDate,
  projectId
}: {
  db: SupabaseClient;
  companyId: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}): Promise<import("@expenses/shared").IncomeByProjectRow[]> {
  const now = new Date();
  const pStart = startDate || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const pEnd = endDate || now.toISOString().slice(0, 10);

  let query = db
    .from("account_movements")
    .select("project_id, amount, business_partner_id")
    .eq("company_id", companyId)
    .eq("direction", "in")
    .in("movement_kind", REPORT_MOVEMENT_KINDS_INCOME)
    .eq("status", "posted")
    .is("deleted_at", null)
    .gte("movement_date", pStart)
    .lte("movement_date", pEnd);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    project_id: string | null;
    amount: string;
    business_partner_id: string | null;
  }>;

  const projIds = Array.from(new Set(rows.map(r => r.project_id).filter(Boolean) as string[]));
  let projMap = new Map<string, { name: string; code: string | null }>();
  if (projIds.length > 0) {
    const { data: projs } = await db
      .from("projects")
      .select("id, name, code")
      .in("id", projIds);
    if (projs) {
      projMap = new Map((projs as Array<{ id: string; name: string; code: string | null }>).map(p => [p.id, { name: p.name, code: p.code }]));
    }
  }

  const aggMap = new Map<string, { project_id: string; total_income: number; count: number }>();
  for (const row of rows) {
    if (!row.project_id) continue;
    const key = row.project_id;
    const existing = aggMap.get(key) ?? { project_id: key, total_income: 0, count: 0 };
    existing.total_income += Number(row.amount);
    existing.count += 1;
    aggMap.set(key, existing);
  }

  return Array.from(aggMap.values())
    .map(r => ({
      project_id: r.project_id,
      project_name: projMap.get(r.project_id)?.name ?? "Sin proyecto",
      project_code: projMap.get(r.project_id)?.code ?? null,
      client_name: null,
      total_income: Math.round(r.total_income * 100) / 100,
      movement_count: r.count
    }))
    .sort((a, b) => b.total_income - a.total_income);
}

export async function getCashFlowReport({
  db,
  companyId,
  startDate,
  endDate,
  accountId
}: {
  db: SupabaseClient;
  companyId: string;
  startDate?: string;
  endDate?: string;
  accountId?: string;
}): Promise<import("@expenses/shared").CashFlowRow[]> {
  const now = new Date();
  const pStart = startDate || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const pEnd = endDate || now.toISOString().slice(0, 10);

  let accountsQuery = db
    .from("financial_accounts")
    .select("id, name, account_type, opening_balance, currency, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (accountId) {
    accountsQuery = accountsQuery.eq("id", accountId);
  }

  const { data: accounts, error: accountsErr } = await accountsQuery;
  if (accountsErr) throw accountsErr;

  const accountIds = (accounts ?? []).map((a: any) => a.id);
  if (accountIds.length === 0) return [];

  let movQuery = db
    .from("account_movements")
    .select("account_id, direction, amount")
    .eq("company_id", companyId)
    .eq("status", "posted")
    .is("deleted_at", null)
    .in("account_id", accountIds)
    .gte("movement_date", pStart)
    .lte("movement_date", pEnd);

  const { data: movements, error: movErr } = await movQuery;
  if (movErr) throw movErr;

  const movRows = (movements ?? []) as Array<{ account_id: string; direction: string; amount: string }>;

  const inByAccount = new Map<string, number>();
  const outByAccount = new Map<string, number>();
  for (const row of movRows) {
    const amt = Number(row.amount);
    if (row.direction === "in") {
      inByAccount.set(row.account_id, (inByAccount.get(row.account_id) ?? 0) + amt);
    } else {
      outByAccount.set(row.account_id, (outByAccount.get(row.account_id) ?? 0) + amt);
    }
  }

  return (accounts ?? []).map((acc: any) => {
    const openingBalance = Number(acc.opening_balance);
    const totalIn = Math.round((inByAccount.get(acc.id) ?? 0) * 100) / 100;
    const totalOut = Math.round((outByAccount.get(acc.id) ?? 0) * 100) / 100;
    const netChange = totalIn - totalOut;
    const closingBalance = openingBalance + netChange;

    return {
      account_id: acc.id,
      account_name: acc.name,
      account_type: acc.account_type,
      opening_balance: openingBalance,
      total_in: totalIn,
      total_out: totalOut,
      net_change: Math.round(netChange * 100) / 100,
      closing_balance: Math.round(closingBalance * 100) / 100
    };
  });
}

export async function getSupplierCreditReport({
  db,
  companyId
}: {
  db: SupabaseClient;
  companyId: string;
}): Promise<import("@expenses/shared").SupplierCreditRow[]> {
  const { data: creditAccounts, error: creditErr } = await db
    .from("supplier_credit_accounts")
    .select("*, business_partners!supplier_id(name)")
    .eq("company_id", companyId)
    .is("business_partners.deleted_at", null);

  if (creditErr) throw creditErr;

  const accounts = (creditAccounts ?? []) as Array<{
    id: string;
    supplier_id: string;
    name: string;
    credit_limit: string | null;
    business_partners?: { name?: string } | null;
  }>;

  const supplierIds = accounts.map(a => a.supplier_id);
  if (supplierIds.length === 0) return [];

  // Get total purchases (financial documents payable)
  const { data: docs } = await db
    .from("financial_documents")
    .select("business_partner_id, total_amount, supplier_credit_account_id")
    .eq("company_id", companyId)
    .eq("document_direction", "payable")
    .eq("status", "received")
    .in("supplier_credit_account_id", accounts.map(a => a.id));

  const docRows = (docs ?? []) as Array<{
    business_partner_id: string | null;
    total_amount: string;
    supplier_credit_account_id: string | null;
  }>;

  const purchasesByCredit = new Map<string, number>();
  for (const row of docRows) {
    if (row.supplier_credit_account_id) {
      purchasesByCredit.set(row.supplier_credit_account_id, (purchasesByCredit.get(row.supplier_credit_account_id) ?? 0) + Number(row.total_amount));
    }
  }

  // Get payments from account movements
  const { data: payments } = await db
    .from("account_movements")
    .select("business_partner_id, amount")
    .eq("company_id", companyId)
    .eq("direction", "out")
    .eq("movement_kind", "supplier_payment")
    .eq("status", "posted")
    .is("deleted_at", null)
    .in("business_partner_id", supplierIds);

  const payRows = (payments ?? []) as Array<{ business_partner_id: string | null; amount: string }>;
  const paymentsBySupplier = new Map<string, number>();
  for (const row of payRows) {
    if (row.business_partner_id) {
      paymentsBySupplier.set(row.business_partner_id, (paymentsBySupplier.get(row.business_partner_id) ?? 0) + Number(row.amount));
    }
  }

  return accounts.map(acc => {
    const creditLimit = Number(acc.credit_limit ?? 0);
    const totalPurchases = Math.round((purchasesByCredit.get(acc.id) ?? 0) * 100) / 100;
    const totalPayments = Math.round((paymentsBySupplier.get(acc.supplier_id) ?? 0) * 100) / 100;
    const currentBalance = totalPurchases - totalPayments;

    return {
      supplier_id: acc.supplier_id,
      supplier_name: acc.business_partners?.name ?? "Proveedor desconocido",
      credit_account_name: acc.name,
      credit_limit: creditLimit,
      total_purchases: totalPurchases,
      total_payments: totalPayments,
      current_balance: Math.round(Math.max(0, currentBalance) * 100) / 100,
      available_credit: Math.round(Math.max(0, creditLimit - Math.max(0, currentBalance)) * 100) / 100
    };
  });
}

export async function getFuelConsumptionReport({
  db,
  companyId,
  startDate,
  endDate,
  projectId
}: {
  db: SupabaseClient;
  companyId: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}): Promise<import("@expenses/shared").FuelConsumptionRow[]> {
  const now = new Date();
  const pStart = startDate || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const pEnd = endDate || now.toISOString().slice(0, 10);

  let query = db
    .from("fuel_transactions")
    .select("vehicle_id, project_id, product, liters, gross_amount, vehicles!vehicle_id(plate, model_name), projects!project_id(name)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .gte("transaction_at", pStart)
    .lte("transaction_at", pEnd);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    vehicle_id: string | null;
    project_id: string | null;
    product: string;
    liters: string;
    gross_amount: string;
    vehicles?: { plate?: string | null; model_name?: string } | null;
    projects?: { name?: string | null } | null;
  }>;

  const aggMap = new Map<string, {
    vehicle_id: string;
    project_id: string | null;
    product: string;
    total_liters: number;
    total_amount: number;
    count: number;
  }>();

  for (const row of rows) {
    if (!row.vehicle_id) continue;
    const key = `${row.vehicle_id}:${row.project_id ?? "none"}:${row.product}`;
    const existing = aggMap.get(key) ?? {
      vehicle_id: row.vehicle_id,
      project_id: row.project_id,
      product: row.product,
      total_liters: 0,
      total_amount: 0,
      count: 0
    };
    existing.total_liters += Number(row.liters);
    existing.total_amount += Number(row.gross_amount);
    existing.count += 1;
    aggMap.set(key, existing);
  }

  return Array.from(aggMap.values())
    .map(r => ({
      vehicle_id: r.vehicle_id,
      vehicle_plate: rows.find(x => x.vehicle_id === r.vehicle_id)?.vehicles?.plate ?? null,
      vehicle_name: rows.find(x => x.vehicle_id === r.vehicle_id)?.vehicles?.model_name ?? "Desconocido",
      project_id: r.project_id,
      project_name: r.project_id ? (rows.find(x => x.project_id === r.project_id)?.projects?.name ?? null) : null,
      total_liters: Math.round(r.total_liters * 100) / 100,
      total_amount: Math.round(r.total_amount * 100) / 100,
      transaction_count: r.count,
      product: r.product as import("@expenses/shared").FuelProduct
    }))
    .sort((a, b) => b.total_amount - a.total_amount);
}

// ── Payroll ───────────────────────────────────────────────────────────

export async function listPayrollRuns({
  db,
  companyId,
  limit,
  status
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
  status?: PayrollRun["status"];
}): Promise<PayrollRun[]> {
  let runsQuery = db
    .from("payroll_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("period_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    runsQuery = runsQuery.eq("status", status);
  }

  const { data: runsData, error: runsError } = await runsQuery;
  if (runsError) throw runsError;

  const runs = (runsData ?? []) as PayrollRunRow[];
  if (runs.length === 0) return [];

  const runIds = runs.map((run) => run.id);
  const { data: summaryData, error: summaryError } = await db
    .from("vw_payroll_run_summary")
    .select("*")
    .in("payroll_run_id", runIds);

  if (summaryError) throw summaryError;

  const summaryById = new Map<string, PayrollRunSummaryRow>(
    ((summaryData ?? []) as PayrollRunSummaryRow[]).map((summary) => [summary.payroll_run_id, summary])
  );

  return runs.map((run) => normalizePayrollRunRow(run, summaryById.get(run.id)));
}

export async function getPayrollRun({
  db,
  companyId,
  payrollRunId
}: {
  db: SupabaseClient;
  companyId: string;
  payrollRunId: string;
}): Promise<PayrollRun | null> {
  const { data: runData, error: runError } = await db
    .from("payroll_runs")
    .select("*")
    .eq("id", payrollRunId)
    .eq("company_id", companyId)
    .single();

  if (runError) {
    if (runError.code === "PGRST116") return null;
    throw runError;
  }

  const { data: summaryData, error: summaryError } = await db
    .from("vw_payroll_run_summary")
    .select("*")
    .eq("payroll_run_id", payrollRunId)
    .maybeSingle();

  if (summaryError) throw summaryError;

  return normalizePayrollRunRow(runData as PayrollRunRow, (summaryData ?? null) as PayrollRunSummaryRow | null);
}

export async function createPayrollRun({
  db,
  companyId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payload: Record<string, unknown>;
}): Promise<PayrollRun> {
  const { data, error } = await db
    .from("payroll_runs")
    .insert({ ...payload, company_id: companyId })
    .select("id")
    .single();

  if (error) throw error;

  const created = await getPayrollRun({
    db,
    companyId,
    payrollRunId: (data as { id: string }).id
  });

  if (!created) {
    throw new Error("Payroll run was created but could not be reloaded.");
  }

  return created;
}

export async function updatePayrollRun({
  db,
  companyId,
  payrollRunId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payrollRunId: string;
  payload: Record<string, unknown>;
}): Promise<PayrollRun> {
  const { error } = await db
    .from("payroll_runs")
    .update(payload)
    .eq("id", payrollRunId)
    .eq("company_id", companyId);

  if (error) throw error;

  const updated = await getPayrollRun({ db, companyId, payrollRunId });
  if (!updated) {
    throw new Error("Payroll run was updated but could not be reloaded.");
  }

  return updated;
}

export async function deletePayrollRun({
  db,
  companyId,
  payrollRunId
}: {
  db: SupabaseClient;
  companyId: string;
  payrollRunId: string;
}): Promise<void> {
  const { error } = await db
    .from("payroll_runs")
    .delete()
    .eq("id", payrollRunId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function listPayrollLines({
  db,
  companyId,
  payrollRunId
}: {
  db: SupabaseClient;
  companyId: string;
  payrollRunId: string;
}): Promise<PayrollLine[]> {
  const { data, error } = await db
    .from("payroll_lines")
    .select("*, employees!employee_id(full_name, employee_code), projects!project_id(name, code)")
    .eq("company_id", companyId)
    .eq("payroll_run_id", payrollRunId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (
    (data ?? []) as Array<
      PayrollLineRow & {
        employees?: { full_name?: string | null; employee_code?: string | null } | null;
        projects?: { name?: string | null; code?: string | null } | null;
      }
    >
  ).map(normalizePayrollLineRow);
}

export async function createPayrollLine({
  db,
  companyId,
  payrollRunId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payrollRunId: string;
  payload: Record<string, unknown>;
}): Promise<PayrollLine> {
  const { data, error } = await db
    .from("payroll_lines")
    .insert({ ...payload, company_id: companyId, payroll_run_id: payrollRunId })
    .select("*, employees!employee_id(full_name, employee_code), projects!project_id(name, code)")
    .single();

  if (error) throw error;
  return normalizePayrollLineRow(
    data as PayrollLineRow & {
      employees?: { full_name?: string | null; employee_code?: string | null } | null;
      projects?: { name?: string | null; code?: string | null } | null;
    }
  );
}

export async function updatePayrollLine({
  db,
  companyId,
  payrollLineId,
  payload
}: {
  db: SupabaseClient;
  companyId: string;
  payrollLineId: string;
  payload: Record<string, unknown>;
}): Promise<PayrollLine> {
  const { data, error } = await db
    .from("payroll_lines")
    .update(payload)
    .eq("id", payrollLineId)
    .eq("company_id", companyId)
    .select("*, employees!employee_id(full_name, employee_code), projects!project_id(name, code)")
    .single();

  if (error) throw error;
  return normalizePayrollLineRow(
    data as PayrollLineRow & {
      employees?: { full_name?: string | null; employee_code?: string | null } | null;
      projects?: { name?: string | null; code?: string | null } | null;
    }
  );
}

export async function deletePayrollLine({
  db,
  companyId,
  payrollLineId
}: {
  db: SupabaseClient;
  companyId: string;
  payrollLineId: string;
}): Promise<void> {
  const { error } = await db
    .from("payroll_lines")
    .delete()
    .eq("id", payrollLineId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function listEmployeeLoanBalances({
  db,
  companyId
}: {
  db: SupabaseClient;
  companyId: string;
}): Promise<EmployeeLoanBalance[]> {
  const { data, error } = await db
    .from("vw_employee_loan_balances")
    .select("*")
    .eq("company_id", companyId)
    .gt("balance_amount", 0)
    .order("loan_date", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    employee_loan_id: String(row.employee_loan_id),
    company_id: String(row.company_id),
    employee_id: String(row.employee_id),
    employee_name: String(row.employee_name ?? ""),
    loan_date: String(row.loan_date),
    principal_amount: asNumber(row.principal_amount as number | string | null | undefined),
    paid_amount: asNumber(row.paid_amount as number | string | null | undefined),
    balance_amount: asNumber(row.balance_amount as number | string | null | undefined),
    status: row.status as EmployeeLoanBalance["status"]
  }));
}

// ── Financial documents ───────────────────────────────────────────────

export async function listPendingDocuments({
  db,
  companyId,
  limit
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
}): Promise<FinancialDocumentRow[]> {
  const { data, error } = await db
    .from("vw_document_balances")
    .select("*")
    .eq("company_id", companyId)
    .gt("balance_amount", 0)
    .order("due_date", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as FinancialDocumentRow[];
}
