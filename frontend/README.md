# Frontend (Next.js + React + Chart.js)

## Run locally

```bash
cd frontend
npm install
npm run dev
```

- Frontend runs at: `http://localhost:3000`

## Environment variables

Copy `frontend/.env.example` to `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3001`)
- `NEXT_PUBLIC_COMPANY_ID` (uuid used for queries)

## What it shows

- Total income / total expenses / balance (current month)
- Chart of recent transactions
- Recent transactions list

