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
  WhatsAppCaptureTarget,
  WhatsAppCaptureStatus,
  FinancialDocumentRow,
  PayrollRun,
  PayrollLine
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
  serviceRoleKey,
  globalHeaders
}: {
  url: string;
  serviceRoleKey: string;
  globalHeaders?: Record<string, string>;
}): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
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

// ── Payroll ───────────────────────────────────────────────────────────

export async function listPayrollRuns({
  db,
  companyId,
  limit
}: {
  db: SupabaseClient;
  companyId: string;
  limit: number;
}): Promise<PayrollRun[]> {
  const { data, error } = await db
    .from("payroll_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("period_start", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PayrollRun[];
}

export async function listPayrollLines({
  db,
  payrollRunId
}: {
  db: SupabaseClient;
  payrollRunId: string;
}): Promise<PayrollLine[]> {
  const { data, error } = await db
    .from("payroll_lines")
    .select("*")
    .eq("payroll_run_id", payrollRunId)
    .order("id");

  if (error) throw error;
  return (data ?? []) as PayrollLine[];
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
