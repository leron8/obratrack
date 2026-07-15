BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'company_member_role'
  ) THEN
    CREATE TYPE public.company_member_role AS ENUM (
      'OWNER',
      'ADMIN',
      'ACCOUNTANT',
      'INCOME_REGISTRAR',
      'EXPENSE_REGISTRAR',
      'VIEWER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL AND to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles RENAME TO users;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'phone'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN phone TO phone_number;
  END IF;
END $$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.company_member_role NOT NULL DEFAULT 'VIEWER',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'company_id'
  ) THEN
    INSERT INTO public.company_members (company_id, user_id, role, created_at)
    SELECT
      u.company_id,
      u.id,
      CASE upper(COALESCE(u.role::text, 'VIEWER'))
        WHEN 'OWNER' THEN 'OWNER'::public.company_member_role
        WHEN 'ADMIN' THEN 'ADMIN'::public.company_member_role
        WHEN 'ACCOUNTANT' THEN 'ACCOUNTANT'::public.company_member_role
        WHEN 'MANAGER' THEN 'ADMIN'::public.company_member_role
        ELSE 'VIEWER'::public.company_member_role
      END,
      COALESCE(u.created_at, now())
    FROM public.users u
    WHERE u.company_id IS NOT NULL
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS active_company_id uuid,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'legacy_company_id'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN company_id TO legacy_company_id;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS legacy_company_id uuid,
  ADD COLUMN IF NOT EXISTS legacy_role public.user_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'legacy_role'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN role TO legacy_role;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'legacy_company_id'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN legacy_company_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS profiles_company_id_email_key,
  DROP CONSTRAINT IF EXISTS users_company_id_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_members_company_role ON public.company_members(company_id, role);
CREATE INDEX IF NOT EXISTS idx_users_active_company ON public.users(active_company_id);

WITH ranked_members AS (
  SELECT
    cm.company_id,
    cm.user_id,
    row_number() OVER (
      PARTITION BY cm.company_id
      ORDER BY
        CASE cm.role
          WHEN 'OWNER' THEN 0
          WHEN 'ADMIN' THEN 1
          WHEN 'ACCOUNTANT' THEN 2
          ELSE 3
        END,
        cm.created_at,
        cm.user_id
    ) AS row_num
  FROM public.company_members cm
)
UPDATE public.companies c
SET owner_user_id = ranked_members.user_id
FROM ranked_members
WHERE c.id = ranked_members.company_id
  AND ranked_members.row_num = 1
  AND c.owner_user_id IS NULL;

WITH preferred_membership AS (
  SELECT DISTINCT ON (cm.user_id)
    cm.user_id,
    cm.company_id
  FROM public.company_members cm
  ORDER BY
    cm.user_id,
    CASE cm.role
      WHEN 'OWNER' THEN 0
      WHEN 'ADMIN' THEN 1
      WHEN 'ACCOUNTANT' THEN 2
      ELSE 3
    END,
    cm.created_at
)
UPDATE public.users u
SET
  active_company_id = preferred_membership.company_id,
  onboarding_completed_at = COALESCE(u.onboarding_completed_at, u.updated_at, u.created_at, now())
FROM preferred_membership
WHERE u.id = preferred_membership.user_id
  AND u.active_company_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_owner_user_id_fkey'
      AND conrelid = 'public.companies'::regclass
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_active_company_id_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_active_company_id_fkey
      FOREIGN KEY (active_company_id) REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_company_slug(base_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  normalized text;
  candidate text;
BEGIN
  normalized := lower(regexp_replace(COALESCE(NULLIF(trim(base_name), ''), 'workspace'), '[^a-z0-9]+', '-', 'g'));
  normalized := trim(both '-' from normalized);

  IF normalized = '' THEN
    normalized := 'workspace';
  END IF;

  candidate := normalized;

  IF EXISTS (SELECT 1 FROM public.companies WHERE slug = candidate) THEN
    candidate := left(normalized, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_user_onboarding(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone_number text,
  p_country text,
  p_timezone text,
  p_company_name text DEFAULT 'Personal'
)
RETURNS TABLE (user_id uuid, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_company_name text;
  target_company_id uuid;
BEGIN
  normalized_company_name := COALESCE(NULLIF(trim(p_company_name), ''), 'Personal');

  INSERT INTO public.users (
    id,
    email,
    full_name,
    phone_number,
    country,
    timezone,
    created_at,
    updated_at,
    onboarding_completed_at
  )
  VALUES (
    p_user_id,
    lower(trim(p_email)),
    NULLIF(trim(p_full_name), ''),
    NULLIF(trim(p_phone_number), ''),
    NULLIF(trim(p_country), ''),
    NULLIF(trim(p_timezone), ''),
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    country = EXCLUDED.country,
    timezone = EXCLUDED.timezone,
    updated_at = now();

  SELECT u.active_company_id
  INTO target_company_id
  FROM public.users u
  WHERE u.id = p_user_id;

  IF target_company_id IS NULL THEN
    SELECT cm.company_id
    INTO target_company_id
    FROM public.company_members cm
    WHERE cm.user_id = p_user_id
    ORDER BY
      CASE cm.role
        WHEN 'OWNER' THEN 0
        WHEN 'ADMIN' THEN 1
        ELSE 2
      END,
      cm.created_at
    LIMIT 1;
  END IF;

  IF target_company_id IS NULL THEN
    INSERT INTO public.companies (
      name,
      slug,
      timezone,
      owner_user_id
    )
    VALUES (
      normalized_company_name,
      public.generate_company_slug(normalized_company_name),
      COALESCE(NULLIF(trim(p_timezone), ''), 'UTC'),
      p_user_id
    )
    RETURNING id INTO target_company_id;

    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (target_company_id, p_user_id, 'OWNER')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  ELSE
    UPDATE public.companies
    SET owner_user_id = COALESCE(owner_user_id, p_user_id)
    WHERE id = target_company_id;
  END IF;

  UPDATE public.users
  SET
    active_company_id = target_company_id,
    onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT p_user_id, target_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.company_id = target_company_id
      AND cm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.company_role(target_company_id uuid)
RETURNS public.company_member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.role
  FROM public.company_members cm
  WHERE cm.company_id = target_company_id
    AND cm.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(
  target_company_id uuid,
  allowed_roles public.company_member_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.company_id = target_company_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY(allowed_roles)
  );
$$;

DROP VIEW IF EXISTS public.profiles;

CREATE VIEW public.profiles AS
SELECT
  u.id,
  COALESCE(active_membership.company_id, u.active_company_id, u.legacy_company_id) AS company_id,
  COALESCE(
    active_membership.role::text,
    CASE upper(COALESCE(u.legacy_role::text, ''))
      WHEN 'OWNER' THEN 'OWNER'
      WHEN 'ADMIN' THEN 'ADMIN'
      WHEN 'ACCOUNTANT' THEN 'ACCOUNTANT'
      WHEN 'MANAGER' THEN 'ADMIN'
      WHEN 'VIEWER' THEN 'VIEWER'
      ELSE NULL
    END
  ) AS role,
  u.status,
  u.full_name,
  u.email,
  u.phone_number AS phone,
  u.created_at,
  u.updated_at,
  u.deleted_at
FROM public.users u
LEFT JOIN LATERAL (
  SELECT cm.company_id, cm.role
  FROM public.company_members cm
  WHERE cm.user_id = u.id
  ORDER BY
    CASE WHEN cm.company_id = u.active_company_id THEN 0 ELSE 1 END,
    cm.created_at
  LIMIT 1
) active_membership ON TRUE;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users
  FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_member_select ON public.companies;
CREATE POLICY companies_member_select ON public.companies
  FOR SELECT USING (public.is_company_member(id));
DROP POLICY IF EXISTS companies_admin_update ON public.companies;
CREATE POLICY companies_admin_update ON public.companies
  FOR UPDATE USING (public.has_company_role(id, ARRAY['OWNER', 'ADMIN']::public.company_member_role[]))
  WITH CHECK (public.has_company_role(id, ARRAY['OWNER', 'ADMIN']::public.company_member_role[]));
DROP POLICY IF EXISTS companies_owner_delete ON public.companies;
CREATE POLICY companies_owner_delete ON public.companies
  FOR DELETE USING (public.has_company_role(id, ARRAY['OWNER']::public.company_member_role[]));

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_members_member_select ON public.company_members;
CREATE POLICY company_members_member_select ON public.company_members
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS company_members_admin_insert ON public.company_members;
CREATE POLICY company_members_admin_insert ON public.company_members
  FOR INSERT WITH CHECK (public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN']::public.company_member_role[]));
DROP POLICY IF EXISTS company_members_admin_update ON public.company_members;
CREATE POLICY company_members_admin_update ON public.company_members
  FOR UPDATE USING (public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN']::public.company_member_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN']::public.company_member_role[]));
DROP POLICY IF EXISTS company_members_admin_delete ON public.company_members;
CREATE POLICY company_members_admin_delete ON public.company_members
  FOR DELETE USING (public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN']::public.company_member_role[]));

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_member_select ON public.audit_events;
CREATE POLICY audit_events_member_select ON public.audit_events
  FOR SELECT USING (public.is_company_member(company_id));

ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_movements_member_select ON public.account_movements;
CREATE POLICY account_movements_member_select ON public.account_movements
  FOR SELECT USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS account_movements_financial_insert ON public.account_movements;
CREATE POLICY account_movements_financial_insert ON public.account_movements
  FOR INSERT WITH CHECK (
    public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN', 'ACCOUNTANT']::public.company_member_role[])
  );
DROP POLICY IF EXISTS account_movements_income_registrar_insert ON public.account_movements;
CREATE POLICY account_movements_income_registrar_insert ON public.account_movements
  FOR INSERT WITH CHECK (
    direction = 'in'
    AND public.has_company_role(company_id, ARRAY['INCOME_REGISTRAR']::public.company_member_role[])
  );
DROP POLICY IF EXISTS account_movements_expense_registrar_insert ON public.account_movements;
CREATE POLICY account_movements_expense_registrar_insert ON public.account_movements
  FOR INSERT WITH CHECK (
    direction = 'out'
    AND public.has_company_role(company_id, ARRAY['EXPENSE_REGISTRAR']::public.company_member_role[])
  );
DROP POLICY IF EXISTS account_movements_financial_update ON public.account_movements;
CREATE POLICY account_movements_financial_update ON public.account_movements
  FOR UPDATE USING (
    public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN', 'ACCOUNTANT']::public.company_member_role[])
  )
  WITH CHECK (
    public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN', 'ACCOUNTANT']::public.company_member_role[])
  );
DROP POLICY IF EXISTS account_movements_financial_delete ON public.account_movements;
CREATE POLICY account_movements_financial_delete ON public.account_movements
  FOR DELETE USING (
    public.has_company_role(company_id, ARRAY['OWNER', 'ADMIN', 'ACCOUNTANT']::public.company_member_role[])
  );

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
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

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_member_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_company_member(company_id))',
      tbl || '_member_select',
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_financial_insert', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.has_company_role(company_id, ARRAY[''OWNER'', ''ADMIN'', ''ACCOUNTANT'']::public.company_member_role[]))',
      tbl || '_financial_insert',
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_financial_update', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.has_company_role(company_id, ARRAY[''OWNER'', ''ADMIN'', ''ACCOUNTANT'']::public.company_member_role[])) WITH CHECK (public.has_company_role(company_id, ARRAY[''OWNER'', ''ADMIN'', ''ACCOUNTANT'']::public.company_member_role[]))',
      tbl || '_financial_update',
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_financial_delete', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (public.has_company_role(company_id, ARRAY[''OWNER'', ''ADMIN'', ''ACCOUNTANT'']::public.company_member_role[]))',
      tbl || '_financial_delete',
      tbl
    );
  END LOOP;
END $$;

COMMIT;
