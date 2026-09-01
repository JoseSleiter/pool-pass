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

Admin: create users manually in Supabase Studio (Authentication → Add user, Auto Confirm). No self-signup. A logged-in user is **not** an admin unless their email is in `ADMIN_EMAILS` (see `.env.example`) — this gates both the `/admin` pages and every admin server action.

## Personalización del landing

- Textos del landing (nombre del club, amenidades, dirección, horario, WhatsApp, Instagram): edita `src/lib/landing-content.ts`.
- Fotos de la galería: coloca hasta 6 imágenes (`.jpg/.png/.webp/.avif`) en `public/gallery/`; sin fotos se muestran placeholders degradados.
- Assets de marca (logo, iconos, favicon, logo del email): se **generan** desde `assets/brand-source/logo-cartel.jpg` con `npm run brand:assets`; no se editan a mano. El logo es un recorte de una foto del cartel físico, provisional hasta que exista el original vectorial del diseñador (ver `docs/superpowers/specs/2026-08-31-brand-identity-design.md`).

## Deploy checklist

> Full step-by-step (incl. security lockdown and the C2P mock→real switch): **[docs/deploy-vercel.md](docs/deploy-vercel.md)**.

1. **Supabase cloud**: create the project; `npx supabase link` + `npx supabase db push` to apply migrations (incl. `0003` RLS lockdown + rate limiter); create admin user(s) in Authentication; **disable public signup**.
2. **Vercel**: set every var from `.env.example` with production values (incl. `ADMIN_EMAILS`); `NEXT_PUBLIC_APP_URL=https://<your-domain>`. Set `MERCANTIL_MOCK=1` while running C2P in test mode; switch to `0` only after confirming the Mercantil contract (see the deploy doc).
3. **Resend**: verify the sending domain for `VOUCHER_FROM_EMAIL`.
4. **Verify the Mercantil wire contract against the integration doc for your merchant account** — these were implemented from public samples and MUST be confirmed before any real charge:
   - Cipher convention in `src/lib/mercantil/encrypt.ts` (AES-256-CBC, key = SHA-256(secret), zero IV, base64).
   - `destination_bank_id` sent as a number (`'0105'` → `105`) in `src/lib/mercantil/client.ts`.
   - `amount` sent as a JSON number with 2 decimals (not a string).
   - Terminal decline statuses: only `rejected`/`denied` release capacity; any other status maps to "unknown" and keeps the reservation pending — confirm the doc's status vocabulary.
5. **Production smoke test** (spec requirement): one real minimal booking end to end — pay a small amount, receive the email, scan the QR, check in from `/admin/checkin/[id]`, then clean up the test reservation from `/admin` or the database.
6. Ops notes: pending payments hold capacity for 10 minutes; reservations with status `pending_payment` that show in `/admin` after a payment incident must be verified manually against the Mercantil statement (the app never auto-retries a C2P charge).
