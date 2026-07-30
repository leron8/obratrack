# Debugging complete_user_onboarding Error

## Step 1: Verify the function was actually updated

Run this in Supabase SQL Editor:

```sql
SELECT pg_get_functiondef('public.complete_user_onboarding'::regproc);
```

**What to look for:**
- Check if line 1970 shows: `SELECT p_user_id AS user_id, target_company_id AS company_id;`
- If it still shows `SELECT p_user_id, target_company_id;` without aliases, the function wasn't updated

## Step 2: Test the function directly in SQL

Run this in Supabase SQL Editor (replace with a real user_id from your database):

```sql
-- First, check if the user exists
SELECT id, email FROM public.users LIMIT 1;

-- Then test the function with that user_id
SELECT * FROM public.complete_user_onboarding(
  'ACTUAL_USER_ID_HERE'::uuid,
  'test@example.com',
  'Test User',
  '+1234567890',
  'US',
  'America/New_York',
  'Personal'
);
```

**This will show you the exact error and line number.**

## Step 3: Check if triggers are causing the issue

Run this to see all triggers on the tables:

```sql
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgrelid IN (
    'public.users'::regclass,
    'public.companies'::regclass,
    'public.company_members'::regclass
  );
```

## Common Issues:

### Issue 1: Function not updated
**Solution:** Re-run the fix_complete_user_onboarding.sql file in Supabase SQL Editor

### Issue 2: Error is actually from a trigger
The audit trigger `audit_capture_row_change` fires on INSERT/UPDATE/DELETE. 
If the error occurs during trigger execution, the error message might mention 
the trigger's context.

### Issue 3: Error is from the calling code
Check the TypeScript error more carefully - the line number might point to 
the auth.service.ts file instead of the database function.

## Quick Test:

Run this to see the full function source:

```sql
SELECT pg_get_functiondef('public.complete_user_onboarding'::regproc) \gset

-- Then view it
SELECT :'pg_get_functiondef';
```

Or simply copy the output from the first query and paste it here so I can 
see if the function was actually updated correctly.