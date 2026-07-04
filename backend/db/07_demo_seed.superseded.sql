-- Demo tenant used by .env.example and the frontend example configuration.
-- Run after the schema migrations so transaction inserts have a valid company_id.

INSERT INTO public.companies (
  id,
  name,
  slug,
  industry,
  timezone,
  currency
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Company',
  'demo-company',
  'construction',
  'America/Mexico_City',
  'MXN'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  industry = EXCLUDED.industry,
  timezone = EXCLUDED.timezone,
  currency = EXCLUDED.currency,
  updated_at = now();
