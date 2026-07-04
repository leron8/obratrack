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

- **Backend**: Automatically deploys to Render via GitHub integration
- **Frontend**: Automatically deploys to Vercel via GitHub integration

## CI/CD

GitHub Actions workflow runs on every push to main:
1. Installs dependencies
2. Builds all packages
3. Deploys backend to Render
4. Deploys frontend to Vercel

## Git Workflow

1. Create feature branches from `main`
2. Make changes in the appropriate workspace
3. Push and create a pull request
4. After review, merge to `main` to trigger deployment