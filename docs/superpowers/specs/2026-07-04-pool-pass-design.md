# Pool & Services Pass PWA — Design

**Date:** 2026-07-04
**Status:** Approved by user (brainstorming session)
**Source requirements:** `Pool_Pass_App_User_Stories.md` (HU-01 … HU-05)

## Overview

A mobile-first Progressive Web App for reserving pool day passes. Customers pick a
date, select attendees, and pay in VES via Pago Móvil C2P (Mercantil Banco), with
USD prices converted at the official BCV rate. A successful payment produces an
email voucher with a QR code that gate staff scan to check the party in.

## Decisions Made

| Decision | Choice |
| --- | --- |
| Framework | Next.js (App Router) on Vercel |
| UI | Tailwind CSS + shadcn/ui, mobile-first |
| Backend | Server Actions in the same Next.js app (no separate API) |
| Database / Auth | Supabase Postgres; Supabase Auth for **admin only** |
| Customer auth | None — guest checkout |
| Admin scope | Minimal: reservations by date, settings, QR check-in |
| Payments | Mercantil C2P `v1/payment/pay`, production credentials available |
| Gate verification | QR code in voucher email → admin check-in page |
| Email | Resend + react-email templates |

## Architecture

Single Next.js App Router project. All secrets (Mercantil merchant/integrator keys
and AES secret, Resend API key, Supabase service role key) live in server-side env
vars and are only used inside Server Actions / route handlers. The client never
sees prices as authoritative data — totals are recomputed server-side.

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Booking wizard: date + attendees + contact → ID + C2P payment → confirmation |
| `/admin` | Auth-protected: reservations list by date, capacity summary, manual check-in |
| `/admin/settings` | Capacity, prices, per-date overrides |
| `/admin/checkin/[id]` | Check-in page opened by scanning the voucher QR |
| `/admin/login` | Supabase Auth email+password login |
| `/api/qr/[id]` | Server-rendered QR PNG (email clients strip data-URI images) |

### PWA

Web manifest + icons so the app is installable. No offline support in v1 — every
flow requires the network anyway.

## Data Model

### `settings` (single row)

- `daily_capacity` int
- `adult_price_usd` numeric
- `child_price_usd` numeric
- `last_bcv_rate` numeric, `last_bcv_rate_at` timestamptz (rate cache)

### `capacity_overrides`

- `date` (PK), `capacity` int — per-date capacity override; `0` = closed that day.

### `reservations`

- `id` uuid PK; `code` short human-readable unique code (e.g. `PP-4F7K2`)
- `date`, `first_name`, `last_name`, `email`
- `id_type` (`V`/`E`/`P`/`J`), `id_number`
- `adults`, `children`
- `total_usd`, `bcv_rate`, `total_ves`
- `status`: `pending_payment` → `confirmed` → `checked_in`; exits: `failed`, `expired`
- `payment_ref` (Mercantil transaction reference), `expires_at`, `checked_in_at`, `created_at`

The customer's phone/bank are not persisted; the Clave de Pago (OTP) is **never**
stored — it exists only in the request and the encrypted Mercantil payload.

### Capacity counting rule

A date's occupancy = sum of `adults + children` over reservations with status
`confirmed`, `checked_in`, or (`pending_payment` **and** `expires_at > now()`).
Failed/expired/abandoned reservations therefore release capacity automatically —
no cleanup job.

### `reserve_slots()` Postgres function

Solves the HU-04 double-booking race in one transaction:

1. Take a per-date advisory lock (`pg_advisory_xact_lock` keyed on the date).
2. Compute occupancy per the rule above; determine the date's limit
   (override if present, else `settings.daily_capacity`).
3. If `occupancy + requested > limit`, raise an error carrying the remaining count.
4. Else insert the reservation as `pending_payment` with `expires_at = now() + 10 min`
   and return its id/code.

Row Level Security: no public access to any table; the app uses the service role
from the server only; authenticated admin users get read/update via RLS policies.

## Customer Flow

**Step 1 — Booking form (HU-01).** shadcn calendar with past dates, closed days,
and fully-booked days disabled (availability fetched per visible month). Steppers
for Adults ($15) and Children ($5), minimum 1 adult, tap targets ≥ 44×44px. Live
USD total. Contact fields: first name, last name, email.

**Step 2 — ID & payment (HU-02).** Fields: ID type (V/E/P/J), ID number, phone
(Venezuelan format `04XX-XXXXXXX`), bank (dropdown of Venezuelan bank codes),
Clave de Pago (OTP). Shows USD total, BCV rate used, and the resulting VES total
before submission. Validation: zod + react-hook-form; the same zod schema
re-validates server-side.

**Step 3 — Payment Server Action (HU-03).**

1. Re-validate payload; call `reserve_slots()` — capacity locks at payment
   submission, so an abandoned form never holds slots.
2. Get BCV rate (see Rate Resilience); `total_ves = round(total_usd × rate, 2)`.
3. AES-256-CBC encrypt `destination_id`, `destination_mobile_number`,
   `twofactor_auth` with the Mercantil secret; POST to `v1/payment/pay`.
4. `approved` → status `confirmed`, store `payment_ref`, send voucher email.
   Failure → status `failed`, return a friendly error; user retries with a fresh
   OTP (C2P OTPs are single-use).

**Step 4 — Confirmation + voucher (HU-05).** Success screen shows full voucher
details (fallback if email fails). Email via Resend (react-email): name, DNI,
date, adults/children, totals USD & VES, reservation code, and a QR image
(hosted at `/api/qr/[id]`) that encodes the `/admin/checkin/[id]` URL.
Single-column, mobile-legible.

## Admin Flow

- **Auth:** Supabase Auth email+password; accounts created manually in the
  Supabase dashboard (no self-signup). Middleware guards `/admin/*`.
- **Reservations (`/admin`):** date picker (default today); summary of confirmed
  people vs capacity and check-in count; list with code, name, DNI, party size,
  status; text filter by name/code/DNI ("customer lost their email"); manual
  check-in button; resend-voucher action.
- **Settings (`/admin/settings`):** daily capacity, adult/child USD prices,
  per-date overrides (special capacity or closed).
- **QR check-in (`/admin/checkin/[id]`):** staff scans the emailed QR with a
  phone camera → page shows reservation details with a status banner — green
  "valid for today", yellow "wrong date", red "already checked in" — and one
  **Check in** button stamping `checked_in_at`. The already-checked-in state
  prevents voucher reuse.

## Error Handling

- **BCV rate:** no official BCV API exists; primary source is a public mirror
  (pydolarve / dolarapi "oficial" endpoint). Successful fetches are cached in
  `settings` and reused for 1 hour. On fetch failure, fall back to the cached
  rate if it is < 24h old; otherwise block booking with a "try again later"
  message rather than charging a stale price.
- **Mercantil timeout / ambiguous response:** reservation stays
  `pending_payment`; user sees "payment being verified"; the record surfaces in
  admin for manual confirmation against the bank statement. Never auto-retry a
  C2P charge (single-use OTP; double-charging is the worse failure).
- **Payment approved but email fails:** reservation remains `confirmed` (payment
  truth wins); confirmation screen shows full voucher details; admin can resend.
- **Capacity taken while paying:** impossible by design — slots lock in
  `reserve_slots()` before the charge.

## Testing

- **Unit:** zod schemas (phone/ID formats, attendee clamps), VES calculation and
  rounding, Mercantil AES-256-CBC encryption against known test vectors, BCV
  fallback logic.
- **Integration:** `reserve_slots()` under concurrent calls against a local
  Supabase instance — the race condition is the point of the test.
- **E2E (Playwright):** happy booking path and sold-out path with the Mercantil
  client mocked at the HTTP boundary; no real charges in tests.
- **Pre-launch:** one manual production smoke test with a real minimal payment.

## Out of Scope (v1)

- Customer accounts / booking history
- Refunds and cancellations
- Additional scheduled services beyond pool passes (the schema's `reservations`
  shape doesn't preclude them later)
- Offline PWA support
- QR-scanner UI inside the admin app (phone camera + URL is enough)
