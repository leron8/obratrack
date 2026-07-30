-- Run these queries in Supabase SQL Editor to debug the issue

-- 1. First, verify the function was actually updated
SELECT pg_get_functiondef('public.complete_user_onboarding'::regproc);

-- 2. Check if there are any triggers on the tables that might be causing issues
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid IN ('public.users'::regclass, 'public.companies'::regclass, 'public.company_members'::regclass)
  AND NOT tgisinternal;

-- 3. Check the exact error by running a test (replace with actual user_id)
-- SELECT * FROM public.complete_user_onboarding(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'test@example.com',
--   'Test User',
--   '+1234567890',
--   'US',
--   'America/New_York',
--   'Personal'
-- );