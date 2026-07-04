# Obratrack - Expense Management Monorepo

A monorepo containing the Obratrack expense management system with shared types, backend API, and frontend application.

## Structure

```
.
├── shared/          # Shared TypeScript types and utilities
├── backend/         # Express.js backend API
├── frontend/        # Next.js frontend application
├── package.json     # Root workspace configuration
└── .github/         # CI/CD workflows
```

## Prerequisites

- Node.js 20+
- npm 9+

## Installation

```bash
npm install
```

This will install dependencies for all workspaces (shared, backend, frontend).

## Development

### Run Backend
```bash
npm run dev:backend
```

### Run Frontend
```bash
npm run dev:frontend
```

## Building

```bash
# Build all packages
npm run build:shared
npm run build:backend
npm run build:frontend

# Or build individually
npm run build -w backend
npm run build -w frontend
```

## Workspaces

- **@expenses/shared** - Shared TypeScript types and interfaces used by both backend and frontend
- **expenses-backend** - Express.js REST API with Supabase integration
- **expenses-frontend** - Next.js 14 application with TypeScript and Tailwind CSS

## Deployment

### Option 1: Native Integrations (Recommended)

**Vercel (Frontend):**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Next.js and configures build settings
5. Add environment variables in Vercel dashboard
6. Every push to `main` triggers automatic deployment

**Render (Backend):**
1. Go to [render.com](https://render.com)
2. Create new **Web Service**
3. Connect your GitHub repository
4. Set **Root Directory** to `backend`
5. Set **Build Command**: `npm install && npm run build`
6. Set **Start Command**: `npm start`
7. Add environment variables in Render dashboard
8. Every push to `main` triggers automatic deployment

### Option 2: GitHub Actions with API (Advanced)

If you want GitHub Actions to trigger deployments:

**Required Secrets:**
- `VERCEL_TOKEN` - Get from [vercel.com/account/tokens](https://vercel.com/account/tokens)
- `RENDER_API_KEY` - Get from Render dashboard → Settings → API Keys

**Setup:**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `VERCEL_TOKEN` - Your Vercel API token
   - `RENDER_API_KEY` - Your Render API key
3. Uncomment the deployment jobs in `.github/workflows/ci-cd.yml`

## CI/CD

GitHub Actions workflow runs on every push to main:
1. ✅ Installs dependencies for all workspaces
2. ✅ Builds shared package
3. ✅ Builds backend
4. ✅ Builds frontend
5. ✅ Validates that everything compiles

## Git Workflow

1. Create feature branches from `main`
2. Make changes in the appropriate workspace
3. Push and create a pull request
4. After review, merge to `main` to trigger deployment

## Environment Variables

### Backend (.env in backend/ directory)
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
WHATSAPP_API_TOKEN=your_whatsapp_token
```

### Frontend (.env.local in frontend/ directory)
```
NEXT_PUBLIC_API_URL=your_backend_url
```

## Troubleshooting

**"npm not found" error:**
- Install Node.js 20+ from [nodejs.org](https://nodejs.org/)

**Build errors:**
- Ensure all dependencies are installed: `npm install`
- Check that workspace paths are correct in package.json

**Deployment not triggering:**
- Verify GitHub integration is enabled in Vercel/Render
- Check that root directory is set correctly