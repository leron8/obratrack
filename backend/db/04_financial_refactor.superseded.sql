-- Migration: 04_financial_refactor.sql
-- Purpose: adapt the current ERP schema to support accounts, transfers,
-- transaction-level financial analysis, cost centers, allocations, and reporting
-- without breaking the existing UUID-based PostgreSQL schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type_enum') THEN
    CREATE TYPE transaction_type_enum AS ENUM ('income','expense','payroll','transfer','adjustment','refund');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type_enum') THEN
    CREATE TYPE account_type_enum AS ENUM ('cash','petty_cash','bank','credit_card','debit_card','digital_wallet','loan');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_classification_enum') THEN
    CREATE TYPE expense_classification_enum AS ENUM ('DIRECT','INDIRECT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'allocation_method_enum') THEN
    CREATE TYPE allocation_method_enum AS ENUM ('fixed_percentage','by_project_revenue','by_direct_costs','by_labor_hours','by_square_meters');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
    CREATE TYPE payment_method_enum AS ENUM ('cash','bank_transfer','card','cheque','other');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  account_type account_type_enum NOT NULL DEFAULT 'bank',
  bank_name text,
  account_number text,
  currency text NOT NULL DEFAULT 'USD',
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS account_type account_type_enum,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2),
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.accounts ALTER COLUMN account_type SET DEFAULT 'bank';
ALTER TABLE public.accounts ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.accounts ALTER COLUMN opening_balance SET DEFAULT 0;
ALTER TABLE public.accounts ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.accounts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.accounts ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.accounts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN opening_balance SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_company ON public.accounts (company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'accounts' AND c.conname = 'accounts_company_id_fkey'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  transfer_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS from_account_id uuid,
  ADD COLUMN IF NOT EXISTS to_account_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS transfer_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.transfers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.transfers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.transfers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.transfers ALTER COLUMN from_account_id SET NOT NULL;
ALTER TABLE public.transfers ALTER COLUMN to_account_id SET NOT NULL;
ALTER TABLE public.transfers ALTER COLUMN amount SET NOT NULL;
ALTER TABLE public.transfers ALTER COLUMN transfer_date SET NOT NULL;
ALTER TABLE public.transfers ALTER COLUMN amount SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transfers_company ON public.transfers (company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'transfers' AND c.conname = 'transfers_from_account_fkey'
  ) THEN
    ALTER TABLE public.transfers
      ADD CONSTRAINT transfers_from_account_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'transfers' AND c.conname = 'transfers_to_account_fkey'
  ) THEN
    ALTER TABLE public.transfers
      ADD CONSTRAINT transfers_to_account_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'transfers' AND c.conname = 'transfers_company_id_fkey'
  ) THEN
    ALTER TABLE public.transfers
      ADD CONSTRAINT transfers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END$$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS expense_category_id uuid,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method payment_method_enum,
  ADD COLUMN IF NOT EXISTS transaction_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS client text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_transaction_type_check'
  ) THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_transaction_type_check;
  END IF;
END$$;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY['income'::text, 'expense'::text, 'payroll'::text, 'transfer'::text, 'adjustment'::text, 'refund'::text]));

UPDATE public.transactions
SET transaction_date = occurred_at::date
WHERE transaction_date IS NULL AND occurred_at IS NOT NULL;

UPDATE public.transactions
SET transaction_date = CURRENT_DATE
WHERE transaction_date IS NULL;

ALTER TABLE public.transactions ALTER COLUMN transaction_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_trans_company_date ON public.transactions (company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_trans_project ON public.transactions (project_id);
CREATE INDEX IF NOT EXISTS idx_trans_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_trans_expense_category ON public.transactions (expense_category_id);
CREATE INDEX IF NOT EXISTS idx_trans_cost_center ON public.transactions (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_trans_supplier ON public.transactions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_trans_client ON public.transactions (client_id);
CREATE INDEX IF NOT EXISTS idx_trans_type_company_date ON public.transactions (transaction_type, company_id, transaction_date);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  classification expense_classification_enum,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (company_id, name)
);

ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS classification expense_classification_enum,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.expense_categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.expense_categories ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.expense_categories ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.expense_categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.expense_categories ALTER COLUMN name SET NOT NULL;
UPDATE public.expense_categories SET classification = 'INDIRECT' WHERE classification IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON public.expense_categories (company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'expense_categories' AND c.conname = 'expense_categories_company_id_fkey'
  ) THEN
    ALTER TABLE public.expense_categories
      ADD CONSTRAINT expense_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.cost_centers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.cost_centers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.cost_centers ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.cost_centers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cost_centers ALTER COLUMN name SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON public.cost_centers (company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'cost_centers' AND c.conname = 'cost_centers_company_id_fkey'
  ) THEN
    ALTER TABLE public.cost_centers
      ADD CONSTRAINT cost_centers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'transactions' AND c.conname = 'transactions_account_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'transactions' AND c.conname = 'transactions_expense_category_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_expense_category_id_fkey FOREIGN KEY (expense_category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'transactions' AND c.conname = 'transactions_cost_center_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  project_id uuid NOT NULL,
  allocated_amount numeric(12,2) NOT NULL CHECK (allocated_amount >= 0),
  allocation_percentage numeric(5,4) NOT NULL CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
  allocation_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_allocations
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS transaction_id uuid,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS allocated_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS allocation_percentage numeric(5,4),
  ADD COLUMN IF NOT EXISTS allocation_date date,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.cost_allocations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.cost_allocations ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.cost_allocations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.cost_allocations ALTER COLUMN transaction_id SET NOT NULL;
ALTER TABLE public.cost_allocations ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.cost_allocations ALTER COLUMN allocated_amount SET NOT NULL;
ALTER TABLE public.cost_allocations ALTER COLUMN allocation_percentage SET NOT NULL;
ALTER TABLE public.cost_allocations ALTER COLUMN allocation_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cost_alloc_company ON public.cost_allocations (company_id);
CREATE INDEX IF NOT EXISTS idx_cost_alloc_tx ON public.cost_allocations (transaction_id);
CREATE INDEX IF NOT EXISTS idx_cost_alloc_project ON public.cost_allocations (project_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'cost_allocations' AND c.conname = 'cost_allocations_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.cost_allocations
      ADD CONSTRAINT cost_allocations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'cost_allocations' AND c.conname = 'cost_allocations_project_id_fkey'
  ) THEN
    ALTER TABLE public.cost_allocations
      ADD CONSTRAINT cost_allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'cost_allocations' AND c.conname = 'cost_allocations_company_id_fkey'
  ) THEN
    ALTER TABLE public.cost_allocations
      ADD CONSTRAINT cost_allocations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  allocation_method allocation_method_enum NOT NULL,
  params jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.allocation_rules
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS allocation_method allocation_method_enum,
  ADD COLUMN IF NOT EXISTS params jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.allocation_rules ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.allocation_rules ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.allocation_rules ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.allocation_rules ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.allocation_rules ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.allocation_rules ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.allocation_rules ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_allocation_rules_company ON public.allocation_rules (company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'allocation_rules' AND c.conname = 'allocation_rules_company_id_fkey'
  ) THEN
    ALTER TABLE public.allocation_rules
      ADD CONSTRAINT allocation_rules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_transactions') THEN
    CREATE TRIGGER set_timestamp_transactions
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_accounts') THEN
    CREATE TRIGGER set_timestamp_accounts
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_allocation_rules') THEN
    CREATE TRIGGER set_timestamp_allocation_rules
    BEFORE UPDATE ON public.allocation_rules
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
END$$;

COMMIT;
