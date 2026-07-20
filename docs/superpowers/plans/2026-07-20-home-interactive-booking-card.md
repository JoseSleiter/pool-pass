# Home Interactive Booking Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home hero's "Fecha" and "Personas" tiles interactive (calendar + stepper, live total) and carry the selection into `/reservar` via query params so the user never re-picks.

**Architecture:** Extract the calendar editor (`DatePickerPanel`), the people stepper (`CountRow`), and the date label formatter (`visitLabelEs`) into shared modules so the home card and `BookingCard` share one implementation. Add a new client `HeroBookingCard` that owns the interactive home card and links to `/reservar?date=..&adults=..&children=..&pay=1`. `/reservar` sanitizes those params and seeds `BookingCard`.

**Tech Stack:** Next.js 16 (App Router, RSC + client components), React 19, Tailwind, date-fns, react-day-picker, vitest.

---

## File Structure

- **Create** `src/components/booking/count-row.tsx` — shared people stepper (moved from `booking-card.tsx`).
- **Create** `src/components/booking/date-picker-panel.tsx` — shared calendar editor with past/full-day disable logic.
- **Create** `src/lib/booking/search-params.ts` — `parseBookingParams` sanitizer + `src/lib/booking/search-params.test.ts`.
- **Create** `src/components/landing/hero-booking-card.tsx` — interactive home card (client).
- **Modify** `src/lib/dates.ts` — add `visitLabelEs`.
- **Modify** `src/components/booking/booking-card.tsx` — use shared pieces, accept `initial*` props, add `cursor-pointer`.
- **Modify** `src/components/landing/hero.tsx` — render `HeroBookingCard`, drop static card.
- **Modify** `src/app/page.tsx` — fetch availability, pass to hero.
- **Modify** `src/app/reservar/page.tsx` — parse params, seed `BookingCard`.

---

## Task 1: `visitLabelEs` date formatter

**Files:**
- Modify: `src/lib/dates.ts`

- [ ] **Step 1: Add `visitLabelEs` to `src/lib/dates.ts`** (append after `longDateEs`)

```ts
/** "Vie, 17 Jul 2026" — capitalized, dot-free short label for booking cards. */
export function visitLabelEs(date: string): string {
  const raw = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(`${date}T12:00:00-04:00`));
  return raw.replace(/\b\p{L}/gu, (c) => c.toUpperCase()).replace(/\./g, '');
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/dates.ts
git commit -m "feat: add visitLabelEs shared date formatter"
```

---

## Task 2: `parseBookingParams` sanitizer (TDD)

**Files:**
- Create: `src/lib/booking/search-params.ts`
- Test: `src/lib/booking/search-params.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/booking/search-params.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseBookingParams } from './search-params';

// Freeze "today" (Caracas) so date comparisons are deterministic.
function freezeToday(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T12:00:00-04:00`));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('parseBookingParams', () => {
  it('defaults to today / 2 adults / 1 child when params are absent', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({})).toEqual({ date: '2026-07-20', adults: 2, children: 1 });
  });

  it('keeps a valid future date', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2026-08-01' }).date).toBe('2026-08-01');
  });

  it('keeps today itself', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2026-07-20' }).date).toBe('2026-07-20');
  });

  it('clamps a past date to today', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2020-01-01' }).date).toBe('2026-07-20');
  });

  it('falls back to today on a malformed date', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: 'not-a-date' }).date).toBe('2026-07-20');
  });

  it('clamps adults/children into [0, 20]', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '99', children: '-5' })).toMatchObject({ adults: 20, children: 0 });
  });

  it('parses valid integer counts', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '3', children: '0' })).toMatchObject({ adults: 3, children: 0 });
  });

  it('falls back to defaults on non-integer counts', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '2.5', children: 'x' })).toMatchObject({ adults: 2, children: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/booking/search-params.test.ts`
Expected: FAIL — "Cannot find module './search-params'"

- [ ] **Step 3: Implement `src/lib/booking/search-params.ts`**

```ts
import { todayCaracas } from '@/lib/dates';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clamp an integer into [min, max]; fall back to `fallback` if not a valid integer. */
function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * Sanitize the date/adults/children query params carried from the home card.
 * Invalid or past values fall back to safe defaults (today / 2 adults / 1 child).
 * Date strings are compared lexically — YYYY-MM-DD order equals chronological order.
 */
export function parseBookingParams(sp: {
  date?: string;
  adults?: string;
  children?: string;
}): { date: string; adults: number; children: number } {
  const today = todayCaracas();
  const date = sp.date && DATE_RE.test(sp.date) && sp.date >= today ? sp.date : today;
  return {
    date,
    adults: clampInt(sp.adults, 2, 0, 20),
    children: clampInt(sp.children, 1, 0, 20),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/booking/search-params.test.ts`
Expected: PASS (8 passing)

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking/search-params.ts src/lib/booking/search-params.test.ts
git commit -m "feat: add parseBookingParams query-param sanitizer"
```

---

## Task 3: Shared `CountRow` stepper

**Files:**
- Create: `src/components/booking/count-row.tsx`

- [ ] **Step 1: Create `src/components/booking/count-row.tsx`** (moved from `booking-card.tsx`, with `cursor-pointer` added)

```tsx
import { Minus, Plus } from 'lucide-react';

export function CountRow(props: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
      <div>
        <p className="font-bold text-navy">{props.label}</p>
        <p className="text-xs text-muted-foreground">{props.hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Disminuir ${props.label.toLowerCase()}`}
          disabled={props.value <= 0}
          onClick={() => props.onChange(Math.max(props.value - 1, 0))}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span data-testid={props.testId} className="w-6 text-center font-heading text-lg font-semibold">{props.value}</span>
        <button
          type="button"
          aria-label={`Aumentar ${props.label.toLowerCase()}`}
          disabled={props.value >= 20}
          onClick={() => props.onChange(Math.min(props.value + 1, 20))}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/count-row.tsx
git commit -m "feat: extract shared CountRow stepper"
```

---

## Task 4: Shared `DatePickerPanel` calendar

**Files:**
- Create: `src/components/booking/date-picker-panel.tsx`

- [ ] **Step 1: Create `src/components/booking/date-picker-panel.tsx`**

```tsx
'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';

/**
 * Shared calendar editor. Reports the picked day as a `YYYY-MM-DD` string and the
 * viewed month as `YYYY-MM`. Disables past days and days with no availability.
 */
export function DatePickerPanel(props: {
  date: string;
  availability: Record<string, number>;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
}) {
  const anchor = new Date(`${props.date}T12:00:00`);
  return (
    <div className="rounded-2xl bg-muted p-4">
      <div className="flex justify-center">
        <Calendar
          mode="single"
          locale={es}
          weekStartsOn={0}
          className="bg-transparent [--cell-size:2.5rem]"
          selected={anchor}
          defaultMonth={anchor}
          onSelect={(d) => {
            if (d) props.onSelect(format(d, 'yyyy-MM-dd'));
          }}
          onMonthChange={(m) => props.onMonthChange(format(m, 'yyyy-MM'))}
          disabled={(d) => {
            const key = format(d, 'yyyy-MM-dd');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (d < today) return true;
            return props.availability[key] !== undefined && props.availability[key] <= 0;
          }}
        />
      </div>
      <p className="mt-1 text-center text-sm text-secondary-foreground">Selecciona una fecha disponible</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/booking/date-picker-panel.tsx
git commit -m "feat: extract shared DatePickerPanel calendar"
```

---

## Task 5: Refactor `BookingCard` onto shared pieces + accept initial props

**Files:**
- Modify: `src/components/booking/booking-card.tsx`

- [ ] **Step 1: Fix imports.** Replace the import block (lines 3–27) so the `date-fns`/`Calendar`/`Minus`/`Plus` bits are dropped and the shared modules are added. New imports:

```tsx
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import {
  CalendarCheck,
  Users,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import {
  getAvailability,
  getCurrentRate,
  submitBookingAndPay,
} from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import { partyLabel } from '@/lib/party';
import { shortDateEs, visitLabelEs } from '@/lib/dates';
import { paymentSchema } from '@/lib/schemas';
import { VENEZUELAN_BANKS } from '@/lib/banks';
import { whatsappUrl } from '@/lib/landing-content';
import type { BookingResult } from '@/lib/booking/process';
```

> Note: `es` from `date-fns/locale`, `Calendar`, `Minus`, `Plus` are intentionally gone (now inside the shared components). `format` stays (used for the default date). `capitalize` stays defined below (used in the done view). `shortDateEs` stays (done view).

- [ ] **Step 2: Delete the local `longVisitLabel` helper** (the function at lines 38–47). Keep the `capitalize` helper above it — it is still used in the done view.

- [ ] **Step 3: Add the three optional `initial*` props** to the `BookingCard` props type. Change the props object so it reads:

```tsx
export function BookingCard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
  remaining: number;
  startAtPay?: boolean;
  initialDate?: string;
  initialAdults?: number;
  initialChildren?: number;
}) {
```

- [ ] **Step 4: Seed state from the new props.** Replace the three state initializers:

```tsx
  const [date, setDate] = useState(props.initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [adults, setAdults] = useState(props.initialAdults ?? 2);
  const [children, setChildren] = useState(props.initialChildren ?? 1);
```

- [ ] **Step 5: Replace the inline DATE EDITOR block** (the `{editing === 'date' && ...}` block, lines ~173–200) with the shared panel:

```tsx
      {/* ---- DATE EDITOR ---- */}
      {editing === 'date' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5">
          <DatePickerPanel
            date={date}
            availability={availability}
            onSelect={(d) => { setDate(d); setEditing(null); }}
            onMonthChange={(m) => getAvailability(m).then(setAvailability)}
          />
        </div>
      )}
```

- [ ] **Step 6: Swap the label + add `cursor-pointer` to the two tiles.** In the TILES block, change the date tile's `<button>` className and label, and the people tile's `<button>` className:

Date tile — className becomes `"cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"` and its value line becomes:

```tsx
                <p className="mt-1 font-heading text-lg font-semibold">{visitLabelEs(date)}</p>
```

People tile — className becomes `"cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"`.

- [ ] **Step 7: Add `cursor-pointer` to the remaining interactive buttons.** Update these classNames:
  - PEOPLE EDITOR "Listo" button → prepend `cursor-pointer`: `"cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"`
  - SUMMARY "Continuar" button → prepend `cursor-pointer`: `"inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"`
  - PAY "Confirmar y pagar" button → keep existing classes, prepend `cursor-pointer` and disabled cursor: `"mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"`

- [ ] **Step 8: Delete the local `CountRow` function** (the whole `function CountRow(...) {...}` block, lines ~414–450). It now lives in `count-row.tsx` and is imported.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no unused-import or missing-symbol errors)

- [ ] **Step 10: Run unit tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/components/booking/booking-card.tsx
git commit -m "refactor: BookingCard uses shared pieces + accepts initial selection"
```

---

## Task 6: `HeroBookingCard` interactive home card

**Files:**
- Create: `src/components/landing/hero-booking-card.tsx`

- [ ] **Step 1: Create `src/components/landing/hero-booking-card.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import { getAvailability } from '@/app/actions/booking';
import { totalUsd } from '@/lib/money';
import { partyLabel } from '@/lib/party';
import { visitLabelEs, todayCaracas } from '@/lib/dates';

type Editing = null | 'date' | 'people';

export function HeroBookingCard(props: {
  prices: { adult: number; child: number };
  remaining: number;
  initialAvailability: Record<string, number>;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [date, setDate] = useState(todayCaracas());
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);

  const usd = totalUsd(adults, children, props.prices);
  const open = props.remaining > 0;
  const continueHref = `/reservar?date=${date}&adults=${adults}&children=${children}&pay=1`;

  return (
    <div className="mt-12 rounded-3xl bg-card p-6 text-navy shadow-2xl shadow-navy-deep/30 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Reserva tu pase</h2>
          <p className="mt-1 text-sm text-muted-foreground">Completa estos datos para ver tu total</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pago seguro
        </span>
      </div>

      {/* ---- DATE EDITOR ---- */}
      {editing === 'date' && (
        <div className="mt-6">
          <DatePickerPanel
            date={date}
            availability={availability}
            onSelect={(d) => { setDate(d); setEditing(null); }}
            onMonthChange={(m) => getAvailability(m).then(setAvailability)}
          />
        </div>
      )}

      {/* ---- PEOPLE EDITOR ---- */}
      {editing === 'people' && (
        <div className="mt-6 rounded-2xl bg-muted p-5">
          <h3 className="font-heading text-xl font-semibold">¿Quiénes van?</h3>
          <div className="mt-4 space-y-3">
            <CountRow label="Adultos" hint={`$${props.prices.adult.toFixed(0)} por persona`} value={adults} onChange={setAdults} testId="hero-adults-count" />
            <CountRow label="Niños" hint={`$${props.prices.child.toFixed(0)} por persona`} value={children} onChange={setChildren} testId="hero-children-count" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">El total se actualiza automáticamente</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* ---- TILES ---- */}
      {editing === null && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setEditing('date')}
            className="cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Fecha de visita</p>
                <p className="mt-1 font-heading text-lg font-semibold">{visitLabelEs(date)}</p>
              </div>
              <CalendarCheck className="h-5 w-5 text-teal" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => setEditing('people')}
            className="cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Personas</p>
                <p className="mt-1 font-heading text-lg font-semibold">{partyLabel(adults, children) || 'Elige asistentes'}</p>
              </div>
              <Users className="h-5 w-5 text-teal" />
            </div>
          </button>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-xs font-medium text-secondary-foreground/70">Total estimado</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-secondary-foreground">${usd.toFixed(0)} USD</p>
          </div>
        </div>
      )}

      {/* ---- ACTION ---- */}
      {editing === null && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
            <span className={`h-2 w-2 rounded-full ${open ? 'bg-teal' : 'bg-destructive'}`} />
            {open ? `${props.remaining} cupos disponibles hoy` : 'Sin cupos hoy — elige otra fecha'}
          </p>
          <Link
            href={continueHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/hero-booking-card.tsx
git commit -m "feat: interactive HeroBookingCard for the home hero"
```

---

## Task 7: Wire `HeroBookingCard` into `hero.tsx`

**Files:**
- Modify: `src/components/landing/hero.tsx`

- [ ] **Step 1: Replace the entire file** `src/components/landing/hero.tsx` with:

```tsx
import { landingContent } from '@/lib/landing-content';
import { HeroBookingCard } from '@/components/landing/hero-booking-card';

/** Stylized pool card icon (ladder + water), matching the reference line art. */
function PoolMark() {
  return (
    <svg viewBox="0 0 120 96" fill="none" className="h-24 w-28" aria-hidden>
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 12v46M60 12v46M76 12v46" />
        <path d="M44 26h32M44 40h32" />
        <path d="M40 12a6 6 0 0 1 12 0M68 12a6 6 0 0 1 12 0" />
        <path d="M20 68c8 0 8 6 16 6s8-6 16-6 8 6 16 6 8-6 16-6 8 6 16 6" />
        <path d="M20 82c8 0 8 6 16 6s8-6 16-6 8 6 16 6 8-6 16-6 8 6 16 6" />
      </g>
    </svg>
  );
}

export function Hero(props: {
  remaining: number;
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
}) {
  const open = props.remaining > 0;
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: 'linear-gradient(145deg, #0b2a4a 0%, #075e82 58%, #0bc4c7 100%)' }}
    >
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-14">
        {/* Top: copy + floating pool card */}
        <div className="grid items-start gap-10 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-soft">
              {landingContent.tagline}
            </p>
            <h1 className="mt-5 font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Reserva tu pase.
              <br />
              Disfruta el agua.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
              Elige tu fecha, registra a tus acompañantes y recibe tu pase
              digital en minutos. Pago seguro con Pago Móvil y acceso fácil
              desde tu celular.
            </p>
            <p className="mt-6 text-sm font-semibold text-white/90">
              Adultos desde&nbsp;
              <span className="text-white">${props.prices.adult.toFixed(0)}</span>
              <span className="mx-3 text-white/40">·</span>
              Niños&nbsp;
              <span className="text-white">${props.prices.child.toFixed(0)}</span>
            </p>
          </div>

          <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/15 bg-white/10 p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-teal-soft">
              <PoolMark />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                {open ? 'Piscina abierta' : 'Agotado hoy'}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive booking card */}
        <HeroBookingCard
          prices={props.prices}
          remaining={props.remaining}
          initialAvailability={props.initialAvailability}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — `page.tsx` does not yet pass `initialAvailability` to `<Hero>`. (Fixed in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/hero.tsx
git commit -m "feat: render interactive HeroBookingCard in hero"
```

---

## Task 8: Fetch availability on the home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the entire file** `src/app/page.tsx` with:

```tsx
import { getPublicPrices, getTodayRemaining, getAvailability } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Features, HowItWorks, FinalCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = todayCaracas().slice(0, 7);
  const [prices, remaining, availability] = await Promise.all([
    getPublicPrices(),
    getTodayRemaining(),
    getAvailability(month),
  ]);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero remaining={remaining} prices={prices} initialAvailability={availability} />
        <Features />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (Task 7's `hero.tsx` now receives `initialAvailability`)

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: fetch month availability for the home hero card"
```

---

## Task 9: Seed `/reservar` from carried params

**Files:**
- Modify: `src/app/reservar/page.tsx`

- [ ] **Step 1: Replace the entire file** `src/app/reservar/page.tsx` with:

```tsx
import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { BookingCard } from '@/components/booking/booking-card';
import { getPublicPrices, getAvailability, getTodayRemaining } from '@/app/actions/booking';
import { parseBookingParams } from '@/lib/booking/search-params';

export const dynamic = 'force-dynamic';

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string; date?: string; adults?: string; children?: string }>;
}) {
  const sp = await searchParams;
  const { date, adults, children } = parseBookingParams(sp);
  // Anchor availability to the carried date's month so the calendar matches the selection.
  const month = date.slice(0, 7);
  const [prices, availability, remaining] = await Promise.all([
    getPublicPrices(),
    getAvailability(month),
    getTodayRemaining(),
  ]);
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-background px-5 py-10 sm:py-14">
        <BookingCard
          prices={prices}
          initialAvailability={availability}
          remaining={remaining}
          startAtPay={sp.pay === '1'}
          initialDate={date}
          initialAdults={adults}
          initialChildren={children}
        />
      </main>
      <SiteFooter />
    </>
  );
}
```

> Note: `todayCaracas` import is dropped — the month now derives from the sanitized `date`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/reservar/page.tsx
git commit -m "feat: seed /reservar from carried booking params"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS (no errors)

- [ ] **Step 2: Unit + integration tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS (compiles, no type errors)

- [ ] **Step 4: Manual smoke test** (start `npm run dev`, then in the browser)

  1. Load `/`. The home card shows today's date, "2 adultos, 1 niño", and a live total.
  2. Click the **Fecha de visita** tile → calendar opens; past/full days disabled; pick a future date → panel closes, tile updates.
  3. Click the **Personas** tile → steppers work; total updates live; "Listo" closes.
  4. Hover any interactive tile/button → cursor is a pointer.
  5. Click **Continuar** → lands on `/reservar?date=..&adults=..&children=..&pay=1` in the payment view, with the same date and party already selected in the tiles.

- [ ] **Step 5: E2E (optional but recommended — requires Supabase env)**

Run: `npx playwright test e2e/booking.spec.ts`
Expected: PASS (the hero "Continuar" link → `/reservar` flow is unchanged in shape)

---

## Notes for the implementer

- The whole change lives on branch `feat/home-interactive-booking-card` (already created; design doc committed there).
- `getAvailability` is a server action already called from the client in `BookingCard`; calling it from `HeroBookingCard` is the same pattern.
- Date strings use `YYYY-MM-DD`, which sorts lexically the same as chronologically — that's why `parseBookingParams` compares with `>=` instead of parsing `Date` objects (avoids timezone bugs).
- Do **not** reintroduce a second `CountRow` or a second calendar block — the whole point is one shared implementation.
