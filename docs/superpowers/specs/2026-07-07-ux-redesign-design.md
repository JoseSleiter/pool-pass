# UX Redesign: Landing + Checkout + Admin Dashboard — Design Spec

**Date:** 2026-07-07
**Status:** Approved by user (brainstorming sections 1–5)
**Reference:** https://book.daypassapp.com/ (customer flow), classic sidebar dashboards (admin)
**Approach:** Restyle over the existing implementation — keep all business logic, server actions, payment flow, emails, and tests. Only presentation changes, plus one small functional change (child-only bookings).

## Goal

The current site is functional but visually poor. This redesign gives the customer side a marketing landing page with a dedicated booking flow, and the admin side a professional sidebar dashboard — all in a bright "resort" sky-blue theme ("Resort luminoso").

## Scope summary

| Area | Change |
|------|--------|
| `/` | Becomes a full landing page (new). Booking wizard moves out. |
| `/reservar` | New route hosting the existing booking wizard, restyled. |
| Admin | Sidebar shell layout, KPI row (incl. new revenue metric), restyled table. |
| Theme | Sky palette, pill buttons, rounded-2xl cards, in `globals.css` tokens. |
| Functional | Allow child-only bookings (adults ≥ 0, total people ≥ 1). |
| Unchanged | Payment flow, C2P client, BCV, emails/QR, reserve_slots, middleware, doc-type selector (V/E/J/P already exists), check-in page logic. |

---

## 1. Design tokens & theme

Defined in `src/app/globals.css` (Tailwind v4 `@theme` / shadcn CSS variables). No new libraries.

- **Primary:** sky — `#0ea5e9`, hover `#0284c7`, light bg `#f0f9ff` / `#e0f2fe`.
- **Surfaces:** page bg `#f8fafc`, cards white with `border-slate-200`, text `#0f172a`, muted `#64748b`.
- **Dark accent (sidebar/footer):** `#0c4a6e`, with `#bae6fd` / `#7dd3fc` for secondary text on it; active nav item `#0369a1`.
- **Status colors:** green `#dcfce7`/`#166534` (confirmed / checked-in), amber `#fef3c7`/`#92400e` (pending verification), red (failed / sold out).
- **Shape:** cards `rounded-2xl`, primary buttons `rounded-full` (pill) with soft sky shadow (`shadow-lg shadow-sky-500/30`). Headings font-weight 800. Keep existing Geist font.
- **Touch targets:** all interactive elements keep ≥ 44px min height (existing rule; calendar cells already use `[--cell-size:2.75rem]`).

## 2. Landing page (`/`)

New server component page replacing the current wizard-at-root. Mobile-first, sections top to bottom:

1. **Header** (sticky, white): 🌊 + club name; anchor links "Precios" y "Galería"; pill button **Reservar** → `/reservar`.
2. **Hero** (sky gradient `#7dd3fc → #0ea5e9`): live availability badge "☀️ Abierto hoy · quedan N cupos" (from `getAvailability` for today; if closed/sold out show "Agotado hoy — reserva otro día"); headline "Tu día de piscina, a un clic"; subtitle about Pago Móvil + QR; big white pill CTA "Reservar ahora →" → `/reservar`; price hint line under CTA (live prices).
3. **"Cómo funciona" strip** (light blue band): 4 steps — 📅 Elige fecha · 📲 Paga C2P · ✉️ Recibe tu QR · 🏊 Entra directo.
4. **Amenities** ("EL CLUB / Todo para tu día perfecto"): 2×3 grid of bordered cards with emoji + text.
5. **Pricing** cards: Adultos / Niños, amounts live from `getPublicPrices()` (settings), note "Bs. al cambio BCV".
6. **Gallery**: grid reading images from `/public/gallery/`; while empty, render sky-gradient placeholder tiles (as in mockup).
7. **Repeat CTA** card (gradient): "¿Listo para el sol? ☀️" + pill "Reservar mi pase".
8. **Footer** (dark `#0c4a6e`): club name, 📍 dirección + ⏰ horario, 💬 WhatsApp link (`wa.me`), 📷 Instagram, copyright.

**Editable content:** all landing copy (club name, amenities list, address, hours, WhatsApp number, Instagram handle) lives in a single typed constant file `src/lib/landing-content.ts` so the owner edits text without touching components. Placeholder values ship initially. Logo = 🌊 emoji until a real one exists.

**Data:** availability badge and pricing render server-side from existing actions (`getAvailability`, `getPublicPrices`); no new queries. Page can use `revalidate` or dynamic rendering — dynamic is fine (availability must be fresh).

## 3. Checkout (`/reservar`)

Move the existing `BookingWizard` from `/` to a new `src/app/reservar/page.tsx`. Same steps and logic (`details | payment | pending | done`), restyled:

- **Page chrome:** compact header with ← back link to `/` and club name.
- **Progress:** two-segment progress bar + label "Paso 1 de 2 · Fecha y asistentes" / "Paso 2 de 2 · Pago Móvil C2P" (replaces current stepper visuals; `pending`/`done` states hide the bar).
- **Step 1:** calendar card (existing behavior: sold-out dates struck through/disabled), attendee steppers as rounded cards showing unit price ("$15.00 c/u"), light-blue total summary row ("2 adultos, 1 niño — $35.00"), pill CTA "Continuar →".
- **Step 2:** blue gradient **summary card** at top: date + party + "editar" link (returns to step 1), USD total large + "Bs. X · tasa Y" (existing `vesInfo`). Form fields below (doc type V/E/J/P selector unchanged, phone, bank, C2P key with lock note "Genera la clave desde la app de tu banco. 🔒 No la guardamos."). Pay button shows the amount: **"Pagar $35.00"**.
- **Confirmation (`done`):** redesigned as a "boleto" (ticket) card — QR image rendered on-screen via existing `/api/qr/[id]` route, large code `PP-XXXXX`, reservation details, note that the voucher was emailed, and a WhatsApp contact button (from landing-content).
- **`pending` (payment in verification):** keeps its locked terminal screen, new skin (amber card).

**Redirect:** `/` no longer hosts the wizard; any old bookmarks to the wizard just land on the landing page (acceptable — no redirect needed).

## 4. Functional change: child-only bookings

Users may book passes for children only (e.g., 4 niños, 0 adultos).

- `src/lib/schemas.ts` — `bookingSchema`: `adults: min(1)` → `min(0)`, plus `.refine(adults + children >= 1, 'Debe incluir al menos una persona')`.
- **DB migration** `supabase/migrations/0002_allow_child_only.sql`: drop/recreate the reservations check constraint `adults >= 1` → `adults >= 0 AND (adults + children) >= 1`.
- `step-details.tsx`: Adultos stepper min 1 → 0; "Continuar" disabled while total people = 0.
- **Tests:** update schema tests and `step-details.test.tsx` ("does not allow adults below 1" → allows 0 adults when children ≥ 1; still blocks 0 total). Integration test: reserve with adults=0, children=2 succeeds.

## 5. Admin dashboard

**Layout — classic sidebar (option B),** applied via a shared `src/app/admin/layout.tsx` shell around existing pages:

- **Sidebar** (desktop, `#0c4a6e`): logo + "Panel de administración"; nav **Hoy** (`/admin`) and **Configuración** (`/admin/settings`) — the day view *is* the reservations list, so no separate "Reservas" item/route; bottom: logged-in email + "Cerrar sesión" (new visible logout — calls existing Supabase sign-out).
- **Mobile:** sidebar collapses to a dark top bar with ☰ menu (client component, simple slide-over).

**"Hoy" page (`/admin`)** restyled:

- Header: "Hoy · {fecha larga}" with quick nav ‹ ayer / mañana › + date picker (existing date selection logic), and open/closed badge with capacity (settings/overrides).
- **KPI row (4 cards):**
  1. **Ocupación** — `occupied/capacity` with progress bar (existing `adminGetDaySummary` data).
  2. **Ingresaron** — checked-in groups + total people inside.
  3. **Ingresos del día** *(new metric)* — sum of `total_usd` and `total_ves` over confirmed + checked_in reservations for the selected date, + count. Computed in `adminGetDaySummary` (extend its return type; data already in the rows it reads — no new query needed if it can aggregate from the reservations list; otherwise one aggregate select).
  4. **Pendientes** (amber) — count of `payment_pending` reservations for the day (surfaces manual-verification queue).
- **Reservations table** (cards on mobile, as today): código, nombre, **documento with type prefix (V-/E-/J-/P-)**, party as "2A 1N", USD amount, status chip (green "Ingresó HH:MM" via `caracasTime`, sky "Check-in" button, amber "Pago en verificación"). Search box kept. Resend-voucher ✉️ action kept.

**Other admin pages:** `settings` and `login` get the shell + theme, no logic changes. **Check-in page (`/admin/checkin/[id]`)** keeps its current banner-card design, inheriting the new theme only.

**Security invariant unchanged:** every admin server action still calls `requireAdmin()`; auth-gating tests stay green.

## 6. Testing impact

- **Unit (79) / integration (16):** unchanged except the child-only booking updates (§4) and `adminGetDaySummary` extended return (revenue + pending counts — extend its existing tests).
- **Component tests:** selectors/text assertions in `booking-wizard.test.tsx`, `step-details.test.tsx`, `step-payment.test.tsx`, `reservations-table.test.tsx` updated where copy/structure changes (e.g., "Pagar $35.00" button label, progress-bar labels).
- **E2E (`e2e/booking.spec.ts`):** starts at `/`, clicks "Reservar ahora", continues on `/reservar` with the existing calendar selectors. New light e2e: landing renders (hero, prices visible, CTA navigates to `/reservar`).
- **New unit tests:** landing-content shape; revenue aggregation in day summary; child-only schema cases.
- **Verification gate:** `tsc`, lint, full unit + integration + e2e suites, and `next build` all green (Node 20 via `nvm use 20`).

## Out of scope

- Real photos/logo/brand copy (placeholders + `landing-content.ts` for later editing).
- New admin routes or features beyond the KPI row and logout button.
- Middleware→proxy migration, PWA changes, payment wire-contract items (tracked in README deploy checklist).
