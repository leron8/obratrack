# ObraTrack Monorepo

Financial assistant for capturing income and expenses through WhatsApp while managing operations from a secure web dashboard.

## Stack

- `frontend/`: Next.js 14 + React + Tailwind
- `backend/`: Express + TypeScript
- `shared/`: shared TypeScript types
- Database/Auth: Supabase PostgreSQL + Supabase Auth

## Auth And Authorization

This repo now uses Supabase Auth with:

- passwordless email magic links
- persisted browser sessions
- automatic session refresh via Next.js middleware
- protected application routes
- onboarding after first login
- multi-company membership support
- company role-based authorization
- Supabase RLS for company isolation

## Folder Highlights

```text
backend/
  db/
    09_auth_memberships_and_rls.sql
  src/
    middleware/authentication.ts
    modules/auth/
      dto/
      repositories/
      services/
    routes/auth.ts

frontend/
  src/
    app/
      auth/callback/
      login/
      onboarding/
      unauthorized/
    components/auth/
    hooks/
    lib/supabase/
    providers/AuthProvider.tsx
```

## Prerequisites

- Node.js 20+
- npm 9+
- a Supabase project with Auth enabled

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Supabase Auth

In the Supabase dashboard:

1. Enable the Email provider.
2. Keep password sign-in disabled for this app if you want a magic-link-only flow.
3. Set the site URL to your frontend origin.
4. Add redirect URLs for:
   - `http://localhost:3000/auth/callback`
   - your production frontend callback URL

## 3. Run Database SQL

Run the SQL files in `backend/db/` in numeric order.

Important:

1. Run `00_rebuild_mvp_erp_schema.sql`
2. Run `08_demo_seed.sql` only if you still want the legacy demo seed
3. Run `09_auth_memberships_and_rls.sql`

The new migration:

- renames the legacy `profiles` table to `users`
- creates `company_members`
- adds onboarding helpers
- adds `owner_user_id` and `active_company_id`
- applies membership-based RLS policies

## 4. Environment Variables

### Backend

Copy `backend/.env.example` to `backend/.env`.

Required:

- `FRONTEND_URL`
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Optional:

- `DEFAULT_COMPANY_ID`
  Use only for unauthenticated WhatsApp/demo flows.

### Frontend

Copy `frontend/.env.example` to `frontend/.env.local`.

Required:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

## 5. Run Locally

```bash
npm run dev:backend
npm run dev:frontend
```

Frontend:

- `http://localhost:3000`

Backend:

- `http://localhost:3001`

## Auth Flow

1. Open `/login`
2. Enter an email address
3. Click `Continue with Magic Link`
4. Open the email and follow the Supabase link
5. On first login, complete onboarding with:
   - full name
   - WhatsApp phone number
   - country
   - time zone
6. The backend creates the initial company named `Personal`
7. The user becomes the `OWNER`

## Roles

- `OWNER`: full access
- `ADMIN`: almost full access, except company deletion
- `ACCOUNTANT`: financial management and reports
- `INCOME_REGISTRAR`: can create income transactions
- `EXPENSE_REGISTRAR`: can create expense transactions
- `VIEWER`: read-only access

## Backend Session Endpoints

- `GET /auth/session`
- `POST /auth/onboarding`
- `PUT /auth/active-company`

All protected business routes now require a Supabase bearer token.

## Notes

- Business routes use a user-scoped Supabase client so RLS enforces company isolation.
- The dashboard company selector persists through `users.active_company_id`.
- The old `x-user-role` demo flow was removed from the frontend.

## Verification

This environment did not include `node` or `npm`, so dependency install and type/build verification could not be run here. After pulling these changes, run:

```bash
npm install
npm run build:backend
npm run build:frontend
```
