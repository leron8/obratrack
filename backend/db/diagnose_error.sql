-- Diagnostic script to identify the exact source of the "company_id is ambiguous" error

-- 1. Check the current function definition
SELECT 
  'FUNCTION DEFINITION' as section,
  pg_get_functiondef('public.complete_user_onboarding'::regproc) as content
UNION ALL
-- 2. Check all triggers that might fire during onboarding
SELECT 
  'TRIGGERS ON USERS' as section,
  string_agg(tgname || ': ' || pg_get_triggerdef(oid), E'\n') as content
FROM pg_trigger 
WHERE tgrelid = 'public.users'::regclass 
  AND NOT tgisinternal
UNION ALL
SELECT 
  'TRIGGERS ON COMPANIES' as section,
  string_agg(tgname || ': ' || pg_get_triggerdef(oid), E'\n') as content
FROM pg_trigger 
WHERE tgrelid = 'public.companies'::regclass 
  AND NOT tgisinternal
UNION ALL
SELECT 
  'TRIGGERS ON COMPANY_MEMBERS' as section,
  string_agg(tgname || ': ' || pg_get_triggerdef(oid), E'\n') as content
FROM pg_trigger 
WHERE tgrelid = 'public.company_members'::regclass 
  AND NOT tgisinternal;

-- 3. Test the function with detailed error capture
-- Replace 'USER_ID_HERE' with an actual user ID from your database
-- This will show the exact line number and context of the error
DO $$
DECLARE
  test_user_id uuid := 'USER_ID_HERE'::uuid;  -- REPLACE THIS WITH ACTUAL USER ID
  result record;
BEGIN
  BEGIN
    SELECT * INTO result
    FROM public.complete_user_onboarding(
      test_user_id,
      'test@example.com',
      'Test User',
      '+1234567890',
      'US',
      'America/New_York',
      'Personal'
    );
    
    RAISE NOTICE 'SUCCESS: user_id=%, company_id=%', result.user_id, result.company_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ERROR at line %: %', SQLSTATE, SQLERRM;
  END;
END $$;