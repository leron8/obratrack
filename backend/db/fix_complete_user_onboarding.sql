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
  SELECT p_user_id AS user_id, target_company_id AS company_id;
END;
$$;