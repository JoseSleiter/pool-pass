# UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Pool Pass app per `docs/superpowers/specs/2026-07-07-ux-redesign-design.md`: sky "resort" theme, marketing landing at `/`, booking wizard moved to `/reservar` with ticket-style confirmation (QR on-screen **and** still emailed), child-only bookings, and an admin sidebar dashboard with a revenue KPI.

**Architecture:** Presentation-layer restyle over the existing Next.js App Router app. Business logic (payments, reserve_slots, emails, middleware) is untouched except: `bookingSchema` allows `adults: 0` (≥1 person total, with a DB constraint migration) and `adminGetDaySummary` returns extra aggregates. New landing components live in `src/components/landing/`; admin pages move into a `(dashboard)` route group wrapped by a sidebar shell.

**Tech Stack:** Next.js 16 App Router + Tailwind v4 + shadcn/ui (already installed — no new dependencies), Supabase, Vitest, Playwright.

---

## Environment notes (read first)

- **Node:** system default is Node 16 and breaks everything. EVERY shell command must run `nvm use 20` in the SAME invocation: `source ~/.nvm/nvm.sh && nvm use 20 && <command>`. All `Run:` lines below assume this prefix.
- **Test commands:** unit `npm test`, integration `npm run test:integration` (needs local Supabase running: `npx supabase start`), e2e `npm run test:e2e` (needs `.env.local` with `MERCANTIL_MOCK=1`; Playwright starts the dev server itself).
- **Existing tests are the safety net.** After every task, the full unit suite must pass. Never delete a test to make it pass — update assertions only where this plan changes labels/markup.
- The app is light-mode only; leave the `.dark` block in `globals.css` untouched.

## File map

| File | Change |
|------|--------|
| `src/app/globals.css` | Sky theme tokens (Task 1) |
| `src/lib/schemas.ts`, `src/lib/schemas.test.ts` | Child-only bookings (Task 2) |
| `supabase/migrations/0002_allow_child_only.sql`, `src/lib/db/reservations.integration.test.ts` | Constraint migration (Task 3) |
| `src/components/booking/step-details.tsx` + test | Adults min 0, guard, restyle (Tasks 4, 10) |
| `src/lib/party.ts` + test, `src/lib/landing-content.ts` + test, `src/lib/dates.ts` + test | Helpers/content (Task 5) |
| `src/app/reservar/page.tsx` | New checkout route (Task 6) |
| `src/app/page.tsx`, `src/components/landing/*`, `src/app/actions/booking.ts`, `public/gallery/` | Landing (Task 7) |
| `src/components/booking/booking-wizard.tsx` + test | Progress bar, pending skin, onEdit wiring (Task 8) |
| `src/components/booking/step-payment.tsx` + test | Summary card, "Pagar $X" (Task 9) |
| `src/components/booking/confirmation.tsx`, wizard test | Ticket + QR + WhatsApp (Task 11) |
| `src/app/admin/actions.ts` + test | Day summary aggregates (Task 12) |
| `src/app/admin/(dashboard)/layout.tsx`, `src/components/admin/admin-shell.tsx`, moved pages | Sidebar shell + logout (Task 13) |
| `src/components/admin/day-view.tsx`, `reservations-table.tsx` + tests | KPI row + table restyle (Task 14) |
| `src/app/admin/login/page.tsx`, `src/app/admin/settings/page.tsx` | Skin (Task 15) |
| `e2e/booking.spec.ts`, `e2e/landing.spec.ts` | E2E updates (Task 16) |

Note on the spec's admin nav: the spec listed a "Reservas" sidebar item pointing at the same `/admin` page. A duplicate link to the current page is noise — the shell has **Hoy** and **Configuración** only. This is an intentional, documented deviation.

---

### Task 1: Sky theme tokens

**Files:**
- Modify: `src/app/globals.css:51-84` (the `:root` block only)

- [ ] **Step 1: Replace the `:root` token values**

Replace the entire `:root { ... }` block (lines 51–84) with:

```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #0ea5e9;
  --primary-foreground: #ffffff;
  --secondary: #e0f2fe;
  --secondary-foreground: #0369a1;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f0f9ff;
  --accent-foreground: #0369a1;
  --destructive: #dc2626;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #38bdf8;
  --chart-1: #0ea5e9;
  --chart-2: #0369a1;
  --chart-3: #16a34a;
  --chart-4: #d97706;
  --chart-5: #64748b;
  --radius: 0.875rem;
  --sidebar: #0c4a6e;
  --sidebar-foreground: #bae6fd;
  --sidebar-primary: #0369a1;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #075985;
  --sidebar-accent-foreground: #e0f2fe;
  --sidebar-border: #075985;
  --sidebar-ring: #38bdf8;
}
```

Do not touch `@theme inline`, `.dark`, or `@layer base`.

- [ ] **Step 2: Verify nothing broke**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: all unit tests PASS (tokens are pure CSS; no test asserts colors).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): sky resort theme tokens"
```

---

### Task 2: Child-only bookings — schema

**Files:**
- Modify: `src/lib/schemas.ts`
- Test: `src/lib/schemas.test.ts`

- [ ] **Step 1: Update the schema tests**

In `src/lib/schemas.test.ts`, replace the `it('requires at least 1 adult', ...)` test with:

```ts
  it('accepts a child-only booking (0 adults, 1+ children)', () => {
    expect(bookingSchema.safeParse({ ...validBooking, adults: 0, children: 2 }).success).toBe(true);
  });
  it('rejects a booking with nobody attending', () => {
    expect(bookingSchema.safeParse({ ...validBooking, adults: 0, children: 0 }).success).toBe(false);
  });
  it('paymentSchema also rejects a booking with nobody attending', () => {
    expect(paymentSchema.safeParse({ ...validPayment, adults: 0, children: 0 }).success).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/lib/schemas.test.ts`
Expected: FAIL — child-only booking rejected by `min(1)`.

- [ ] **Step 3: Implement**

Replace `src/lib/schemas.ts` contents with (note: the refine lives on a shared base so `paymentSchema.extend` still works, and both schemas enforce ≥1 person):

```ts
import { z } from 'zod';

const bookingBase = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  adults: z.number().int().min(0).max(20),
  children: z.number().int().min(0).max(20),
  firstName: z.string().trim().min(1, 'Requerido').max(60),
  lastName: z.string().trim().min(1, 'Requerido').max(60),
  email: z.email('Correo inválido'),
});

const hasAttendee = { // pases solo para niños están permitidos; solo se exige ≥1 persona
  check: (b: { adults: number; children: number }) => b.adults + b.children >= 1,
  opts: { message: 'Debe incluir al menos una persona', path: ['adults'] as const },
};

export const bookingSchema = bookingBase.refine(hasAttendee.check, hasAttendee.opts);

// Venezuelan mobile: 0412/0414/0416/0422/0424/0426 + 7 digits
const VE_PHONE = /^04(12|14|16|22|24|26)\d{7}$/;

export const paymentSchema = bookingBase.extend({
  idType: z.enum(['V', 'E', 'P', 'J']),
  idNumber: z.string().regex(/^\d{5,10}$/, 'Solo dígitos (5–10)'),
  phone: z.string().regex(VE_PHONE, 'Teléfono venezolano inválido (04XX...)'),
  bankCode: z.string().regex(/^\d{4}$/, 'Banco requerido'),
  otp: z.string().min(4, 'Clave requerida').max(12),
}).refine(hasAttendee.check, hasAttendee.opts);

export type BookingInput = z.infer<typeof bookingSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
```

- [ ] **Step 4: Run the full unit suite**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: PASS. (If `booking-wizard.test.tsx` or `process.test.ts` fixtures fail, they use adults ≥ 1 already — investigate before changing anything.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(booking): allow child-only bookings in schema (>=1 person total)"
```

---

### Task 3: Child-only bookings — DB migration

**Files:**
- Create: `supabase/migrations/0002_allow_child_only.sql`
- Test: `src/lib/db/reservations.integration.test.ts`

- [ ] **Step 1: Add a failing integration test**

In `src/lib/db/reservations.integration.test.ts`, inside the existing describe block for `reserveSlots` (match the file's existing fixture pattern — read it first; reuse its date/cleanup helpers), add:

```ts
  it('accepts a child-only reservation (0 adults, 2 children)', async () => {
    const res = await reserveSlots({
      date: TEST_DATE, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
      idType: 'V', idNumber: '12345678', adults: 0, children: 2, totalUsd: 10,
    });
    expect(res.ok).toBe(true);
  });
```

(Adapt `TEST_DATE` and the input shape to whatever the surrounding tests use — the only required specifics are `adults: 0, children: 2` and `res.ok === true`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run test:integration -- src/lib/db/reservations.integration.test.ts`
Expected: FAIL with a check-constraint violation (`reservations_adults_check`).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0002_allow_child_only.sql`:

```sql
-- Child-only bookings: adults may be 0, but every reservation needs >= 1 person.
alter table public.reservations drop constraint reservations_adults_check;
alter table public.reservations add constraint reservations_adults_check check (adults >= 0);
alter table public.reservations add constraint reservations_party_check check (adults + children >= 1);
```

- [ ] **Step 4: Apply the migration locally**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx supabase migration up`
Expected: `Applying migration 0002_allow_child_only.sql...` — do NOT use `db reset` (it wipes the local admin auth user).

- [ ] **Step 5: Run the integration tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run test:integration`
Expected: all PASS, including the new child-only test.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_allow_child_only.sql src/lib/db/reservations.integration.test.ts
git commit -m "feat(db): allow child-only reservations (adults >= 0, party >= 1)"
```

---

### Task 4: Child-only bookings — UI stepper

**Files:**
- Modify: `src/components/booking/step-details.tsx:76,114-116`
- Test: `src/components/booking/step-details.test.tsx`

- [ ] **Step 1: Update the component tests**

In `src/components/booking/step-details.test.tsx`, replace the `it('does not allow adults below 1', ...)` test with (match the file's existing render/userEvent setup):

```ts
  it('allows decreasing adults to 0', async () => {
    // starts at adults: 1 → one click on "Disminuir adultos" reaches 0
    await user.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    expect(screen.getByTestId('adults-count')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    expect(screen.getByTestId('adults-count')).toHaveTextContent('0'); // floor is 0
  });

  it('disables Continuar when nobody is attending', async () => {
    await user.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/components/booking/step-details.test.tsx`
Expected: FAIL — stepper min is 1 and button never disables.

- [ ] **Step 3: Implement**

In `step-details.tsx`: change the Adultos stepper to `min={0}` and disable the submit button when the party is empty:

```tsx
          <Stepper
            label="Adultos" priceUsd={props.prices.adult} value={data.adults} min={0}
            onChange={(v) => setData({ ...data, adults: v })} testId="adults-count"
          />
```

```tsx
      <Button type="button" className="h-12 w-full text-base" disabled={data.adults + data.children === 0} onClick={submit}>
        Continuar
      </Button>
```

- [ ] **Step 4: Run the full unit suite**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/step-details.tsx src/components/booking/step-details.test.tsx
git commit -m "feat(booking): allow 0 adults in stepper, block empty parties"
```

---

### Task 5: Helpers — party labels, landing content, date formatting

**Files:**
- Create: `src/lib/party.ts`, `src/lib/party.test.ts`
- Create: `src/lib/landing-content.ts`, `src/lib/landing-content.test.ts`
- Modify: `src/lib/dates.ts` (append two functions)
- Create: `src/lib/dates.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/party.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { partyLabel, partyShort } from './party';

describe('partyLabel', () => {
  it('formats adults and children', () => {
    expect(partyLabel(2, 1)).toBe('2 adultos, 1 niño');
  });
  it('uses singular forms', () => {
    expect(partyLabel(1, 2)).toBe('1 adulto, 2 niños');
  });
  it('omits zero groups (child-only)', () => {
    expect(partyLabel(0, 3)).toBe('3 niños');
    expect(partyLabel(2, 0)).toBe('2 adultos');
  });
});

describe('partyShort', () => {
  it('formats compact admin labels', () => {
    expect(partyShort(2, 1)).toBe('2A 1N');
    expect(partyShort(0, 4)).toBe('4N');
    expect(partyShort(2, 0)).toBe('2A');
  });
});
```

`src/lib/landing-content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { landingContent, whatsappUrl } from './landing-content';

describe('landing content', () => {
  it('has six amenities and four steps', () => {
    expect(landingContent.amenities).toHaveLength(6);
    expect(landingContent.steps).toHaveLength(4);
  });
  it('builds a digits-only wa.me link', () => {
    expect(whatsappUrl()).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });
});
```

`src/lib/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shortDateEs, longDateEs } from './dates';

describe('spanish date formatting (Caracas)', () => {
  it('shortDateEs renders weekday + day + month', () => {
    // 2030-01-15 is a Tuesday
    expect(shortDateEs('2030-01-15').toLowerCase()).toContain('mar');
    expect(shortDateEs('2030-01-15')).toContain('15');
  });
  it('longDateEs spells out the month', () => {
    const s = longDateEs('2030-01-15').toLowerCase();
    expect(s).toContain('martes');
    expect(s).toContain('enero');
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/lib/party.test.ts src/lib/landing-content.test.ts src/lib/dates.test.ts`
Expected: FAIL — modules/functions don't exist.

- [ ] **Step 3: Implement**

`src/lib/party.ts`:

```ts
/** "2 adultos, 1 niño" — omits zero groups; child-only bookings are valid. */
export function partyLabel(adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} ${adults === 1 ? 'adulto' : 'adultos'}`);
  if (children > 0) parts.push(`${children} ${children === 1 ? 'niño' : 'niños'}`);
  return parts.join(', ');
}

/** Compact admin form: "2A 1N". */
export function partyShort(adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults}A`);
  if (children > 0) parts.push(`${children}N`);
  return parts.join(' ');
}
```

`src/lib/landing-content.ts` — the single file the club owner edits; placeholder values ship initially:

```ts
export const landingContent = {
  clubName: 'Club La Piscina',
  tagline: 'Tu día de piscina, a un clic',
  subtitle: 'Reserva online, paga con Pago Móvil y entra con tu QR. Sin colas, sin efectivo.',
  steps: [
    { icon: '📅', text: 'Elige fecha' },
    { icon: '📲', text: 'Paga C2P' },
    { icon: '✉️', text: 'Recibe tu QR' },
    { icon: '🏊', text: 'Entra directo' },
  ],
  amenities: [
    { icon: '🏊', text: 'Piscina para adultos y niños' },
    { icon: '🛡️', text: 'Salvavidas certificados' },
    { icon: '🍔', text: 'Comida y bebidas' },
    { icon: '🅿️', text: 'Estacionamiento gratis' },
    { icon: '🪑', text: 'Toldos y tumbonas' },
    { icon: '🚿', text: 'Duchas y vestuarios' },
  ],
  address: 'Av. Principal, Caracas',
  hours: 'Mar–Dom · 9:00 am – 6:00 pm',
  whatsapp: '+58 412 000 0000',
  instagram: 'clublapiscina',
} as const;

export function whatsappUrl(): string {
  return `https://wa.me/${landingContent.whatsapp.replace(/\D/g, '')}`;
}
```

Append to `src/lib/dates.ts` (Venezuela is fixed UTC-4, no DST — pin the offset so the label never shifts with the server clock):

```ts
/** "mar, 15 ene" — short Spanish date for summary cards. */
export function shortDateEs(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${date}T12:00:00-04:00`));
}

/** "martes, 15 de enero" — long Spanish date for the admin day header. */
export function longDateEs(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00-04:00`));
}
```

- [ ] **Step 4: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/party.ts src/lib/party.test.ts src/lib/landing-content.ts src/lib/landing-content.test.ts src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: party/date helpers and editable landing content"
```

---

### Task 6: `/reservar` route

**Files:**
- Create: `src/app/reservar/page.tsx`

The wizard moves here; `/` still hosts the old wizard until Task 7 replaces it (both routes work in between, so the app is never broken).

- [ ] **Step 1: Create the page**

`src/app/reservar/page.tsx`:

```tsx
import Link from 'next/link';
import { BookingWizard } from '@/components/booking/booking-wizard';
import { getPublicPrices, getAvailability } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { landingContent } from '@/lib/landing-content';

export const dynamic = 'force-dynamic';

export default async function ReservarPage() {
  // Anchor "current month" to Venezuela's clock, not the server's (UTC rolls over ~4h early).
  const month = todayCaracas().slice(0, 7);
  const [prices, availability] = await Promise.all([
    getPublicPrices(),
    getAvailability(month),
  ]);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="Volver al inicio" className="font-bold text-sky-600">←</Link>
          <h1 className="font-extrabold">Reservar</h1>
          <span className="ml-auto text-xs text-muted-foreground">🌊 {landingContent.clubName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">
        <BookingWizard prices={prices} initialAvailability={availability} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit && npm run build`
Expected: build succeeds, `/reservar` listed in the route table.

- [ ] **Step 3: Commit**

```bash
git add src/app/reservar/page.tsx
git commit -m "feat(booking): dedicated /reservar checkout route"
```

---

### Task 7: Landing page at `/`

**Files:**
- Modify: `src/app/actions/booking.ts` (add `getTodayRemaining`)
- Create: `src/components/landing/site-header.tsx`, `src/components/landing/hero.tsx`, `src/components/landing/sections.tsx`, `src/components/landing/site-footer.tsx`
- Rewrite: `src/app/page.tsx`
- Create: `public/gallery/.gitkeep`
- Modify: `e2e/booking.spec.ts` (three `page.goto('/')` → `page.goto('/reservar')` so e2e keeps working; Task 16 finishes the e2e story)

- [ ] **Step 1: Add the availability action**

Append to `src/app/actions/booking.ts` (add `todayCaracas` to imports: `import { todayCaracas } from '@/lib/dates';`):

```ts
/** Remaining slots for today (Caracas). Absent key in monthAvailability = default capacity free. */
export async function getTodayRemaining(): Promise<number> {
  const today = todayCaracas();
  const avail = await monthAvailability(today.slice(0, 7));
  if (avail[today] !== undefined) return avail[today];
  const s = await getSettings();
  return s.daily_capacity;
}
```

- [ ] **Step 2: Create the landing components**

`src/components/landing/site-header.tsx`:

```tsx
import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link href="/" className="font-extrabold text-sky-700">🌊 {landingContent.clubName}</Link>
        <nav className="flex items-center gap-4 text-sm text-slate-500">
          <a href="#precios" className="hidden sm:inline hover:text-sky-600">Precios</a>
          <a href="#galeria" className="hidden sm:inline hover:text-sky-600">Galería</a>
          <Link href="/reservar" className="rounded-full bg-sky-500 px-4 py-1.5 font-semibold text-white hover:bg-sky-600">
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

`src/components/landing/hero.tsx`:

```tsx
import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

export function Hero(props: { remaining: number; prices: { adult: number; child: number } }) {
  const open = props.remaining > 0;
  return (
    <section className="bg-gradient-to-br from-sky-300 via-sky-400 to-sky-600 px-5 pb-14 pt-10 text-white">
      <div className="mx-auto max-w-3xl">
        <span className="inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-medium">
          {open ? `☀️ Abierto hoy · quedan ${props.remaining} cupos` : '⛱️ Agotado hoy — reserva otro día'}
        </span>
        <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight sm:text-5xl">
          {landingContent.tagline}
        </h1>
        <p className="mt-3 max-w-md text-sky-100">{landingContent.subtitle}</p>
        <Link
          href="/reservar"
          className="mt-6 block rounded-full bg-white py-3.5 text-center text-base font-extrabold text-sky-600 shadow-lg shadow-sky-800/30 sm:max-w-xs"
        >
          Reservar ahora →
        </Link>
        <p className="mt-3 text-center text-xs text-sky-100 sm:max-w-xs">
          Adultos ${props.prices.adult.toFixed(2)} · Niños ${props.prices.child.toFixed(2)} · tasa BCV del día
        </p>
      </div>
    </section>
  );
}
```

`src/components/landing/sections.tsx` (server component — uses `fs` for the gallery):

```tsx
import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

export function HowItWorks() {
  return (
    <section className="bg-sky-50 px-5 py-5">
      <div className="mx-auto flex max-w-3xl gap-2 text-center text-xs text-sky-900">
        {landingContent.steps.map((s, i) => (
          <div key={s.text} className="flex-1">
            <div className="text-xl">{s.icon}</div>
            <p><b>{i + 1}.</b> {s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Amenities() {
  return (
    <section className="px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-500">El club</p>
        <h2 className="mt-1 text-2xl font-extrabold">Todo para tu día perfecto</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {landingContent.amenities.map((a) => (
            <div key={a.text} className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-xl">{a.icon}</span>
              <p className="mt-1 text-slate-700">{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing(props: { prices: { adult: number; child: number } }) {
  return (
    <section id="precios" className="px-5 pb-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-500">Precios</p>
        <div className="mt-4 flex gap-4">
          <div className="flex-1 rounded-2xl border-2 border-sky-500 bg-sky-50 p-5 text-center">
            <p className="text-xs font-bold uppercase text-sky-700">Adultos</p>
            <p className="text-4xl font-black">${props.prices.adult.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">por persona · Bs. al cambio BCV</p>
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-xs font-bold uppercase text-sky-700">Niños</p>
            <p className="text-4xl font-black">${props.prices.child.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">por niño · Bs. al cambio BCV</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function galleryImages(): string[] {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), 'public', 'gallery'))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .slice(0, 6)
      .map((f) => `/gallery/${f}`);
  } catch {
    return [];
  }
}

const PLACEHOLDER_GRADIENTS = [
  'from-sky-400 to-sky-700',
  'from-sky-300 to-sky-500',
  'from-sky-200 to-sky-400',
];

export function Gallery() {
  const images = galleryImages();
  return (
    <section id="galeria" className="px-5 pb-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-500">Galería</p>
        <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
          {images.length > 0
            ? images.map((src, i) => (
                <div key={src} className={`relative overflow-hidden rounded-2xl ${i === 0 ? 'row-span-2 h-48 sm:h-64' : 'h-[5.75rem] sm:h-[7.75rem]'}`}>
                  <Image src={src} alt="Foto del club" fill className="object-cover" />
                </div>
              ))
            : PLACEHOLDER_GRADIENTS.map((g, i) => (
                <div key={g} className={`rounded-2xl bg-gradient-to-br ${g} ${i === 0 ? 'row-span-2 h-48 sm:h-64' : 'h-[5.75rem] sm:h-[7.75rem]'}`} />
              ))}
        </div>
      </div>
    </section>
  );
}

export function RepeatCta() {
  return (
    <section className="px-5 pb-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-sky-500 to-sky-800 p-8 text-center text-white">
        <p className="text-xl font-extrabold">¿Listo para el sol? ☀️</p>
        <Link
          href="/reservar"
          className="mx-auto mt-4 block max-w-xs rounded-full bg-white py-3 font-extrabold text-sky-600"
        >
          Reservar mi pase
        </Link>
      </div>
    </section>
  );
}
```

`src/components/landing/site-footer.tsx`:

```tsx
import { landingContent, whatsappUrl } from '@/lib/landing-content';

export function SiteFooter() {
  return (
    <footer className="bg-[#0c4a6e] px-5 py-8 text-sm text-sky-200">
      <div className="mx-auto max-w-3xl space-y-2">
        <p className="font-extrabold text-white">🌊 {landingContent.clubName}</p>
        <p>📍 {landingContent.address} · ⏰ {landingContent.hours}</p>
        <p>
          💬 <a href={whatsappUrl()} className="underline">WhatsApp {landingContent.whatsapp}</a>
          {' · '}
          📷 <a href={`https://instagram.com/${landingContent.instagram}`} className="underline">@{landingContent.instagram}</a>
        </p>
        <p className="pt-2 text-xs text-sky-400">© {new Date().getFullYear()} {landingContent.clubName}</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Replace `src/app/page.tsx`**

```tsx
import { getPublicPrices, getTodayRemaining } from '@/app/actions/booking';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { HowItWorks, Amenities, Pricing, Gallery, RepeatCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [prices, remaining] = await Promise.all([getPublicPrices(), getTodayRemaining()]);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero remaining={remaining} prices={prices} />
        <HowItWorks />
        <Amenities />
        <Pricing prices={prices} />
        <Gallery />
        <RepeatCta />
      </main>
      <SiteFooter />
    </>
  );
}
```

Also create the empty gallery dir: `mkdir -p public/gallery && touch public/gallery/.gitkeep`

- [ ] **Step 4: Keep e2e green in the interim**

In `e2e/booking.spec.ts`, change the three `await page.goto('/');` lines to `await page.goto('/reservar');` (Task 16 replaces this with the landing click-through).

- [ ] **Step 5: Verify**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit && npm test && npm run build`
Expected: PASS; route table shows `/` and `/reservar`.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/actions/booking.ts src/components/landing public/gallery/.gitkeep e2e/booking.spec.ts
git commit -m "feat(landing): marketing landing page at / with live availability and prices"
```

---

### Task 8: Wizard chrome — progress bar, pending skin, onEdit wiring

**Files:**
- Modify: `src/components/booking/booking-wizard.tsx`
- Test: `src/components/booking/booking-wizard.test.tsx`

- [ ] **Step 1: Add failing test**

In `booking-wizard.test.tsx` (reuse the file's existing render helpers/mocks), add:

```ts
  it('shows the step progress label', () => {
    // freshly rendered wizard starts at step 1
    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/components/booking/booking-wizard.test.tsx`
Expected: FAIL — label doesn't exist.

- [ ] **Step 3: Implement**

In `booking-wizard.tsx`:

a) Add a small progress header component at the bottom of the file:

```tsx
function Progress(props: { step: 1 | 2 }) {
  const label = props.step === 1 ? 'Paso 1 de 2 · Fecha y asistentes' : 'Paso 2 de 2 · Pago Móvil C2P';
  return (
    <div className="mb-4">
      <div className="flex gap-1.5" aria-hidden>
        <div className="h-1 flex-1 rounded-full bg-sky-500" />
        <div className={`h-1 flex-1 rounded-full ${props.step === 2 ? 'bg-sky-500' : 'bg-slate-200'}`} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
```

b) Restyle the `pending` branch (amber terminal card — the form MUST stay locked, do not add any button that returns to the form):

```tsx
  if (step === 'pending') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <div className="text-5xl">⏳</div>
        <h2 className="mt-2 text-xl font-extrabold text-amber-900">Pago en verificación</h2>
        {pendingMessage && <p className="mt-2 text-amber-800">{pendingMessage}</p>}
        <p className="mt-2 text-amber-800">
          Te contactaremos con la confirmación. No intentes pagar de nuevo.
        </p>
      </div>
    );
  }
```

c) Wrap the `payment` branch with the progress header and pass `onEdit` (prop added to StepPayment in Task 9 — implement both `Progress` usage and the prop pass-through here, they land together with Task 9's StepPayment change; if doing tasks strictly in order, add `onEdit` in this task and have StepPayment accept it in Task 9 by typing it now as an optional prop is NOT allowed — instead do it simply: this task only adds `<Progress step={2} />`, Task 9 adds `onEdit`):

```tsx
  if (step === 'payment') {
    const usd = totalUsd(booking.adults, booking.children, props.prices);
    return (
      <>
        <Progress step={2} />
        <StepPayment
          booking={booking}
          totalUsd={usd}
          vesInfo={rate !== null ? { rate, totalVes: usdToVes(usd, rate) } : null}
          onSubmit={handlePay}
          submitting={submitting}
          error={error}
        />
      </>
    );
  }
```

d) Wrap the details branch:

```tsx
  return (
    <>
      <Progress step={1} />
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <StepDetails
        ...unchanged props...
      />
    </>
  );
```

- [ ] **Step 4: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test`
Expected: PASS (fix any wizard-test assertion that referenced the old pending markup text — the visible strings are unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/booking-wizard.tsx src/components/booking/booking-wizard.test.tsx
git commit -m "feat(booking): step progress bar and amber pending state"
```

---

### Task 9: Step payment — gradient summary card, editar link, "Pagar $X"

**Files:**
- Modify: `src/components/booking/step-payment.tsx`
- Modify: `src/components/booking/booking-wizard.tsx` (pass `onEdit`)
- Test: `src/components/booking/step-payment.test.tsx`

- [ ] **Step 1: Add failing tests**

In `step-payment.test.tsx` (reuse existing render setup; add `onEdit: vi.fn()` to the default props object used by the renders):

```ts
  it('shows the amount on the pay button', () => {
    // render with totalUsd: 35
    expect(screen.getByRole('button', { name: /pagar \$35\.00/i })).toBeInTheDocument();
  });

  it('editar returns to the details step', async () => {
    const onEdit = vi.fn();
    // render with onEdit
    await user.click(screen.getByRole('button', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/components/booking/step-payment.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `step-payment.tsx`:

a) New imports: `import { partyLabel } from '@/lib/party';` and `import { shortDateEs } from '@/lib/dates';`

b) Add `onEdit: () => void;` to the props type.

c) Replace the current `rounded-lg bg-muted` summary block with:

```tsx
      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 p-4 text-white">
        <div className="flex items-center justify-between text-xs text-sky-100">
          <span>{shortDateEs(props.booking.date)} · {partyLabel(props.booking.adults, props.booking.children)}</span>
          <button type="button" onClick={props.onEdit} className="underline underline-offset-2">editar</button>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span data-testid="pay-total-usd" className="text-2xl font-extrabold">${props.totalUsd.toFixed(2)}</span>
          {props.vesInfo && (
            <span className="text-sm text-sky-100">
              Bs. {props.vesInfo.totalVes.toFixed(2)} · tasa {props.vesInfo.rate.toFixed(2)}
            </span>
          )}
        </div>
      </div>
```

d) Restyle the pay button (pill, amount visible):

```tsx
      <Button type="button" className="h-12 w-full rounded-full text-base font-bold" disabled={props.submitting} onClick={submit}>
        {props.submitting ? 'Procesando…' : `Pagar $${props.totalUsd.toFixed(2)}`}
      </Button>
```

e) In `booking-wizard.tsx` payment branch, add `onEdit={() => { setError(null); setStep('details'); }}` to `<StepPayment ... />`.

- [ ] **Step 4: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: PASS. Fix any existing step-payment test that asserted the old bare "Pagar" name — the regex `/pagar/i` still matches; exact-name queries need the amount.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/step-payment.tsx src/components/booking/step-payment.test.tsx src/components/booking/booking-wizard.tsx
git commit -m "feat(booking): payment summary card with editar and amount on pay button"
```

---

### Task 10: Step details restyle

**Files:**
- Modify: `src/components/booking/step-details.tsx`
- Test: `src/components/booking/step-details.test.tsx` (existing tests keep passing; no new tests — pure restyle)

- [ ] **Step 1: Restyle**

In `step-details.tsx`:

a) Import `partyLabel`: `import { partyLabel } from '@/lib/party';`

b) Replace the total block (`rounded-lg bg-muted p-4`) with a party-aware summary row:

```tsx
      <div className="flex items-center justify-between rounded-2xl bg-sky-50 p-4">
        <span className="text-sm text-sky-800">{partyLabel(data.adults, data.children) || 'Elige asistentes'}</span>
        <span data-testid="total-usd" className="text-2xl font-extrabold">${usd.toFixed(2)}</span>
      </div>
```

c) Pill CTA:

```tsx
      <Button type="button" className="h-12 w-full rounded-full text-base font-bold shadow-lg shadow-sky-500/25" disabled={data.adults + data.children === 0} onClick={submit}>
        Continuar →
      </Button>
```

(The `disabled` guard already exists from Task 4 — keep it.)

- [ ] **Step 2: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test`
Expected: PASS — `/continuar/i` queries still match "Continuar →".

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/step-details.tsx src/components/booking/step-details.test.tsx
git commit -m "feat(booking): restyled details step with party summary"
```

---

### Task 11: Confirmation as ticket — QR on screen + WhatsApp

The voucher email is UNCHANGED and still sent by `processBooking`; this screen additionally shows the same QR so the guest sees their purchase immediately.

**Files:**
- Modify: `src/components/booking/confirmation.tsx`
- Test: `src/components/booking/booking-wizard.test.tsx` (confirmation renders through the wizard) — if there is a dedicated confirmation test, update it instead.

- [ ] **Step 1: Add failing test**

In the test that reaches the confirmation screen (wizard happy-path test), add after the existing code assertion:

```ts
    expect(screen.getByAltText(/código qr/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
```

If the mocked `submitBookingAndPay` result's `reservation` object lacks `id`, add `id: '6f9619ff-8b86-d011-b42d-00c04fc964ff'` to the mock.

- [ ] **Step 2: Run to verify failure**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/components/booking/booking-wizard.test.tsx`
Expected: FAIL — no QR image, no WhatsApp link.

- [ ] **Step 3: Implement**

Replace `src/components/booking/confirmation.tsx` with:

```tsx
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { whatsappUrl } from '@/lib/landing-content';
import { partyLabel } from '@/lib/party';
import { shortDateEs } from '@/lib/dates';
import type { BookingInput } from '@/lib/schemas';

export function Confirmation(props: {
  booking: BookingInput;
  reservation: { id: string; code: string; totalUsd: number; totalVes: number; bcvRate: number };
  idLabel: string; // e.g. "V-12345678"
}) {
  const r = props.reservation;
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-extrabold">¡Reserva confirmada! 🎉</h2>
      <p className="text-muted-foreground">
        Tu pase también llegó a <strong>{props.booking.email}</strong>.
        Muestra este QR (o el del correo) en la entrada junto a tu documento.
      </p>
      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="bg-gradient-to-br from-sky-500 to-sky-700 p-4 text-white">
          <p className="text-xs uppercase tracking-widest text-sky-200">Pase del día</p>
          <p data-testid="reservation-code" className="text-3xl font-black tracking-wider">{r.code}</p>
        </div>
        <CardContent className="space-y-3 p-4">
          <Image
            unoptimized
            src={`/api/qr/${r.id}`}
            alt="Código QR de tu pase"
            width={176}
            height={176}
            className="mx-auto"
          />
          <div className="space-y-1 text-left text-sm">
            <p><strong>Nombre:</strong> {props.booking.firstName} {props.booking.lastName}</p>
            <p><strong>Documento:</strong> {props.idLabel}</p>
            <p><strong>Fecha:</strong> {shortDateEs(props.booking.date)}</p>
            <p><strong>Asistentes:</strong> {partyLabel(props.booking.adults, props.booking.children)}</p>
            <p><strong>Pagado:</strong> ${r.totalUsd.toFixed(2)} / Bs. {r.totalVes.toFixed(2)} (tasa {r.bcvRate.toFixed(2)})</p>
          </div>
        </CardContent>
      </Card>
      <a
        href={whatsappUrl()}
        className="inline-block rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-700"
      >
        💬 ¿Dudas? Escríbenos por WhatsApp
      </a>
    </div>
  );
}
```

(`reservation.id` already flows through: `BookingResult`'s ok-variant includes `id` — see `src/lib/booking/process.ts:28`.)

- [ ] **Step 4: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: PASS. Update any assertion on the old "Reserva confirmada" heading if it used exact casing (new heading still matches `/reserva confirmada/i`).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/confirmation.tsx src/components/booking/booking-wizard.test.tsx
git commit -m "feat(booking): ticket-style confirmation with on-screen QR and WhatsApp link"
```

---

### Task 12: Admin day summary — revenue + pending aggregates

**Files:**
- Modify: `src/app/admin/actions.ts:26-36`
- Test: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Add failing test**

In `actions.test.ts`, add a new describe block (the file already mocks `@/lib/db/reservations` and `ssrClient` — reuse `mockUser`):

```ts
describe('adminGetDaySummary aggregates (authorized user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1' };
  });

  it('computes occupancy, revenue and pending counts from the day rows', async () => {
    const row = (over: Record<string, unknown>) => ({
      id: 'x', code: 'PP-00000', date: '2030-01-15', first_name: 'A', last_name: 'B',
      email: 'a@b.c', id_type: 'V', id_number: '1', adults: 2, children: 1,
      total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
      payment_ref: null, expires_at: null, checked_in_at: null, created_at: '', ...over,
    });
    vi.mocked(listReservationsByDate).mockResolvedValue([
      row({ status: 'confirmed' }),
      row({ status: 'checked_in', adults: 1, children: 0, total_usd: 15, total_ves: 547.5 }),
      row({ status: 'pending_payment' }),
      row({ status: 'failed' }),
    ] as never);
    vi.mocked(getSettings).mockResolvedValue({
      daily_capacity: 100, adult_price_usd: 15, child_price_usd: 5,
      last_bcv_rate: null, last_bcv_rate_at: null,
    } as never);

    const s = await adminGetDaySummary('2030-01-15');
    expect(s).toEqual({
      capacity: 100,
      confirmedPeople: 4,      // 3 (confirmed) + 1 (checked_in); pending/failed excluded
      checkedInParties: 1,
      checkedInPeople: 1,
      revenueUsd: 50,          // 35 + 15
      revenueVes: 1825,        // 1277.5 + 547.5
      paidCount: 2,
      pendingCount: 1,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — new fields missing.

- [ ] **Step 3: Implement**

Replace `adminGetDaySummary` in `src/app/admin/actions.ts`:

```ts
export interface DaySummary {
  capacity: number;
  confirmedPeople: number;
  checkedInParties: number;
  checkedInPeople: number;
  revenueUsd: number;
  revenueVes: number;
  paidCount: number;
  pendingCount: number;
}

export async function adminGetDaySummary(date: string): Promise<DaySummary> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  const [rows, settings] = await Promise.all([listReservationsByDate(date), getSettings()]);
  const paid = rows.filter((r) => ['confirmed', 'checked_in'].includes(r.status));
  const checkedIn = rows.filter((r) => r.status === 'checked_in');
  return {
    capacity: settings.daily_capacity,
    confirmedPeople: paid.reduce((s, r) => s + r.adults + r.children, 0),
    checkedInParties: checkedIn.length,
    checkedInPeople: checkedIn.reduce((s, r) => s + r.adults + r.children, 0),
    revenueUsd: paid.reduce((s, r) => s + Number(r.total_usd), 0),
    revenueVes: paid.reduce((s, r) => s + Number(r.total_ves ?? 0), 0),
    paidCount: paid.length,
    pendingCount: rows.filter((r) => r.status === 'pending_payment').length,
  };
}
```

Note: Next.js `'use server'` files may only export async functions — if the build complains about the `DaySummary` interface export, move it to `src/lib/db/reservations.ts` and import the type. Interface/type exports are erased at compile time and are normally fine.

- [ ] **Step 4: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: PASS (auth-gating tests must remain green — `requireAdmin()` stays the first call).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "feat(admin): day summary with revenue and pending-verification counts"
```

---

### Task 13: Admin shell — sidebar layout + logout

**Files:**
- Move: `src/app/admin/page.tsx` → `src/app/admin/(dashboard)/page.tsx`
- Move: `src/app/admin/settings/page.tsx` → `src/app/admin/(dashboard)/settings/page.tsx`
- Create: `src/app/admin/(dashboard)/layout.tsx`
- Create: `src/components/admin/admin-shell.tsx`

Route groups don't change URLs — `/admin` and `/admin/settings` keep working, middleware guards keep matching, and `login`/`checkin` stay OUTSIDE the shell on purpose (login has no session; checkin keeps its focused card).

- [ ] **Step 1: Move the pages**

```bash
mkdir -p "src/app/admin/(dashboard)/settings"
git mv src/app/admin/page.tsx "src/app/admin/(dashboard)/page.tsx"
git mv src/app/admin/settings/page.tsx "src/app/admin/(dashboard)/settings/page.tsx"
rmdir src/app/admin/settings
```

- [ ] **Step 2: Create the shell client component**

`src/components/admin/admin-shell.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { browserClient } from '@/lib/db/browser-client';

const NAV = [
  { href: '/admin', label: '📊 Hoy' },
  { href: '/admin/settings', label: '⚙️ Configuración' },
];

function NavLinks(props: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={props.onNavigate}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            pathname === item.href ? 'bg-sky-800 text-white' : 'text-sky-200 hover:bg-sky-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-left text-xs text-sky-300 underline underline-offset-2"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.push('/admin/login');
        router.refresh();
      }}
    >
      Cerrar sesión
    </button>
  );
}

export function AdminShell(props: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col bg-[#0c4a6e] p-4 md:flex">
        <p className="font-extrabold text-white">🌊 Club La Piscina</p>
        <p className="mb-5 text-xs text-sky-300">Panel de administración</p>
        <NavLinks />
        <div className="mt-auto space-y-1 pt-4">
          <p className="truncate text-xs text-sky-200">{props.email}</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="bg-[#0c4a6e] p-3 md:hidden">
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-white">🌊 Admin</p>
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            className="min-h-11 min-w-11 rounded-lg text-xl text-white"
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
        {open && (
          <div className="mt-2 space-y-2 border-t border-sky-900 pt-2">
            <NavLinks onNavigate={() => setOpen(false)} />
            <LogoutButton />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create the layout**

`src/app/admin/(dashboard)/layout.tsx`:

```tsx
import { ssrClient } from '@/lib/db/ssr-client';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gates these pages; the user is only read for display.
  const supabase = await ssrClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <AdminShell email={user?.email ?? ''}>{children}</AdminShell>;
}
```

- [ ] **Step 4: Drop the now-redundant page nav links**

In `(dashboard)/page.tsx`: remove the `<Link href="/admin/settings">Configuración</Link>` (and its `Link` import if unused). In `(dashboard)/settings/page.tsx`: remove the `← Reservas` link (and unused import). Headings stay.

- [ ] **Step 5: Verify**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit && npm test && npm run build`
Expected: PASS; route table still lists `/admin` and `/admin/settings`.

Manual smoke (optional but recommended): `npm run dev`, log in at `/admin/login` (admin@example.com / test1234), confirm sidebar on desktop width, hamburger on mobile width, logout returns to login.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/admin src/components/admin/admin-shell.tsx
git commit -m "feat(admin): sidebar dashboard shell with mobile menu and logout"
```

---

### Task 14: Admin day view — KPI row + restyled table

**Files:**
- Modify: `src/components/admin/day-view.tsx`
- Modify: `src/components/admin/reservations-table.tsx`
- Tests: `src/components/admin/reservations-table.test.tsx`, `src/components/admin/checkin-card.test.tsx` (should be untouched)

- [ ] **Step 1: Add failing table tests**

In `reservations-table.test.tsx` (reuse the file's row fixtures):

```ts
  it('shows compact party labels', () => {
    // for a row with adults: 2, children: 1
    expect(screen.getByText(/2A 1N/)).toBeInTheDocument();
  });

  it('shows check-in time for checked_in rows', () => {
    // for a row with status 'checked_in' and checked_in_at: '2030-01-15T14:15:00Z' (10:15 Caracas)
    expect(screen.getByText(/ingresó 10:15/i)).toBeInTheDocument();
  });

  it('labels pending rows as payment under verification', () => {
    // for a row with status 'pending_payment'
    expect(screen.getByText(/pago en verificación/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/components/admin/reservations-table.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Restyle the table**

Replace the row body of `reservations-table.tsx` (keep the search filter logic and callbacks intact):

```tsx
import { partyShort } from '@/lib/party';
import { caracasTime } from '@/lib/dates';
```

```tsx
const CHIP: Record<string, string> = {
  confirmed: 'bg-sky-100 text-sky-800',
  checked_in: 'bg-green-100 text-green-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};

function statusLabel(r: ReservationRow): string {
  switch (r.status) {
    case 'checked_in': return `Ingresó ${r.checked_in_at ? caracasTime(r.checked_in_at) : ''}`.trim();
    case 'pending_payment': return 'Pago en verificación';
    case 'confirmed': return 'Confirmada';
    case 'failed': return 'Fallida';
    case 'expired': return 'Expirada';
  }
}
```

Row markup (replaces the current card interior; keep `data-testid="res-row"`):

```tsx
          <div key={r.id} data-testid="res-row" className="rounded-2xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold">{r.code}</span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CHIP[r.status]}`}>
                {statusLabel(r)}
              </span>
            </div>
            <p className="text-sm">
              {r.first_name} {r.last_name} · {r.id_type}-{r.id_number}
            </p>
            <p className="text-sm text-muted-foreground">
              {partyShort(r.adults, r.children)} · ${Number(r.total_usd).toFixed(2)}
            </p>
            <div className="mt-2 flex gap-2">
              {r.status === 'confirmed' && (
                <Button size="sm" className="rounded-full" onClick={() => props.onCheckIn(r.id)}>Check-in</Button>
              )}
              {['confirmed', 'checked_in'].includes(r.status) && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => props.onResend(r.id)}>
                  ✉️ Reenviar
                </Button>
              )}
            </div>
          </div>
```

Remove the old `STATUS_BADGE` map and the `Badge` import.

- [ ] **Step 4: Restyle the day view**

Replace `src/components/admin/day-view.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { ReservationsTable } from './reservations-table';
import { adminCheckIn, adminResendVoucher, type DaySummary } from '@/app/admin/actions';
import { longDateEs, todayCaracas } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

function Kpi(props: { label: string; children: React.ReactNode; sub?: string; tone?: 'amber' }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <div className={`text-xl font-extrabold ${props.tone === 'amber' ? 'text-amber-600' : ''}`}>{props.children}</div>
      {props.sub && <p className="text-xs text-muted-foreground">{props.sub}</p>}
    </div>
  );
}

export function AdminDayView(props: {
  date: string;
  rows: ReservationRow[];
  summary: DaySummary;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const s = props.summary;
  const go = (d: string) => { setNotice(null); router.push(`/admin?date=${d}`); };
  const shift = (days: number) => go(format(addDays(new Date(`${props.date}T12:00:00-04:00`), days), 'yyyy-MM-dd'));
  const pct = s.capacity > 0 ? Math.min(100, Math.round((s.confirmedPeople / s.capacity) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-extrabold capitalize">
          {props.date === todayCaracas() ? 'Hoy · ' : ''}{longDateEs(props.date)}
        </h2>
        <button type="button" className="min-h-11 rounded-lg border bg-white px-3 text-sm" onClick={() => shift(-1)}>‹ ayer</button>
        <button type="button" className="min-h-11 rounded-lg border bg-white px-3 text-sm" onClick={() => shift(1)}>mañana ›</button>
        <Input type="date" className="h-11 w-fit bg-white" value={props.date} onChange={(e) => go(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Ocupación">
          {s.confirmedPeople}<span className="text-sm font-normal text-muted-foreground">/{s.capacity}</span>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
          </div>
        </Kpi>
        <Kpi label="Ingresaron" sub={`${s.checkedInPeople} personas dentro`}>{s.checkedInParties} <span className="text-sm font-normal text-muted-foreground">grupos</span></Kpi>
        <Kpi label="Ingresos del día" sub={`Bs. ${s.revenueVes.toFixed(2)} · ${s.paidCount} reservas`}>${s.revenueUsd.toFixed(2)}</Kpi>
        <Kpi label="Pendientes" sub="por verificar pago" tone="amber">{s.pendingCount}</Kpi>
      </div>

      {notice && <p role="alert" className="rounded-md bg-muted p-3 text-sm">{notice}</p>}
      <ReservationsTable
        rows={props.rows}
        onCheckIn={async (id) => {
          setNotice(null);
          const res = await adminCheckIn(id);
          setNotice(res.ok ? 'Entrada registrada.' : res.message ?? null);
          router.refresh();
        }}
        onResend={async (id) => {
          setNotice(null);
          const res = await adminResendVoucher(id);
          setNotice(res.ok ? 'Correo reenviado.' : res.message ?? null);
        }}
      />
    </div>
  );
}
```

Note: `type DaySummary` import from `@/app/admin/actions` — if Task 12 moved the interface to `@/lib/db/reservations`, import from there instead. Type-only imports from `'use server'` files are erased at build time.

Also update `(dashboard)/page.tsx` heading to "Reservas del día" if it still says "Reservas" — its `<AdminDayView>` props are unchanged in shape.

- [ ] **Step 5: Run tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: PASS. Update any `reservations-table.test.tsx` assertion that used the old labels ('Pendiente', '2 adultos, 1 niño', 'Reenviar correo' → now '✉️ Reenviar').

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/day-view.tsx src/components/admin/reservations-table.tsx src/components/admin/reservations-table.test.tsx "src/app/admin/(dashboard)/page.tsx"
git commit -m "feat(admin): KPI row with revenue metric and restyled reservations list"
```

---

### Task 15: Login + settings skin

**Files:**
- Modify: `src/app/admin/login/page.tsx:57-66` (outer shell only — LoginForm logic untouched)
- Modify: `src/app/admin/(dashboard)/settings/page.tsx` (heading only, if not already done in Task 13)

- [ ] **Step 1: Restyle the login page shell**

Replace the default export in `login/page.tsx`:

```tsx
export default function AdminLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 to-sky-300 p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-xl font-extrabold text-sky-900">🌊 Admin — Pool Pass</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/page.tsx "src/app/admin/(dashboard)/settings/page.tsx"
git commit -m "feat(admin): themed login and settings pages"
```

---

### Task 16: E2E — landing spec + booking via landing CTA

**Files:**
- Create: `e2e/landing.spec.ts`
- Modify: `e2e/booking.spec.ts`

- [ ] **Step 1: Write the landing spec**

`e2e/landing.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('landing shows hero, prices and CTA navigates to /reservar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /tu día de piscina/i })).toBeVisible();
  await expect(page.locator('#precios')).toContainText(/adultos/i);
  await expect(page.locator('#precios')).toContainText('$');
  await page.getByRole('link', { name: /reservar ahora/i }).click();
  await expect(page).toHaveURL(/\/reservar$/);
  await expect(page.getByText(/paso 1 de 2/i)).toBeVisible();
});
```

- [ ] **Step 2: Route booking specs through the landing**

In `e2e/booking.spec.ts`, add a helper and use it in all three tests (replacing the Task-7 interim `page.goto('/reservar')` lines):

```ts
async function openBooking(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /reservar ahora/i }).click();
  await expect(page).toHaveURL(/\/reservar$/);
}
```

Each test then starts with `await openBooking(page);`.

- [ ] **Step 3: Run e2e**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run test:e2e`
Expected: 4 tests PASS (3 booking + 1 landing). The pay-button locator `/pagar/i` still matches "Pagar $30.00".

- [ ] **Step 4: Commit**

```bash
git add e2e/landing.spec.ts e2e/booking.spec.ts
git commit -m "test(e2e): landing spec and booking flow entering via landing CTA"
```

---

### Task 17: Final verification + docs touch-up

**Files:**
- Modify: `README.md` (two short additions)

- [ ] **Step 1: Document the editable content points**

Add to README (in or near the setup/customization section):

```markdown
## Personalización del landing

- Textos del landing (nombre del club, amenidades, dirección, horario, WhatsApp, Instagram): edita `src/lib/landing-content.ts`.
- Fotos de la galería: coloca hasta 6 imágenes (`.jpg/.png/.webp/.avif`) en `public/gallery/`; sin fotos se muestran placeholders degradados.
```

- [ ] **Step 2: Full verification suite**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit && npm run lint && npm test && npm run test:integration && npm run test:e2e && npm run build`
Expected: everything green. Unit count grows from 79 (new: party, landing-content, dates, day-summary, progress, pay-button, confirmation-QR tests).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: landing customization notes"
```

---

## Self-review checklist (done at plan time)

- Spec §1 tokens → Task 1; §2 landing → Tasks 5, 7; §3 checkout → Tasks 6, 8–11; §4 child-only → Tasks 2–4; §5 admin → Tasks 12–15; §6 testing → TDD steps throughout + Tasks 16–17.
- Deviation noted: no duplicate "Reservas" sidebar item (see File map note).
- Types consistent: `DaySummary` (Tasks 12→14), `partyLabel/partyShort` (Tasks 5→9/10/11/14), `shortDateEs/longDateEs` (Tasks 5→9/11/14), `onEdit` (Task 9 both sides), `reservation.id` (Task 11, verified present in `BookingResult`).
