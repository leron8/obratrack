-- REAGA MVP ERP - normalized rebuild schema
-- PostgreSQL 16 / Supabase compatible.
--
-- This script intentionally rebuilds the public schema from scratch. Use it only
-- on a disposable/new database or after a verified backup.
--
-- Goals covered by the current Excel operation:
-- - Bank, cash, card and internal transfer ledgers with running balances.
-- - Supplier credits, invoices, advances, remissions, receipts and partial payments.
-- - Weekly payroll by project, including employee loans and payroll deductions.
-- - Fuel imports from Oxxo Gas with vehicle, driver, liters, odometer, city, week and project.
-- - Project/cost allocations for every financial movement.
-- - Source import traceability back to Excel file, sheet and row.
-- - Reporting views that avoid N+1 application queries.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE TYPE public.company_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'accountant', 'manager', 'viewer');
CREATE TYPE public.partner_type AS ENUM ('client', 'supplier', 'lender', 'contractor', 'other');
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'terminated');
CREATE TYPE public.worker_type AS ENUM ('employee', 'contractor', 'destajista', 'partner');
CREATE TYPE public.item_type AS ENUM ('material', 'service', 'fuel', 'labor', 'other');
CREATE TYPE public.account_type AS ENUM (
  'bank',
  'cash',
  'petty_cash',
  'credit_card',
  'debit_card',
  'fuel_card',
  'loan',
  'investment',
  'clearing'
);
CREATE TYPE public.account_status AS ENUM ('active', 'inactive', 'closed');
CREATE TYPE public.money_direction AS ENUM ('in', 'out');
CREATE TYPE public.money_movement_kind AS ENUM (
  'client_income',
  'cash_income',
  'invoice_exchange',
  'expense',
  'supplier_payment',
  'supplier_credit_purchase',
  'fuel_expense',
  'payroll_payment',
  'employee_loan_disbursement',
  'employee_loan_repayment',
  'partner_loan_disbursement',
  'partner_loan_repayment',
  'card_funding',
  'bank_fee',
  'tax_payment',
  'internal_transfer',
  'adjustment'
);
CREATE TYPE public.payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'card',
  'cheque',
  'fuel_card',
  'credit',
  'payroll_discount',
  'other'
);
CREATE TYPE public.movement_status AS ENUM ('draft', 'posted', 'voided', 'reconciled');
CREATE TYPE public.check_status AS ENUM ('available', 'issued', 'cancelled', 'voided', 'cleared');
CREATE TYPE public.document_direction AS ENUM ('receivable', 'payable', 'internal');
CREATE TYPE public.document_type AS ENUM (
  'invoice',
  'credit_note',
  'remission',
  'receipt',
  'contra_receipt',
  'advance',
  'insurance_policy',
  'payroll_receipt',
  'statement',
  'other'
);
CREATE TYPE public.document_status AS ENUM (
  'draft',
  'issued',
  'received',
  'partially_paid',
  'paid',
  'cancelled',
  'voided'
);
CREATE TYPE public.allocation_basis AS ENUM ('manual', 'project', 'category', 'payroll', 'fuel', 'import_rule');
CREATE TYPE public.payroll_status AS ENUM ('draft', 'approved', 'paid', 'cancelled');
CREATE TYPE public.loan_status AS ENUM ('active', 'paid', 'cancelled', 'written_off');
CREATE TYPE public.loan_payment_method AS ENUM ('cash', 'bank_transfer', 'payroll_discount', 'adjustment', 'other');
CREATE TYPE public.loan_direction AS ENUM ('borrowed_by_company', 'lent_by_company');
CREATE TYPE public.fuel_product AS ENUM ('Magna', 'Premium', 'Diesel', 'Other');
CREATE TYPE public.import_source_type AS ENUM ('excel', 'oxxo_gas', 'bank_statement', 'card_statement', 'whatsapp', 'manual');
CREATE TYPE public.import_status AS ENUM ('pending', 'processed', 'failed', 'cancelled');
CREATE TYPE public.recurring_status AS ENUM ('active', 'paused', 'cancelled');
CREATE TYPE public.whatsapp_message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.whatsapp_message_kind AS ENUM ('text', 'audio', 'image', 'document', 'confirmation', 'system');
CREATE TYPE public.whatsapp_capture_status AS ENUM ('pending_confirmation', 'confirmed', 'rejected', 'expired', 'failed', 'converted');
CREATE TYPE public.whatsapp_capture_target AS ENUM (
  'account_movement',
  'financial_document',
  'fuel_transaction',
  'payroll_line',
  'employee_loan',
  'partner_loan',
  'unknown'
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_divide(numerator numeric, denominator numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN denominator IS NULL OR denominator = 0 THEN NULL ELSE numerator / denominator END;
$$;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  slug text NOT NULL UNIQUE,
  rfc text,
  tax_regime text,
  fiscal_postal_code text,
  industry text,
  address text,
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  currency text NOT NULL DEFAULT 'MXN',
  status public.company_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT companies_currency_upper CHECK (currency = upper(currency))
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'active',
  full_name text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, email)
);

CREATE TABLE public.business_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_type public.partner_type NOT NULL,
  name text NOT NULL,
  legal_name text,
  rfc text,
  tax_regime text,
  fiscal_postal_code text,
  email text,
  phone text,
  contact_name text,
  address text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, partner_type, name)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (upper(trim(name))) STORED,
  description text,
  status public.project_status NOT NULL DEFAULT 'active',
  budget numeric(14,2) NOT NULL DEFAULT 0,
  start_date date,
  estimated_end_date date,
  completed_at date,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, name),
  UNIQUE (company_id, code)
);

CREATE TABLE public.project_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text GENERATED ALWAYS AS (upper(trim(alias))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, normalized_alias)
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_code text,
  worker_type public.worker_type NOT NULL DEFAULT 'employee',
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  full_name text GENERATED ALWAYS AS (trim(first_name || ' ' || last_name)) STORED,
  rfc text,
  curp text,
  nss text,
  email text,
  phone text,
  position text,
  default_daily_rate numeric(12,2),
  default_weekly_salary numeric(12,2),
  status public.employee_status NOT NULL DEFAULT 'active',
  hire_date date,
  termination_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, employee_code)
);

CREATE TABLE public.project_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_at date NOT NULL DEFAULT current_date,
  unassigned_at date,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plate text,
  economic_number text,
  vin text,
  brand text,
  model_name text NOT NULL,
  model_year integer,
  color text,
  vehicle_type text,
  status text NOT NULL DEFAULT 'active',
  purchase_date date,
  purchase_value numeric(14,2),
  default_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  responsible_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, plate),
  UNIQUE (company_id, vin)
);

CREATE TABLE public.vehicle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_at date NOT NULL DEFAULT current_date,
  released_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurer text NOT NULL,
  holder text,
  policy_number text,
  office_code text,
  starts_on date NOT NULL,
  expires_on date NOT NULL,
  premium_amount numeric(14,2),
  account_movement_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on >= starts_on)
);

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  classification text NOT NULL DEFAULT 'INDIRECT',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, name),
  UNIQUE (company_id, code)
);

CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name),
  UNIQUE (company_id, code)
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  item_type public.item_type NOT NULL DEFAULT 'material',
  unit text,
  default_expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  default_supplier_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  default_unit_cost numeric(14,4),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, sku),
  UNIQUE (company_id, name)
);

CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type public.account_type NOT NULL,
  bank_name text,
  account_number text,
  card_last4 text,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'MXN',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL DEFAULT current_date,
  credit_limit numeric(14,2),
  status public.account_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT financial_accounts_currency_upper CHECK (currency = upper(currency)),
  UNIQUE (company_id, name)
);

CREATE TABLE public.source_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_type public.import_source_type NOT NULL,
  source_name text NOT NULL,
  file_name text,
  file_hash text,
  imported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  status public.import_status NOT NULL DEFAULT 'pending',
  rows_total integer NOT NULL DEFAULT 0,
  rows_processed integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_import_id uuid NOT NULL REFERENCES public.source_imports(id) ON DELETE CASCADE,
  sheet_name text,
  row_number integer,
  source_key text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_import_id, sheet_name, row_number)
);

CREATE TABLE public.account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  transfer_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  fee_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  reference text,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);

CREATE TABLE public.account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  transfer_id uuid REFERENCES public.account_transfers(id) ON DELETE SET NULL,
  movement_date date NOT NULL,
  posted_at timestamptz,
  direction public.money_direction NOT NULL,
  movement_kind public.money_movement_kind NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  payment_method public.payment_method NOT NULL DEFAULT 'other',
  status public.movement_status NOT NULL DEFAULT 'posted',
  business_partner_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  check_number text,
  invoice_number text,
  external_reference text,
  description text,
  notes text,
  is_internal_transfer boolean NOT NULL DEFAULT false,
  source_module text NOT NULL DEFAULT 'manual',
  source_import_id uuid REFERENCES public.source_imports(id) ON DELETE SET NULL,
  import_row_id uuid REFERENCES public.import_rows(id) ON DELETE SET NULL,
  source_file text,
  source_sheet text,
  source_row integer,
  reconciled_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT account_movements_currency_upper CHECK (currency = upper(currency))
);

CREATE TABLE public.bank_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  account_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  payroll_run_id uuid,
  check_number text NOT NULL,
  issued_at date,
  payee_partner_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  payee_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  amount numeric(14,2),
  status public.check_status NOT NULL DEFAULT 'available',
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, account_id, check_number)
);

CREATE TABLE public.transaction_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_movement_id uuid NOT NULL REFERENCES public.account_movements(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  percentage numeric(9,6) CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  allocation_basis public.allocation_basis NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.supplier_credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.business_partners(id) ON DELETE RESTRICT,
  name text NOT NULL,
  credit_limit numeric(14,2),
  terms_days integer,
  starts_on date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, supplier_id, name),
  CHECK (terms_days IS NULL OR terms_days >= 0)
);

CREATE TABLE public.financial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_direction public.document_direction NOT NULL,
  document_type public.document_type NOT NULL,
  status public.document_status NOT NULL DEFAULT 'received',
  business_partner_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  supplier_credit_account_id uuid REFERENCES public.supplier_credit_accounts(id) ON DELETE SET NULL,
  document_number text,
  folio text,
  cfdi_uuid text,
  issue_date date NOT NULL,
  due_date date,
  received_date date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  description text,
  notes text,
  source_import_id uuid REFERENCES public.source_imports(id) ON DELETE SET NULL,
  import_row_id uuid REFERENCES public.import_rows(id) ON DELETE SET NULL,
  source_file text,
  source_sheet text,
  source_row integer,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT financial_documents_currency_upper CHECK (currency = upper(currency))
);

CREATE TABLE public.financial_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.document_payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  account_movement_id uuid NOT NULL REFERENCES public.account_movements(id) ON DELETE RESTRICT,
  applied_amount numeric(14,2) NOT NULL CHECK (applied_amount > 0),
  applied_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, account_movement_id)
);

CREATE TABLE public.document_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_document_id uuid NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  target_document_id uuid NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  application_type text NOT NULL DEFAULT 'credit_note',
  applied_amount numeric(14,2) NOT NULL CHECK (applied_amount > 0),
  applied_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_document_id <> target_document_id),
  UNIQUE (source_document_id, target_document_id, application_type)
);

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_number text,
  week_number integer,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  description text,
  source_import_id uuid REFERENCES public.source_imports(id) ON DELETE SET NULL,
  source_file text,
  source_sheet text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (week_number IS NULL OR (week_number >= 1 AND week_number <= 53))
);

ALTER TABLE public.bank_checks
  ADD CONSTRAINT bank_checks_payroll_run_id_fkey
  FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL;

CREATE TABLE public.payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  worker_name text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  role_or_task text,
  days_worked numeric(8,2),
  gross_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  loan_deduction_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (loan_deduction_amount >= 0),
  other_deduction_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (other_deduction_amount >= 0),
  net_amount numeric(14,2) GENERATED ALWAYS AS (gross_amount - loan_deduction_amount - other_deduction_amount) STORED,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  account_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  notes text,
  source_row integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  loan_date date NOT NULL,
  principal_amount numeric(14,2) NOT NULL CHECK (principal_amount > 0),
  currency text NOT NULL DEFAULT 'MXN',
  concept text NOT NULL,
  source_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  disbursement_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  status public.loan_status NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT employee_loans_currency_upper CHECK (currency = upper(currency))
);

CREATE TABLE public.employee_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_loan_id uuid NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  payroll_line_id uuid REFERENCES public.payroll_lines(id) ON DELETE SET NULL,
  account_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method public.loan_payment_method NOT NULL DEFAULT 'payroll_discount',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.business_partners(id) ON DELETE RESTRICT,
  loan_direction public.loan_direction NOT NULL,
  loan_date date NOT NULL,
  principal_amount numeric(14,2) NOT NULL CHECK (principal_amount > 0),
  currency text NOT NULL DEFAULT 'MXN',
  concept text NOT NULL,
  source_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  disbursement_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  status public.loan_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT partner_loans_currency_upper CHECK (currency = upper(currency))
);

CREATE TABLE public.partner_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_loan_id uuid NOT NULL REFERENCES public.partner_loans(id) ON DELETE CASCADE,
  account_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fuel_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'OXXO GAS',
  card_number text NOT NULL,
  card_alias text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, card_number)
);

CREATE TABLE public.fuel_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'OXXO GAS',
  station_code text,
  name text NOT NULL,
  city text,
  state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, station_code)
);

CREATE TABLE public.fuel_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_movement_id uuid UNIQUE REFERENCES public.account_movements(id) ON DELETE SET NULL,
  source_import_id uuid REFERENCES public.source_imports(id) ON DELETE SET NULL,
  import_row_id uuid REFERENCES public.import_rows(id) ON DELETE SET NULL,
  external_transaction_number text,
  transaction_at timestamptz NOT NULL,
  invoice_date date,
  fuel_card_id uuid REFERENCES public.fuel_cards(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  station_id uuid REFERENCES public.fuel_stations(id) ON DELETE SET NULL,
  product public.fuel_product NOT NULL DEFAULT 'Other',
  liters numeric(14,3) NOT NULL CHECK (liters >= 0),
  gross_amount numeric(14,2) NOT NULL CHECK (gross_amount >= 0),
  paid_amount numeric(14,2),
  allocated_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  odometer numeric(14,2),
  previous_odometer numeric(14,2),
  km_traveled numeric(14,2) GENERATED ALWAYS AS (
    CASE WHEN odometer IS NULL OR previous_odometer IS NULL THEN NULL ELSE odometer - previous_odometer END
  ) STORED,
  km_per_liter numeric(14,4) GENERATED ALWAYS AS (
    CASE
      WHEN odometer IS NULL OR previous_odometer IS NULL OR liters IS NULL OR liters = 0 THEN NULL
      ELSE (odometer - previous_odometer) / liters
    END
  ) STORED,
  city_code text,
  week_number integer,
  is_garrafas boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, external_transaction_number),
  CHECK (week_number IS NULL OR (week_number >= 1 AND week_number <= 53))
);

CREATE TABLE public.recurring_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  expected_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'MXN',
  due_month integer,
  due_day integer,
  next_due_date date,
  payment_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  status public.recurring_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (due_month IS NULL OR (due_month >= 1 AND due_month <= 12)),
  CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  CONSTRAINT recurring_obligations_currency_upper CHECK (currency = upper(currency))
);

CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  display_name text,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  business_partner_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  default_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  default_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, phone_number)
);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  twilio_message_sid text,
  direction public.whatsapp_message_direction NOT NULL,
  message_kind public.whatsapp_message_kind NOT NULL DEFAULT 'text',
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text,
  media_url text,
  media_content_type text,
  transcript text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, twilio_message_sid)
);

CREATE TABLE public.whatsapp_capture_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  source_message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  confirmation_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  status public.whatsapp_capture_status NOT NULL DEFAULT 'pending_confirmation',
  target_type public.whatsapp_capture_target NOT NULL DEFAULT 'account_movement',
  parsed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript text,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  direction public.money_direction,
  movement_kind public.money_movement_kind,
  amount numeric(14,2),
  currency text NOT NULL DEFAULT 'MXN',
  payment_method public.payment_method,
  movement_date date,
  business_partner_id uuid REFERENCES public.business_partners(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  description text,
  account_movement_id uuid REFERENCES public.account_movements(id) ON DELETE SET NULL,
  financial_document_id uuid REFERENCES public.financial_documents(id) ON DELETE SET NULL,
  payroll_line_id uuid REFERENCES public.payroll_lines(id) ON DELETE SET NULL,
  fuel_transaction_id uuid REFERENCES public.fuel_transactions(id) ON DELETE SET NULL,
  employee_loan_id uuid REFERENCES public.employee_loans(id) ON DELETE SET NULL,
  partner_loan_id uuid REFERENCES public.partner_loans(id) ON DELETE SET NULL,
  expires_at timestamptz,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_capture_drafts_currency_upper CHECK (currency = upper(currency)),
  CONSTRAINT whatsapp_capture_drafts_amount_positive CHECK (amount IS NULL OR amount > 0)
);

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_movement_id uuid REFERENCES public.account_movements(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  fuel_transaction_id uuid REFERENCES public.fuel_transactions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (account_movement_id IS NOT NULL)::integer +
    (document_id IS NOT NULL)::integer +
    (fuel_transaction_id IS NOT NULL)::integer >= 1
  )
);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_profile_id uuid,
  actor_type text NOT NULL DEFAULT 'unknown',
  actor_label text,
  source_module text,
  request_id text,
  idempotency_key text,
  ip_address inet,
  user_agent text,
  http_method text,
  http_path text,
  action text NOT NULL,
  table_schema text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  record_pk jsonb NOT NULL DEFAULT '{}'::jsonb,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.audit_request_header(header_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  headers_text text;
  headers_json jsonb;
  value text;
BEGIN
  headers_text := current_setting('request.headers', true);
  IF headers_text IS NULL OR headers_text = '' THEN
    RETURN NULL;
  END IF;

  headers_json := headers_text::jsonb;
  value := headers_json ->> lower(header_name);
  IF value IS NULL THEN
    value := headers_json ->> header_name;
  END IF;

  RETURN NULLIF(value, '');
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_uuid_or_null(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN NULL;
  END IF;

  RETURN value::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_inet_or_null(value text)
RETURNS inet
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF value IS NULL OR value = '' THEN
    RETURN NULL;
  END IF;

  RETURN split_part(value, ',', 1)::inet;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_capture_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  row_data jsonb;
  company_uuid uuid;
  actor_uuid uuid;
  record_uuid uuid;
  changed text[];
  action_name text;
  old_status text;
  new_status text;
  source_text text;
  reason_text text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    old_data := NULL;
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  ELSE
    old_data := to_jsonb(OLD);
    new_data := NULL;
  END IF;

  row_data := COALESCE(new_data, old_data, '{}'::jsonb);
  record_uuid := public.audit_uuid_or_null(row_data ->> 'id');
  company_uuid := COALESCE(
    public.audit_uuid_or_null(row_data ->> 'company_id'),
    CASE WHEN TG_TABLE_NAME = 'companies' THEN record_uuid ELSE NULL END
  );

  SELECT COALESCE(array_agg(keys.key ORDER BY keys.key), ARRAY[]::text[])
    INTO changed
  FROM (
    SELECT jsonb_object_keys(COALESCE(old_data, '{}'::jsonb)) AS key
    UNION
    SELECT jsonb_object_keys(COALESCE(new_data, '{}'::jsonb)) AS key
  ) keys
  WHERE keys.key <> 'updated_at'
    AND COALESCE(old_data, '{}'::jsonb) -> keys.key IS DISTINCT FROM COALESCE(new_data, '{}'::jsonb) -> keys.key;

  IF TG_OP = 'UPDATE' AND COALESCE(array_length(changed, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  action_name := TG_OP;
  old_status := old_data ->> 'status';
  new_status := new_data ->> 'status';

  IF TG_OP = 'UPDATE'
    AND old_data ->> 'deleted_at' IS NULL
    AND new_data ->> 'deleted_at' IS NOT NULL THEN
    action_name := 'SOFT_DELETE';
  ELSIF TG_OP = 'UPDATE' AND old_status IS DISTINCT FROM new_status THEN
    action_name := CASE new_status
      WHEN 'voided' THEN 'VOID'
      WHEN 'reconciled' THEN 'RECONCILE'
      WHEN 'approved' THEN 'APPROVE'
      WHEN 'confirmed' THEN 'CONFIRM'
      WHEN 'rejected' THEN 'REJECT'
      WHEN 'cancelled' THEN 'CANCEL'
      ELSE 'STATUS_CHANGE'
    END;
  END IF;

  actor_uuid := COALESCE(
    public.audit_uuid_or_null(public.audit_request_header('x-audit-actor-profile-id')),
    CASE WHEN action_name = 'SOFT_DELETE' THEN public.audit_uuid_or_null(new_data ->> 'deleted_by') ELSE NULL END,
    CASE WHEN TG_OP = 'UPDATE' THEN public.audit_uuid_or_null(new_data ->> 'updated_by') ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN public.audit_uuid_or_null(new_data ->> 'created_by') ELSE NULL END,
    public.audit_uuid_or_null(row_data ->> 'uploaded_by'),
    public.audit_uuid_or_null(row_data ->> 'imported_by'),
    public.audit_uuid_or_null(row_data ->> 'approved_by')
  );

  source_text := COALESCE(
    new_data ->> 'source_module',
    old_data ->> 'source_module',
    public.audit_request_header('x-audit-source-module'),
    TG_TABLE_NAME
  );

  reason_text := COALESCE(
    public.audit_request_header('x-audit-reason'),
    new_data ->> 'deleted_reason',
    new_data ->> 'void_reason'
  );

  INSERT INTO public.audit_events (
    company_id,
    actor_profile_id,
    actor_type,
    actor_label,
    source_module,
    request_id,
    idempotency_key,
    ip_address,
    user_agent,
    http_method,
    http_path,
    action,
    table_schema,
    table_name,
    record_id,
    record_pk,
    old_data,
    new_data,
    changed_fields,
    reason,
    metadata
  ) VALUES (
    company_uuid,
    actor_uuid,
    COALESCE(public.audit_request_header('x-audit-actor-type'), CASE WHEN actor_uuid IS NULL THEN 'system' ELSE 'user' END),
    public.audit_request_header('x-audit-actor-label'),
    source_text,
    public.audit_request_header('x-audit-request-id'),
    public.audit_request_header('x-audit-idempotency-key'),
    public.audit_inet_or_null(public.audit_request_header('x-audit-ip-address')),
    public.audit_request_header('x-audit-user-agent'),
    public.audit_request_header('x-audit-http-method'),
    public.audit_request_header('x-audit-http-path'),
    action_name,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    record_uuid,
    CASE WHEN record_uuid IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('id', record_uuid) END,
    old_data,
    new_data,
    changed,
    reason_text,
    jsonb_strip_nulls(jsonb_build_object(
      'trigger_operation', TG_OP,
      'trigger_name', TG_NAME
    ))
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
  RETURN OLD;
END;
$$;

-- Add the deferred insurance movement reference now that account_movements exists.
ALTER TABLE public.vehicle_insurance_policies
  ADD CONSTRAINT vehicle_insurance_policies_account_movement_id_fkey
  FOREIGN KEY (account_movement_id) REFERENCES public.account_movements(id) ON DELETE SET NULL;

-- Updated-at triggers.
CREATE TRIGGER set_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_business_partners_updated_at BEFORE UPDATE ON public.business_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_project_workers_updated_at BEFORE UPDATE ON public.project_workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_vehicle_assignments_updated_at BEFORE UPDATE ON public.vehicle_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_vehicle_insurance_policies_updated_at BEFORE UPDATE ON public.vehicle_insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_financial_accounts_updated_at BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_source_imports_updated_at BEFORE UPDATE ON public.source_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_account_transfers_updated_at BEFORE UPDATE ON public.account_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_account_movements_updated_at BEFORE UPDATE ON public.account_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_bank_checks_updated_at BEFORE UPDATE ON public.bank_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_transaction_allocations_updated_at BEFORE UPDATE ON public.transaction_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_supplier_credit_accounts_updated_at BEFORE UPDATE ON public.supplier_credit_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_financial_documents_updated_at BEFORE UPDATE ON public.financial_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_financial_document_lines_updated_at BEFORE UPDATE ON public.financial_document_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_payroll_lines_updated_at BEFORE UPDATE ON public.payroll_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_employee_loans_updated_at BEFORE UPDATE ON public.employee_loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_partner_loans_updated_at BEFORE UPDATE ON public.partner_loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_fuel_cards_updated_at BEFORE UPDATE ON public.fuel_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_fuel_stations_updated_at BEFORE UPDATE ON public.fuel_stations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_fuel_transactions_updated_at BEFORE UPDATE ON public.fuel_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_recurring_obligations_updated_at BEFORE UPDATE ON public.recurring_obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_whatsapp_contacts_updated_at BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_whatsapp_messages_updated_at BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_whatsapp_capture_drafts_updated_at BEFORE UPDATE ON public.whatsapp_capture_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER prevent_audit_events_mutation BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();

-- Append-only audit triggers. These capture row snapshots even for writes that
-- bypass the application layer, as long as they touch the public tables below.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'companies',
    'profiles',
    'business_partners',
    'projects',
    'project_aliases',
    'employees',
    'project_workers',
    'vehicles',
    'vehicle_assignments',
    'vehicle_insurance_policies',
    'expense_categories',
    'cost_centers',
    'items',
    'financial_accounts',
    'source_imports',
    'import_rows',
    'account_transfers',
    'account_movements',
    'bank_checks',
    'transaction_allocations',
    'supplier_credit_accounts',
    'financial_documents',
    'financial_document_lines',
    'document_payment_applications',
    'document_applications',
    'payroll_runs',
    'payroll_lines',
    'employee_loans',
    'employee_loan_payments',
    'partner_loans',
    'partner_loan_payments',
    'fuel_cards',
    'fuel_stations',
    'fuel_transactions',
    'recurring_obligations',
    'whatsapp_contacts',
    'whatsapp_messages',
    'whatsapp_capture_drafts',
    'attachments'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_capture_row_change()',
      'audit_' || tbl || '_changes',
      tbl
    );
  END LOOP;
END$$;

-- Foreign key and report indexes. These are intentionally explicit because the
-- MVP dashboards and imports will filter by company + date/source/project often.
CREATE INDEX idx_audit_events_company_time ON public.audit_events(company_id, occurred_at DESC);
CREATE INDEX idx_audit_events_record ON public.audit_events(table_name, record_id, occurred_at DESC);
CREATE INDEX idx_audit_events_actor ON public.audit_events(company_id, actor_profile_id, occurred_at DESC)
  WHERE actor_profile_id IS NOT NULL;
CREATE INDEX idx_audit_events_request ON public.audit_events(request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_events_idempotency ON public.audit_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_business_partners_company_type_name ON public.business_partners(company_id, partner_type, name);
CREATE INDEX idx_projects_company_status ON public.projects(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_aliases_company_alias ON public.project_aliases(company_id, normalized_alias);
CREATE INDEX idx_employees_company_status_name ON public.employees(company_id, status, full_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_workers_company_project ON public.project_workers(company_id, project_id);
CREATE INDEX idx_project_workers_company_employee ON public.project_workers(company_id, employee_id);
CREATE INDEX idx_vehicles_company_plate ON public.vehicles(company_id, plate) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicle_assignments_company_vehicle ON public.vehicle_assignments(company_id, vehicle_id);
CREATE INDEX idx_vehicle_insurance_company_expiry ON public.vehicle_insurance_policies(company_id, expires_on);
CREATE INDEX idx_expense_categories_company_parent ON public.expense_categories(company_id, parent_id);
CREATE INDEX idx_cost_centers_company_active ON public.cost_centers(company_id, is_active);
CREATE INDEX idx_items_company_type ON public.items(company_id, item_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_company_supplier ON public.items(company_id, default_supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_financial_accounts_company_type ON public.financial_accounts(company_id, account_type, status);
CREATE INDEX idx_source_imports_company_source ON public.source_imports(company_id, source_type, imported_at DESC);
CREATE INDEX idx_import_rows_import ON public.import_rows(source_import_id, sheet_name, row_number);
CREATE INDEX idx_account_transfers_company_date ON public.account_transfers(company_id, transfer_date DESC);
CREATE INDEX idx_account_transfers_from ON public.account_transfers(from_account_id);
CREATE INDEX idx_account_transfers_to ON public.account_transfers(to_account_id);
CREATE INDEX idx_account_movements_company_date ON public.account_movements(company_id, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_movements_account_date ON public.account_movements(account_id, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_movements_project_date ON public.account_movements(company_id, project_id, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_movements_partner_date ON public.account_movements(company_id, business_partner_id, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_movements_employee_date ON public.account_movements(company_id, employee_id, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_movements_kind_date ON public.account_movements(company_id, movement_kind, movement_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_movements_transfer ON public.account_movements(transfer_id);
CREATE INDEX idx_bank_checks_company_account_status ON public.bank_checks(company_id, account_id, status);
CREATE INDEX idx_bank_checks_movement ON public.bank_checks(account_movement_id);
CREATE INDEX idx_bank_checks_payroll_run ON public.bank_checks(payroll_run_id);
CREATE INDEX idx_transaction_allocations_company_project ON public.transaction_allocations(company_id, project_id);
CREATE INDEX idx_transaction_allocations_movement ON public.transaction_allocations(account_movement_id);
CREATE INDEX idx_supplier_credit_accounts_company_supplier ON public.supplier_credit_accounts(company_id, supplier_id);
CREATE INDEX idx_financial_documents_company_due ON public.financial_documents(company_id, document_direction, due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_financial_documents_partner_status ON public.financial_documents(company_id, business_partner_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_financial_documents_project ON public.financial_documents(company_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_financial_documents_supplier_credit ON public.financial_documents(supplier_credit_account_id);
CREATE INDEX idx_financial_document_lines_document ON public.financial_document_lines(document_id);
CREATE INDEX idx_document_payment_applications_document ON public.document_payment_applications(document_id);
CREATE INDEX idx_document_payment_applications_movement ON public.document_payment_applications(account_movement_id);
CREATE INDEX idx_document_applications_source ON public.document_applications(source_document_id);
CREATE INDEX idx_document_applications_target ON public.document_applications(target_document_id);
CREATE INDEX idx_payroll_runs_company_period ON public.payroll_runs(company_id, period_start DESC, period_end DESC);
CREATE INDEX idx_payroll_lines_run_project ON public.payroll_lines(payroll_run_id, project_id);
CREATE INDEX idx_payroll_lines_company_employee ON public.payroll_lines(company_id, employee_id);
CREATE INDEX idx_employee_loans_company_employee_status ON public.employee_loans(company_id, employee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_employee_loan_payments_loan ON public.employee_loan_payments(employee_loan_id);
CREATE INDEX idx_partner_loans_company_partner_status ON public.partner_loans(company_id, partner_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_partner_loan_payments_loan ON public.partner_loan_payments(partner_loan_id);
CREATE INDEX idx_fuel_cards_company_card ON public.fuel_cards(company_id, card_number);
CREATE INDEX idx_fuel_stations_company_station ON public.fuel_stations(company_id, provider, station_code);
CREATE INDEX idx_fuel_transactions_company_date ON public.fuel_transactions(company_id, transaction_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_fuel_transactions_project_week ON public.fuel_transactions(company_id, project_id, week_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_fuel_transactions_vehicle_date ON public.fuel_transactions(company_id, vehicle_id, transaction_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_fuel_transactions_card_date ON public.fuel_transactions(company_id, fuel_card_id, transaction_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_recurring_obligations_company_due ON public.recurring_obligations(company_id, next_due_date, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_whatsapp_contacts_company_phone ON public.whatsapp_contacts(company_id, phone_number);
CREATE INDEX idx_whatsapp_contacts_employee ON public.whatsapp_contacts(company_id, employee_id);
CREATE INDEX idx_whatsapp_messages_company_contact_received ON public.whatsapp_messages(company_id, contact_id, received_at DESC);
CREATE INDEX idx_whatsapp_messages_sid ON public.whatsapp_messages(company_id, twilio_message_sid);
CREATE INDEX idx_whatsapp_capture_pending ON public.whatsapp_capture_drafts(company_id, contact_id, created_at DESC)
  WHERE status = 'pending_confirmation';
CREATE INDEX idx_whatsapp_capture_movement ON public.whatsapp_capture_drafts(account_movement_id);
CREATE INDEX idx_whatsapp_capture_document ON public.whatsapp_capture_drafts(financial_document_id);
CREATE INDEX idx_attachments_company_document ON public.attachments(company_id, document_id);
CREATE INDEX idx_attachments_company_movement ON public.attachments(company_id, account_movement_id);

-- Reporting views.
CREATE VIEW public.vw_account_balances AS
SELECT
  a.company_id,
  a.id AS account_id,
  a.name AS account_name,
  a.account_type,
  a.currency,
  a.opening_balance,
  COALESCE(SUM(
    CASE
      WHEN m.status = 'voided' OR m.deleted_at IS NOT NULL THEN 0
      WHEN m.direction = 'in' THEN m.amount
      ELSE -m.amount
    END
  ), 0) AS movement_delta,
  a.opening_balance + COALESCE(SUM(
    CASE
      WHEN m.status = 'voided' OR m.deleted_at IS NOT NULL THEN 0
      WHEN m.direction = 'in' THEN m.amount
      ELSE -m.amount
    END
  ), 0) AS current_balance,
  MAX(m.movement_date) AS last_movement_date
FROM public.financial_accounts a
LEFT JOIN public.account_movements m ON m.account_id = a.id
WHERE a.deleted_at IS NULL
GROUP BY a.company_id, a.id, a.name, a.account_type, a.currency, a.opening_balance;

CREATE VIEW public.vw_account_monthly_summary AS
SELECT
  m.company_id,
  m.account_id,
  date_trunc('month', m.movement_date)::date AS month,
  SUM(CASE WHEN m.direction = 'in' THEN m.amount ELSE 0 END) AS inflow,
  SUM(CASE WHEN m.direction = 'out' THEN m.amount ELSE 0 END) AS outflow,
  SUM(CASE WHEN m.direction = 'in' THEN m.amount ELSE -m.amount END) AS net_flow
FROM public.account_movements m
WHERE m.deleted_at IS NULL AND m.status <> 'voided'
GROUP BY m.company_id, m.account_id, date_trunc('month', m.movement_date)::date;

CREATE VIEW public.vw_document_balances AS
WITH paid AS (
  SELECT document_id, SUM(applied_amount) AS paid_amount
  FROM public.document_payment_applications
  GROUP BY document_id
),
credited AS (
  SELECT target_document_id AS document_id, SUM(applied_amount) AS credited_amount
  FROM public.document_applications
  GROUP BY target_document_id
)
SELECT
  d.company_id,
  d.id AS document_id,
  d.document_direction,
  d.document_type,
  d.status,
  d.business_partner_id,
  d.employee_id,
  d.project_id,
  d.supplier_credit_account_id,
  d.document_number,
  d.issue_date,
  d.due_date,
  d.total_amount,
  COALESCE(p.paid_amount, 0) AS paid_amount,
  COALESCE(c.credited_amount, 0) AS credited_amount,
  d.total_amount - COALESCE(p.paid_amount, 0) - COALESCE(c.credited_amount, 0) AS balance_amount,
  CASE
    WHEN d.due_date IS NOT NULL AND d.due_date < current_date
      AND d.total_amount - COALESCE(p.paid_amount, 0) - COALESCE(c.credited_amount, 0) > 0
    THEN true
    ELSE false
  END AS is_overdue
FROM public.financial_documents d
LEFT JOIN paid p ON p.document_id = d.id
LEFT JOIN credited c ON c.document_id = d.id
WHERE d.deleted_at IS NULL;

CREATE VIEW public.vw_supplier_credit_balances AS
SELECT
  sca.company_id,
  sca.id AS supplier_credit_account_id,
  sca.supplier_id,
  bp.name AS supplier_name,
  sca.credit_limit,
  sca.terms_days,
  COALESCE(SUM(db.total_amount), 0) AS total_purchased,
  COALESCE(SUM(db.paid_amount + db.credited_amount), 0) AS total_applied,
  COALESCE(SUM(db.balance_amount), 0) AS balance_amount,
  CASE
    WHEN sca.credit_limit IS NULL THEN NULL
    ELSE sca.credit_limit - COALESCE(SUM(db.balance_amount), 0)
  END AS available_credit
FROM public.supplier_credit_accounts sca
JOIN public.business_partners bp ON bp.id = sca.supplier_id
LEFT JOIN public.vw_document_balances db ON db.supplier_credit_account_id = sca.id
GROUP BY sca.company_id, sca.id, sca.supplier_id, bp.name, sca.credit_limit, sca.terms_days;

CREATE VIEW public.vw_project_financial_summary AS
WITH direct_movements AS (
  SELECT
    m.company_id,
    m.project_id,
    SUM(CASE WHEN m.direction = 'in' THEN m.amount ELSE 0 END) AS direct_income,
    SUM(CASE WHEN m.direction = 'out' AND NOT m.is_internal_transfer THEN m.amount ELSE 0 END) AS direct_expense
  FROM public.account_movements m
  WHERE m.project_id IS NOT NULL
    AND m.deleted_at IS NULL
    AND m.status <> 'voided'
  GROUP BY m.company_id, m.project_id
),
allocations AS (
  SELECT
    a.company_id,
    a.project_id,
    SUM(CASE WHEN m.direction = 'in' THEN a.amount ELSE 0 END) AS allocated_income,
    SUM(CASE WHEN m.direction = 'out' AND NOT m.is_internal_transfer THEN a.amount ELSE 0 END) AS allocated_expense
  FROM public.transaction_allocations a
  JOIN public.account_movements m ON m.id = a.account_movement_id
  WHERE a.project_id IS NOT NULL
    AND m.deleted_at IS NULL
    AND m.status <> 'voided'
  GROUP BY a.company_id, a.project_id
),
payroll AS (
  SELECT company_id, project_id, SUM(gross_amount) AS payroll_gross, SUM(net_amount) AS payroll_net
  FROM public.payroll_lines
  WHERE project_id IS NOT NULL
  GROUP BY company_id, project_id
),
fuel AS (
  SELECT company_id, project_id, SUM(allocated_amount) AS fuel_amount, SUM(liters) AS fuel_liters
  FROM public.fuel_transactions
  WHERE project_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY company_id, project_id
)
SELECT
  p.company_id,
  p.id AS project_id,
  p.code,
  p.name AS project_name,
  p.status,
  p.budget,
  COALESCE(dm.direct_income, 0) + COALESCE(al.allocated_income, 0) AS income_total,
  COALESCE(dm.direct_expense, 0) + COALESCE(al.allocated_expense, 0) AS expense_total,
  COALESCE(pr.payroll_gross, 0) AS payroll_gross,
  COALESCE(pr.payroll_net, 0) AS payroll_net,
  COALESCE(f.fuel_amount, 0) AS fuel_total,
  COALESCE(f.fuel_liters, 0) AS fuel_liters,
  (COALESCE(dm.direct_income, 0) + COALESCE(al.allocated_income, 0))
    - (COALESCE(dm.direct_expense, 0) + COALESCE(al.allocated_expense, 0)) AS net_balance
FROM public.projects p
LEFT JOIN direct_movements dm ON dm.project_id = p.id
LEFT JOIN allocations al ON al.project_id = p.id
LEFT JOIN payroll pr ON pr.project_id = p.id
LEFT JOIN fuel f ON f.project_id = p.id
WHERE p.deleted_at IS NULL;

CREATE VIEW public.vw_employee_loan_balances AS
SELECT
  l.company_id,
  l.id AS employee_loan_id,
  l.employee_id,
  e.full_name AS employee_name,
  l.loan_date,
  l.principal_amount,
  COALESCE(SUM(p.amount), 0) AS paid_amount,
  l.principal_amount - COALESCE(SUM(p.amount), 0) AS balance_amount,
  l.status
FROM public.employee_loans l
JOIN public.employees e ON e.id = l.employee_id
LEFT JOIN public.employee_loan_payments p ON p.employee_loan_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.company_id, l.id, l.employee_id, e.full_name, l.loan_date, l.principal_amount, l.status;

CREATE VIEW public.vw_partner_loan_balances AS
SELECT
  l.company_id,
  l.id AS partner_loan_id,
  l.partner_id,
  bp.name AS partner_name,
  l.loan_direction,
  l.loan_date,
  l.principal_amount,
  COALESCE(SUM(p.amount), 0) AS paid_amount,
  l.principal_amount - COALESCE(SUM(p.amount), 0) AS balance_amount,
  l.status
FROM public.partner_loans l
JOIN public.business_partners bp ON bp.id = l.partner_id
LEFT JOIN public.partner_loan_payments p ON p.partner_loan_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.company_id, l.id, l.partner_id, bp.name, l.loan_direction, l.loan_date, l.principal_amount, l.status;

CREATE VIEW public.vw_payroll_run_summary AS
SELECT
  pr.company_id,
  pr.id AS payroll_run_id,
  pr.run_number,
  pr.week_number,
  pr.period_start,
  pr.period_end,
  pr.status,
  COUNT(pl.id) AS line_count,
  COUNT(DISTINCT pl.employee_id) FILTER (WHERE pl.employee_id IS NOT NULL) AS employee_count,
  COUNT(DISTINCT pl.project_id) FILTER (WHERE pl.project_id IS NOT NULL) AS project_count,
  COALESCE(SUM(pl.gross_amount), 0) AS gross_total,
  COALESCE(SUM(pl.loan_deduction_amount), 0) AS loan_deductions_total,
  COALESCE(SUM(pl.other_deduction_amount), 0) AS other_deductions_total,
  COALESCE(SUM(pl.net_amount), 0) AS net_total
FROM public.payroll_runs pr
LEFT JOIN public.payroll_lines pl ON pl.payroll_run_id = pr.id
GROUP BY pr.company_id, pr.id, pr.run_number, pr.week_number, pr.period_start, pr.period_end, pr.status;

CREATE VIEW public.vw_fuel_by_vehicle AS
SELECT
  ft.company_id,
  ft.vehicle_id,
  v.plate,
  v.model_name,
  COUNT(*) AS transaction_count,
  SUM(ft.allocated_amount) AS amount_total,
  SUM(ft.liters) AS liters_total,
  SUM(ft.km_traveled) AS km_total,
  public.safe_divide(SUM(ft.km_traveled), SUM(ft.liters)) AS km_per_liter
FROM public.fuel_transactions ft
LEFT JOIN public.vehicles v ON v.id = ft.vehicle_id
WHERE ft.deleted_at IS NULL
GROUP BY ft.company_id, ft.vehicle_id, v.plate, v.model_name;

CREATE VIEW public.vw_fuel_by_project_week AS
SELECT
  ft.company_id,
  ft.project_id,
  p.name AS project_name,
  ft.week_number,
  ft.product,
  COUNT(*) AS transaction_count,
  SUM(ft.allocated_amount) AS amount_total,
  SUM(ft.liters) AS liters_total
FROM public.fuel_transactions ft
LEFT JOIN public.projects p ON p.id = ft.project_id
WHERE ft.deleted_at IS NULL
GROUP BY ft.company_id, ft.project_id, p.name, ft.week_number, ft.product;

CREATE VIEW public.vw_operational_summary AS
SELECT
  m.company_id,
  date_trunc('month', m.movement_date)::date AS month,
  m.source_module,
  fa.account_type,
  m.movement_kind,
  m.project_id,
  m.expense_category_id,
  SUM(CASE WHEN m.direction = 'in' THEN m.amount ELSE 0 END) AS inflow,
  SUM(CASE WHEN m.direction = 'out' AND NOT m.is_internal_transfer THEN m.amount ELSE 0 END) AS outflow,
  SUM(CASE
    WHEN m.is_internal_transfer THEN 0
    WHEN m.direction = 'in' THEN m.amount
    ELSE -m.amount
  END) AS net_operational_flow
FROM public.account_movements m
JOIN public.financial_accounts fa ON fa.id = m.account_id
WHERE m.deleted_at IS NULL AND m.status <> 'voided'
GROUP BY
  m.company_id,
  date_trunc('month', m.movement_date)::date,
  m.source_module,
  fa.account_type,
  m.movement_kind,
  m.project_id,
  m.expense_category_id;

CREATE VIEW public.vw_due_reminders AS
SELECT
  'document'::text AS reminder_type,
  d.company_id,
  d.document_id AS record_id,
  d.due_date AS due_date,
  d.balance_amount AS amount,
  d.document_direction::text || ':' || d.document_type::text AS label,
  d.document_number AS reference
FROM public.vw_document_balances d
WHERE d.balance_amount > 0 AND d.due_date IS NOT NULL
UNION ALL
SELECT
  'recurring'::text AS reminder_type,
  r.company_id,
  r.id AS record_id,
  r.next_due_date AS due_date,
  r.expected_amount AS amount,
  r.name AS label,
  NULL::text AS reference
FROM public.recurring_obligations r
WHERE r.status = 'active' AND r.deleted_at IS NULL AND r.next_due_date IS NOT NULL
UNION ALL
SELECT
  'insurance'::text AS reminder_type,
  vip.company_id,
  vip.id AS record_id,
  vip.expires_on AS due_date,
  vip.premium_amount AS amount,
  vip.insurer AS label,
  vip.policy_number AS reference
FROM public.vehicle_insurance_policies vip;

CREATE VIEW public.vw_whatsapp_pending_captures AS
SELECT
  d.company_id,
  d.id AS draft_id,
  d.contact_id,
  c.phone_number,
  COALESCE(c.display_name, c.phone_number) AS contact_name,
  d.source_message_id,
  d.status,
  d.target_type,
  d.transcript,
  d.direction,
  d.movement_kind,
  d.amount,
  d.currency,
  d.payment_method,
  d.movement_date,
  d.account_id,
  a.name AS account_name,
  d.project_id,
  p.name AS project_name,
  d.business_partner_id,
  bp.name AS business_partner_name,
  d.employee_id,
  e.full_name AS employee_name,
  d.vehicle_id,
  v.plate AS vehicle_plate,
  d.expense_category_id,
  ec.name AS expense_category_name,
  d.description,
  d.expires_at,
  d.created_at
FROM public.whatsapp_capture_drafts d
LEFT JOIN public.whatsapp_contacts c ON c.id = d.contact_id
LEFT JOIN public.financial_accounts a ON a.id = d.account_id
LEFT JOIN public.projects p ON p.id = d.project_id
LEFT JOIN public.business_partners bp ON bp.id = d.business_partner_id
LEFT JOIN public.employees e ON e.id = d.employee_id
LEFT JOIN public.vehicles v ON v.id = d.vehicle_id
LEFT JOIN public.expense_categories ec ON ec.id = d.expense_category_id
WHERE d.status = 'pending_confirmation';

CREATE VIEW public.vw_whatsapp_capture_audit AS
SELECT
  d.company_id,
  d.id AS draft_id,
  c.phone_number,
  d.status,
  d.target_type,
  d.transcript,
  d.parsed_payload,
  d.amount,
  d.currency,
  d.description,
  d.account_movement_id,
  d.financial_document_id,
  d.payroll_line_id,
  d.fuel_transaction_id,
  d.employee_loan_id,
  d.partner_loan_id,
  source_msg.twilio_message_sid AS source_twilio_sid,
  source_msg.received_at AS source_received_at,
  confirm_msg.body AS confirmation_body,
  confirm_msg.received_at AS confirmation_received_at,
  d.confirmed_at,
  d.rejected_at,
  d.error_message,
  d.created_at,
  d.updated_at
FROM public.whatsapp_capture_drafts d
LEFT JOIN public.whatsapp_contacts c ON c.id = d.contact_id
LEFT JOIN public.whatsapp_messages source_msg ON source_msg.id = d.source_message_id
LEFT JOIN public.whatsapp_messages confirm_msg ON confirm_msg.id = d.confirmation_message_id;

CREATE VIEW public.vw_audit_timeline WITH (security_invoker = true) AS
SELECT
  ae.company_id,
  ae.id AS audit_event_id,
  ae.occurred_at,
  ae.action,
  ae.table_name,
  ae.record_id,
  ae.changed_fields,
  ae.actor_profile_id,
  COALESCE(p.full_name, ae.actor_label) AS actor_name,
  ae.actor_type,
  ae.source_module,
  ae.request_id,
  ae.http_method,
  ae.http_path,
  ae.reason
FROM public.audit_events ae
LEFT JOIN public.profiles p ON p.id = ae.actor_profile_id;

CREATE VIEW public.vw_record_audit_history WITH (security_invoker = true) AS
SELECT
  ae.company_id,
  ae.table_name,
  ae.record_id,
  ae.occurred_at,
  ae.action,
  ae.changed_fields,
  ae.old_data,
  ae.new_data,
  ae.actor_profile_id,
  COALESCE(p.full_name, ae.actor_label) AS actor_name,
  ae.actor_type,
  ae.source_module,
  ae.request_id,
  ae.reason
FROM public.audit_events ae
LEFT JOIN public.profiles p ON p.id = ae.actor_profile_id;

-- Basic tenant RLS helper and policies. The backend service role can still bypass
-- RLS, but browser/client access can rely on a JWT claim named company_id.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims text;
  company text;
BEGIN
  claims := current_setting('request.jwt.claims', true);
  IF claims IS NULL OR claims = '' THEN
    RETURN NULL;
  END IF;

  company := claims::jsonb ->> 'company_id';
  IF company IS NULL OR company = '' THEN
    RETURN NULL;
  END IF;

  RETURN company::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_tenant_select ON public.companies
  FOR SELECT USING (id = public.current_company_id());

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_tenant_select ON public.audit_events
  FOR SELECT USING (company_id = public.current_company_id());

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles',
    'business_partners',
    'projects',
    'project_aliases',
    'employees',
    'project_workers',
    'vehicles',
    'vehicle_assignments',
    'vehicle_insurance_policies',
    'expense_categories',
    'cost_centers',
    'items',
    'financial_accounts',
    'source_imports',
    'import_rows',
    'account_transfers',
    'account_movements',
    'bank_checks',
    'transaction_allocations',
    'supplier_credit_accounts',
    'financial_documents',
    'financial_document_lines',
    'document_payment_applications',
    'document_applications',
    'payroll_runs',
    'payroll_lines',
    'employee_loans',
    'employee_loan_payments',
    'partner_loans',
    'partner_loan_payments',
    'fuel_cards',
    'fuel_stations',
    'fuel_transactions',
    'recurring_obligations',
    'whatsapp_contacts',
    'whatsapp_messages',
    'whatsapp_capture_drafts',
    'attachments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (company_id = public.current_company_id())',
      tbl || '_tenant_select',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (company_id = public.current_company_id())',
      tbl || '_tenant_insert',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id())',
      tbl || '_tenant_update',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (company_id = public.current_company_id())',
      tbl || '_tenant_delete',
      tbl
    );
  END LOOP;
END$$;

-- Demo seed keeps local examples working after a rebuild.
INSERT INTO public.companies (
  id,
  name,
  legal_name,
  slug,
  industry,
  timezone,
  currency
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Company',
  'Demo Company',
  'demo-company',
  'construction',
  'America/Mexico_City',
  'MXN'
);

INSERT INTO public.financial_accounts (
  company_id,
  name,
  account_type,
  currency,
  opening_balance,
  opening_balance_date
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Banorte principal', 'bank', 'MXN', 0, current_date),
  ('00000000-0000-0000-0000-000000000001', 'Caja efectivo', 'cash', 'MXN', 0, current_date),
  ('00000000-0000-0000-0000-000000000001', 'Tarjetas empresariales', 'credit_card', 'MXN', 0, current_date),
  ('00000000-0000-0000-0000-000000000001', 'Oxxo Gas', 'fuel_card', 'MXN', 0, current_date);

-- Restore common Supabase grants only when those roles exist. This keeps the
-- script runnable in plain Postgres instances where anon/authenticated roles do
-- not exist yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT USAGE ON SCHEMA public TO anon;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
  END IF;
END$$;

COMMIT;
