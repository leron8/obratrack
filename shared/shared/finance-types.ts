// ═════════════════════════════════════════════════════════════════════════
// Shared types matching the REAGA MVP ERP schema (00_rebuild_mvp_erp_schema.sql)
// ═════════════════════════════════════════════════════════════════════════

// ── Enums (mirrors public enums from SQL) ──────────────────────────────

export type MovementDirection = "in" | "out";

export type MovementKind =
  | "client_income"
  | "cash_income"
  | "invoice_exchange"
  | "expense"
  | "supplier_payment"
  | "supplier_credit_purchase"
  | "fuel_expense"
  | "payroll_payment"
  | "employee_loan_disbursement"
  | "employee_loan_repayment"
  | "partner_loan_disbursement"
  | "partner_loan_repayment"
  | "card_funding"
  | "bank_fee"
  | "tax_payment"
  | "internal_transfer"
  | "adjustment";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "cheque"
  | "fuel_card"
  | "credit"
  | "payroll_discount"
  | "other";

export type MovementStatus = "draft" | "posted" | "voided" | "reconciled";

export type AccountType =
  | "bank"
  | "cash"
  | "petty_cash"
  | "credit_card"
  | "debit_card"
  | "fuel_card"
  | "loan"
  | "investment"
  | "clearing";

export type PartnerType = "client" | "supplier" | "lender" | "contractor" | "other";

export type ProjectStatus =
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type DocumentDirection = "receivable" | "payable" | "internal";

export type DocumentType =
  | "invoice"
  | "credit_note"
  | "remission"
  | "receipt"
  | "contra_receipt"
  | "advance"
  | "insurance_policy"
  | "payroll_receipt"
  | "statement"
  | "other";

export type DocumentStatus =
  | "draft"
  | "issued"
  | "received"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "voided";

export type ImportSourceType =
  | "excel"
  | "oxxo_gas"
  | "bank_statement"
  | "card_statement"
  | "whatsapp"
  | "manual";

export type FuelProduct = "Magna" | "Premium" | "Diesel" | "Other";

export type WorkerType = "employee" | "contractor" | "destajista" | "partner";

export type WhatsAppCaptureStatus =
  | "pending_confirmation"
  | "confirmed"
  | "rejected"
  | "expired"
  | "failed"
  | "converted";

export type WhatsAppCaptureTarget =
  | "account_movement"
  | "financial_document"
  | "fuel_transaction"
  | "payroll_line"
  | "employee_loan"
  | "partner_loan"
  | "unknown";

// ── Core domain rows ───────────────────────────────────────────────────

export type AccountMovementRow = {
  id: string;
  company_id: string;
  account_id: string;
  transfer_id: string | null;
  movement_date: string; // date string YYYY-MM-DD
  posted_at: string | null; // timestamptz
  direction: MovementDirection;
  movement_kind: MovementKind;
  amount: string; // numeric(14,2) returned as string by Supabase
  currency: string;
  payment_method: PaymentMethod;
  status: MovementStatus;
  business_partner_id: string | null;
  employee_id: string | null;
  project_id: string | null;
  vehicle_id: string | null;
  expense_category_id: string | null;
  cost_center_id: string | null;
  check_number: string | null;
  invoice_number: string | null;
  external_reference: string | null;
  description: string | null;
  notes: string | null;
  is_internal_transfer: boolean;
  source_module: string;
  source_import_id: string | null;
  import_row_id: string | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  reconciled_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// Simplified type for API responses (flattened with numeric amounts)
export type MovementResponse = {
  id: string;
  company_id: string;
  account_id: string;
  account_name?: string;
  movement_date: string;
  direction: MovementDirection;
  movement_kind: MovementKind;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: MovementStatus;
  business_partner_id: string | null;
  business_partner_name?: string | null;
  employee_id: string | null;
  employee_name?: string | null;
  project_id: string | null;
  project_name?: string | null;
  vehicle_id: string | null;
  vehicle_plate?: string | null;
  expense_category_id: string | null;
  expense_category_name?: string | null;
  cost_center_id: string | null;
  description: string | null;
  notes: string | null;
  is_internal_transfer: boolean;
  created_at: string;
};

// ── Parsed from natural language ───────────────────────────────────────

export type ParsedMovement = {
  direction: MovementDirection;
  movement_kind: MovementKind;
  amount: number;
  currency: string;
  description: string;
  account_id?: string | null;
  business_partner_id?: string | null;
  project_id?: string | null;
  employee_id?: string | null;
  vehicle_id?: string | null;
  expense_category_id?: string | null;
  cost_center_id?: string | null;
  payment_method?: PaymentMethod | null;
  movement_date?: string | null;
  notes?: string | null;
  // Fallback text fields for when no FK is matched
  client_name?: string | null;
  category_name?: string | null;
};

// ── Dashboard types ────────────────────────────────────────────────────

export type AccountBalance = {
  company_id: string;
  account_id: string;
  account_name: string;
  account_type: AccountType;
  currency: string;
  opening_balance: number;
  movement_delta: number;
  current_balance: number;
  last_movement_date: string | null;
};

export type ExpenseByCategory = {
  category: string;
  amount: number;
  percentage: number;
};

export type DashboardSummary = {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  accountBalances: AccountBalance[];
  recentMovements: MovementResponse[];
  expensesByCategory: ExpenseByCategory[];
  activeProjects: number;
  activeVehicles: number;
  pendingDocuments: number;
};

// ── Financial Document ─────────────────────────────────────────────────

export type FinancialDocumentRow = {
  id: string;
  company_id: string;
  document_direction: DocumentDirection;
  document_type: DocumentType;
  status: DocumentStatus;
  business_partner_id: string | null;
  employee_id: string | null;
  project_id: string | null;
  supplier_credit_account_id: string | null;
  document_number: string | null;
  folio: string | null;
  cfdi_uuid: string | null;
  issue_date: string;
  due_date: string | null;
  total_amount: string;
  balance_amount?: string; // from vw_document_balances
  created_at: string;
};

// ── Payroll ────────────────────────────────────────────────────────────

export type PayrollRun = {
  id: string;
  company_id: string;
  run_number: string | null;
  week_number: number | null;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "paid" | "cancelled";
  description: string | null;
  created_at: string;
};

export type PayrollLine = {
  id: string;
  payroll_run_id: string;
  employee_id: string | null;
  project_id: string | null;
  days_worked: number | null;
  gross_amount: string;
  loan_deduction_amount: string;
  other_deduction_amount: string;
  net_amount: string;
  payment_method: PaymentMethod;
  notes: string | null;
};

// ── Fuel ───────────────────────────────────────────────────────────────

export type FuelTransaction = {
  id: string;
  company_id: string;
  account_movement_id: string | null;
  transaction_at: string;
  fuel_card_id: string | null;
  vehicle_id: string | null;
  project_id: string | null;
  product: FuelProduct;
  liters: number;
  gross_amount: number;
  allocated_amount: number;
  odometer: number | null;
  week_number: number | null;
  km_per_liter: number | null;
  created_at: string;
};

// ── WhatsApp Capture ───────────────────────────────────────────────────

export type WhatsAppContact = {
  id: string;
  company_id: string;
  phone_number: string;
  display_name: string | null;
  employee_id: string | null;
  business_partner_id: string | null;
  default_account_id: string | null;
  default_project_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type WhatsAppCaptureDraftRow = {
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
