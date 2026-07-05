# Pool Pass

PWA móvil para reservar pases de piscina con pago C2P (Pago Móvil, Banco Mercantil), conversión USD→VES a tasa BCV, y vouchers con QR por correo.

## Stack

Next.js (App Router) · Tailwind CSS + shadcn/ui · Supabase (Postgres + Auth) · Mercantil C2P · Resend · Vercel

## Desarrollo local

```bash
nvm use            # Node 20 (see .nvmrc)
npm install
npx supabase start # requires Docker
cp .env.example .env.local   # fill from `npx supabase status`
npm run dev
```

Tests: `npm test` (unit) · `npm run test:integration` (needs local Supabase) · `npm run test:e2e` (Playwright; needs local Supabase, uses MERCANTIL_MOCK=1)

Admin: create users manually in Supabase Studio (Authentication → Add user, Auto Confirm). No self-signup.

## Deploy checklist

1. **Supabase cloud**: create the project; `npx supabase link` + `npx supabase db push` to apply migrations; create admin user(s) in Authentication.
2. **Vercel**: set every var from `.env.example` with production values; `MERCANTIL_MOCK=0`; `NEXT_PUBLIC_APP_URL=https://<your-domain>`.
3. **Resend**: verify the sending domain for `VOUCHER_FROM_EMAIL`.
4. **Verify the Mercantil wire contract against the integration doc for your merchant account** — these were implemented from public samples and MUST be confirmed before any real charge:
   - Cipher convention in `src/lib/mercantil/encrypt.ts` (AES-256-CBC, key = SHA-256(secret), zero IV, base64).
   - `destination_bank_id` sent as a number (`'0105'` → `105`) in `src/lib/mercantil/client.ts`.
   - `amount` sent as a JSON number with 2 decimals (not a string).
   - Terminal decline statuses: only `rejected`/`denied` release capacity; any other status maps to "unknown" and keeps the reservation pending — confirm the doc's status vocabulary.
5. **Production smoke test** (spec requirement): one real minimal booking end to end — pay a small amount, receive the email, scan the QR, check in from `/admin/checkin/[id]`, then clean up the test reservation from `/admin` or the database.
6. Ops notes: pending payments hold capacity for 10 minutes; reservations with status `pending_payment` that show in `/admin` after a payment incident must be verified manually against the Mercantil statement (the app never auto-retries a C2P charge).
