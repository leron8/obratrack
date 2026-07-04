# Backend (Express + TypeScript)

## Prerequisites

- Node.js 20+
- A Supabase project
- Twilio WhatsApp sandbox
- OpenAI API key

## 1) Create the database schema

Run the SQL files in `db/` in numeric order in the Supabase SQL editor (or migrate them).

For the default demo configuration, also run `db/07_demo_seed.sql`. It creates the company row used by:

```text
00000000-0000-0000-0000-000000000001
```

## 2) Configure environment variables

Copy `.env.example` to `.env` in this folder and fill in values.

## 3) Install + run

```bash
cd backend
npm install
npm run dev
```

- Backend runs at: `http://localhost:3001`

## API endpoints

- `POST /webhook/whatsapp`  
  Twilio sends an audio `MediaUrl0`. The backend downloads it, transcribes with Whisper, then parses with GPT and inserts into `transactions`.
- `POST /parse-transaction`  
  Input: `{ "text": "...", "company_id"?: "uuid" }`
- `GET /transactions?company_id=uuid&limit=50`
- `GET /report/month?month=YYYY-MM&company_id=uuid`

## Twilio WhatsApp webhook setup (sandbox)

1. Start your backend locally and expose it with ngrok (example):
   ```bash
   ngrok http 3001
   ```
2. In the Twilio Console → WhatsApp → Sandbox configuration:
   - Set **Webhook** URL to: `https://<YOUR_NGROK_URL>/webhook/whatsapp`
   - Ensure HTTP method is `POST`
3. Twilio will send fields like:
   ```text
   Content-Type: application/x-www-form-urlencoded

   From=whatsapp:+14155551212
   To=whatsapp:+14155559876
   NumMedia=1
   MediaUrl0=https://.../audio.ogg
   Body=
   ```

The backend immediately returns TwiML:

```xml
<Response></Response>
```

## Example test requests

### Test GPT parsing directly

```bash
curl -s -X POST "http://localhost:3001/parse-transaction" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id":"00000000-0000-0000-0000-000000000001",
    "text":"Ingreso mil quinientos del cliente Juan"
  }'
```

### Test totals

```bash
curl -s "http://localhost:3001/report/month?month=2026-03&company_id=00000000-0000-0000-0000-000000000001"
```

### Test the webhook without audio (text fallback)

Our demo webhook also accepts `Body` text when `NumMedia=0`, so you can test end-to-end without a public audio URL:

```bash
curl -s -X POST "http://localhost:3001/webhook/whatsapp" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'NumMedia=0' \
  -d 'Body=Gasto quinientos en n%c3%b3mina'
```
