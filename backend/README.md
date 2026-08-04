# Backend

Express + TypeScript API for ObraTrack.

Key additions in this auth update:

- Supabase JWT validation middleware
- active-company loading middleware
- role-aware request context on `req.user`
- onboarding/session/company-switch endpoints
- membership-based RLS support

See the root [README](../README.md) for:

- migration order
- Supabase Auth setup
- environment variables
- local development commands
