# PR 09 — Vista "Hoy" con KPIs operativos (`feat/admin-metrics`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la portada del admin (`/admin`) en la vista operativa "Hoy": barra de fecha con saltos rápidos "‹ Ayer" · "Hoy" · "Mañana ›" (con "Hoy" visiblemente activo) y cuatro tarjetas KPI (Ocupación con gauge radial por rangos de color, Check-ins con tendencia por hora, Ingresos USD/Bs. por estado de pago y Cola C2P pulsante con botón "Revisar C2P pendientes").

**Architecture:** La lógica pura (capacidad efectiva del día, bandas de ocupación, serie por hora, fechas ISO) va a un módulo nuevo `src/lib/day-metrics.ts`, probado en entorno `node`. Una server action nueva `adminGetDayMetrics(date)` en `src/app/admin/metrics-actions.ts` hace `requireAdmin()` + zod, lee con los helpers de BD existentes (`listReservationsByDate`, `getSettings`, `listOverrides`) y delega en `computeDayMetrics`, de modo que la capacidad respeta `capacity_overrides` (días cerrados / especiales). `metric-cards.tsx` se reescribe con cuatro tarjetas independientes + `MetricGrid`, y `day-view.tsx` gana la barra de fecha y el enlace "Revisar C2P pendientes" → chip `pending_payment` de la lista del día + scroll/foco a la lista.

**Tech Stack:** Next.js 16 App Router (server component + client islands), React 19, TypeScript, Tailwind v4 (tokens `teal`, `coral`, `navy`, `mint` de `globals.css`), shadcn `Button`/`Input` sobre base-ui, lucide-react 1.23, zod 4, Vitest + Testing Library + user-event, Playwright.

---

## Contexto y reglas (léelo antes de empezar)

- **Worktree:** `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-metrics` (rama `feat/admin-metrics`, basada en `develop`). Todos los comandos se ejecutan desde ahí. No crees worktree, no hagas push, no abras PR (lo hace el coordinador).
- **Node:** el Node por defecto es v16. TODO comando npm/npx va prefijado con `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null &&`.
- **Supabase local** ya corre y es compartido: prohibido `supabase start/stop/db reset/migration`. Este PR **no** necesita migraciones (sólo lee tablas existentes).
- **e2e serializado** (Supabase y el puerto 3100 son compartidos): todo `npm run test:e2e` / `npx playwright test` se ejecuta dentro del lock:
  ```bash
  L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"
  ```
  y, ya dentro del lock, comprobando antes que nada escucha en :3100 (`lsof -nP -iTCP:3100 -sTCP:LISTEN` debe salir vacío).
- **Propiedad de archivos (ola 3):** este PR posee `src/components/admin/metric-cards.tsx` (+test), `src/components/admin/day-view.tsx`, `src/app/admin/(dashboard)/page.tsx` y el nuevo `src/app/admin/metrics-actions.ts`. Crea además archivos NUEVOS: `src/lib/day-metrics.ts` (+test), `src/app/admin/metrics-actions.test.ts`, `src/components/admin/day-view.test.tsx`, `src/app/admin/(dashboard)/page.test.ts`, `e2e/admin-day-view.spec.ts`.
  - **NO** edites `src/app/admin/actions.ts` (`adminGetDaySummary` queda intacto), `src/lib/db/reservations.ts`, `src/lib/reservation-status.ts`, `reservations-table.tsx`, `reservation-card.tsx` (PR 10) ni `nav-config.ts` (el ítem "Hoy" ya tiene `ready: true`).
  - PR 10 posee la página `/admin/reservations`: **no enlaces allí**. "Revisar C2P pendientes" usa el chip existente de la lista del día.
- **Admin = español en duro**, sin diccionarios. Touch targets ≥ 44px (`ADMIN_ACTION`/`ADMIN_INPUT` de `src/components/admin/ui-constants.ts`). Fechas largas con `first-letter:uppercase` (nunca la clase `capitalize`). Horas siempre `America/Caracas` (`src/lib/dates.ts`, `src/lib/day-stats.ts`). Animaciones sólo con `motion-safe:`. Nada de datos inventados.
- **Bandas de ocupación (roadmap §2):** 0–70 % teal `#0bc4c7` (`stroke-teal`), 71–90 % ámbar (`stroke-amber-500`), 91–100 % (y más) coral `#ff7657` (`stroke-coral`). La banda se decide sobre el **porcentaje entero redondeado** (el mismo número que se muestra), así color y número nunca se contradicen (ej. 141/200 = 70,5 % → "71 %" → ámbar).
- **Commits:** Conventional Commits, terminando con línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Hallazgo: capacidad del día

`adminGetDaySummary` (en `src/app/admin/actions.ts`) devuelve `capacity: settings.daily_capacity` e **ignora `capacity_overrides`**: un día cerrado (override 0) o especial (ej. 50) muestra la capacidad por defecto. La nueva `adminGetDayMetrics` usa la capacidad efectiva (`override ?? daily_capacity`), igual que `monthAvailability` y `getTodayCapacity`. `adminGetDaySummary` no se toca (deja de usarse en la UI; su test sigue pasando).

### Decisiones de datos

| KPI | Fuente | Nota |
|---|---|---|
| Ocupación | `confirmedPeople` = adultos+niños de `confirmed`+`checked_in` / capacidad efectiva | Los `pending_payment` no cuentan (spec: `confirmedPeople / capacity`). Capacidad 0 ⇒ "Cerrado", sin gauge. |
| Check-ins | `checkedInPeople` vs `confirmedPeople`, `checkedInParties`, `checkinsByHour` (helper existente `bucketCheckinsByHour`, hora Caracas) | La serie se rellena con ceros entre la primera y la última hora con ingresos. |
| Ingresos | Cobrado = Σ `total_usd` / Σ `total_ves` de `confirmed`+`checked_in`; Por verificar = Σ `total_usd` de `pending_payment` | `total_ves` de un `pending_payment` es `null` (se fija al confirmar, ver `confirmReservation`), así que **no se muestra Bs. por verificar** (no inventamos una conversión). |
| Cola C2P | número y monto USD de `pending_payment` del día | Mismo conjunto que el chip "Pendientes" de la lista (`listReservationsByDate` no filtra por `expires_at`), así el conteo coincide al pulsar el botón. |

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/day-metrics.ts` | Crear | Lógica pura: bandas de ocupación, fechas ISO (`isIsoDate`, `shiftIsoDate`, `parseDayParam`), serie por hora (`hourlySeries`, `hourLabel`), tipo `DayMetrics` y `computeDayMetrics` (capacidad efectiva). |
| `src/lib/day-metrics.test.ts` | Crear | Tests unitarios (entorno node). |
| `src/app/admin/metrics-actions.ts` | Crear | Server action `adminGetDayMetrics(date)`: `requireAdmin()` + zod + helpers de BD + `computeDayMetrics`. |
| `src/app/admin/metrics-actions.test.ts` | Crear | Gating, validación y capacidad efectiva con módulos mockeados. |
| `src/components/admin/metric-cards.tsx` | Reescribir | `OccupancyCard`, `CheckinsCard`, `RevenueCard`, `C2PQueueCard`, `MetricGrid`. |
| `src/components/admin/metric-cards.test.tsx` | Reescribir | Bordes 0/70/71/90/91/100 %, sobrecupo, día cerrado, capacidad especial, tendencia vacía/llena, ingresos, cola C2P. |
| `src/components/admin/day-view.tsx` | Reescribir | `DateToolbar` (Ayer/Hoy/Mañana + input de fecha), grilla KPI, lista del día como región enfocable, "Revisar C2P pendientes". |
| `src/components/admin/day-view.test.tsx` | Crear | Navegación por fecha, "Hoy" activo, chip pendiente + scroll/foco (respeta reduced motion). |
| `src/app/admin/(dashboard)/page.tsx` | Modificar | Usa `parseDayParam` + `adminGetDayMetrics`, pasa `today`, `key={date}`. |
| `src/app/admin/(dashboard)/page.test.ts` | Crear | Fecha válida / inválida / ausente, props y `key`. |
| `e2e/admin-day-view.spec.ts` | Crear | Login local, 4 tarjetas visibles, Hoy activo, saltos de fecha (skip sin credenciales). |

---

### Task 0: Preparar el entorno y la línea base

**Files:** ninguno.

- [ ] **Step 1: Verificar rama e instalar dependencias**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-metrics
git branch --show-current
git status --short
[ -d node_modules ] || (source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci)
```

Expected: imprime `feat/admin-metrics`, `git status` vacío; `npm ci` termina sin errores (al escribir este plan el worktree NO tenía `node_modules`).

- [ ] **Step 2: Línea base de tests unitarios y tipos**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-metrics
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm test
```

Expected: `tsc` sin salida; Vitest todo en verde (incluye `src/components/admin/metric-cards.test.tsx` con 2 tests). Si algo falla ANTES de tocar código, para y repórtalo: no es de este PR.

---

### Task 1: Bandas de ocupación (`occupancyPercent`, `occupancyLevel`)

**Files:**
- Create: `src/lib/day-metrics.ts`
- Test: `src/lib/day-metrics.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/day-metrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { occupancyLevel, occupancyPercent } from './day-metrics';

describe('occupancyPercent', () => {
  it('is the rounded whole percent of capacity in use', () => {
    expect(occupancyPercent(0, 100)).toBe(0);
    expect(occupancyPercent(45, 100)).toBe(45);
    expect(occupancyPercent(1, 3)).toBe(33);
    expect(occupancyPercent(141, 200)).toBe(71); // 70.5 rounds up
  });

  it('can exceed 100 when the day is overbooked', () => {
    expect(occupancyPercent(120, 100)).toBe(120);
  });

  it('is null for a closed day (capacity 0 or less)', () => {
    expect(occupancyPercent(0, 0)).toBeNull();
    expect(occupancyPercent(3, 0)).toBeNull();
  });
});

describe('occupancyLevel (roadmap §2 bands)', () => {
  it.each<[number, string]>([
    [0, 'normal'],
    [70, 'normal'],
    [71, 'high'],
    [90, 'high'],
    [91, 'peak'],
    [100, 'peak'],
    [130, 'peak'],
  ])('%i %% → %s', (pct, level) => {
    expect(occupancyLevel(pct)).toBe(level);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: FAIL — `Failed to resolve import "./day-metrics"`.

- [ ] **Step 3: Implementación mínima**

Crea `src/lib/day-metrics.ts`:

```ts
/** Occupancy color bands (roadmap §2): 0–70 % normal, 71–90 % high, 91 %+ peak. */
export type OccupancyLevel = 'normal' | 'high' | 'peak';

export const OCCUPANCY_HIGH_FROM = 71;
export const OCCUPANCY_PEAK_FROM = 91;

/**
 * Whole percent of the day's capacity in use (may exceed 100 when overbooked).
 * null when the day is closed (capacity 0). Bands are decided on this rounded
 * value so the shown number and its color never disagree.
 */
export function occupancyPercent(people: number, capacity: number): number | null {
  if (capacity <= 0) return null;
  return Math.round((people / capacity) * 100);
}

export function occupancyLevel(percent: number): OccupancyLevel {
  if (percent >= OCCUPANCY_PEAK_FROM) return 'peak';
  if (percent >= OCCUPANCY_HIGH_FROM) return 'high';
  return 'normal';
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/day-metrics.ts src/lib/day-metrics.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add occupancy band helpers for the day KPIs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fechas ISO (`isIsoDate`, `shiftIsoDate`, `parseDayParam`)

**Files:**
- Modify: `src/lib/day-metrics.ts` (añadir al final)
- Test: `src/lib/day-metrics.test.ts` (añadir)

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/day-metrics.test.ts`, cambia la línea de import por:

```ts
import {
  isIsoDate, occupancyLevel, occupancyPercent, parseDayParam, shiftIsoDate,
} from './day-metrics';
```

y añade al final del archivo:

```ts
describe('isIsoDate', () => {
  it('accepts real calendar dates in YYYY-MM-DD', () => {
    expect(isIsoDate('2030-01-15')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate('hoy')).toBe(false);
    expect(isIsoDate('2030-1-15')).toBe(false);
    expect(isIsoDate('2030-02-31')).toBe(false);
    expect(isIsoDate('2029-02-29')).toBe(false);
    expect(isIsoDate('2030-01-15T00:00:00Z')).toBe(false);
  });
});

describe('shiftIsoDate', () => {
  it('moves by whole days across month and year boundaries', () => {
    expect(shiftIsoDate('2030-01-15', -1)).toBe('2030-01-14');
    expect(shiftIsoDate('2030-01-15', 1)).toBe('2030-01-16');
    expect(shiftIsoDate('2030-03-01', -1)).toBe('2030-02-28');
    expect(shiftIsoDate('2030-12-31', 1)).toBe('2031-01-01');
  });
});

describe('parseDayParam', () => {
  it('keeps a valid ?date= value', () => {
    expect(parseDayParam('2030-01-15', '2030-06-01')).toBe('2030-01-15');
  });

  it('falls back to today for missing, invalid or repeated params', () => {
    expect(parseDayParam(undefined, '2030-06-01')).toBe('2030-06-01');
    expect(parseDayParam('2030-02-31', '2030-06-01')).toBe('2030-06-01');
    expect(parseDayParam(['2030-01-15', '2030-01-16'], '2030-06-01')).toBe('2030-06-01');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: FAIL — `isIsoDate is not a function` (o error de import similar).

- [ ] **Step 3: Implementación mínima**

Añade al final de `src/lib/day-metrics.ts`:

```ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** true for a real calendar date written as YYYY-MM-DD (rejects 2030-02-31). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD moved by `days` whole days (UTC math: no DST or timezone drift). */
export function shiftIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The admin home's `?date=` param, or `today` when it is missing or not a real date. */
export function parseDayParam(raw: unknown, today: string): string {
  return typeof raw === 'string' && isIsoDate(raw) ? raw : today;
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/day-metrics.ts src/lib/day-metrics.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add ISO date helpers for the day toolbar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Serie de ingresos por hora (`hourlySeries`, `hourLabel`)

**Files:**
- Modify: `src/lib/day-metrics.ts` (añadir al final)
- Test: `src/lib/day-metrics.test.ts` (añadir)

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/day-metrics.test.ts`, cambia la línea de import por:

```ts
import {
  hourLabel, hourlySeries, isIsoDate, occupancyLevel, occupancyPercent, parseDayParam, shiftIsoDate,
} from './day-metrics';
```

y añade al final:

```ts
describe('hourlySeries', () => {
  it('is empty when nobody checked in', () => {
    expect(hourlySeries([])).toEqual([]);
  });

  it('spans first to last check-in hour, filling gaps with zero', () => {
    expect(hourlySeries([
      { hour: 9, people: 3 },
      { hour: 12, people: 5 },
    ])).toEqual([
      { hour: 9, people: 3 },
      { hour: 10, people: 0 },
      { hour: 11, people: 0 },
      { hour: 12, people: 5 },
    ]);
  });

  it('keeps a single hour as a single bucket and does not depend on input order', () => {
    expect(hourlySeries([{ hour: 14, people: 1 }])).toEqual([{ hour: 14, people: 1 }]);
    expect(hourlySeries([{ hour: 11, people: 2 }, { hour: 10, people: 1 }])).toEqual([
      { hour: 10, people: 1 },
      { hour: 11, people: 2 },
    ]);
  });
});

describe('hourLabel', () => {
  it('formats a Caracas hour as HH:00 (24h)', () => {
    expect(hourLabel(0)).toBe('00:00');
    expect(hourLabel(9)).toBe('09:00');
    expect(hourLabel(17)).toBe('17:00');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: FAIL — `hourlySeries is not a function`.

- [ ] **Step 3: Implementación mínima**

Añade al final de `src/lib/day-metrics.ts`:

```ts
/** People checked in during one Caracas hour (0–23). Same shape as DaySummary.checkinsByHour. */
export interface HourBucket {
  hour: number;
  people: number;
}

/**
 * Contiguous hours from the first to the last hour with check-ins, with empty
 * hours as 0, ready for a bar sparkline. Empty input → empty output.
 */
export function hourlySeries(byHour: HourBucket[]): HourBucket[] {
  if (byHour.length === 0) return [];
  const people = new Map(byHour.map((b) => [b.hour, b.people]));
  const hours = byHour.map((b) => b.hour);
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  const series: HourBucket[] = [];
  for (let hour = first; hour <= last; hour++) series.push({ hour, people: people.get(hour) ?? 0 });
  return series;
}

/** "09:00" — label for a Caracas hour bucket. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/day-metrics.ts src/lib/day-metrics.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add hourly check-in series helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `DayMetrics` + `computeDayMetrics` (capacidad efectiva)

**Files:**
- Modify: `src/lib/day-metrics.ts` (imports arriba + código al final)
- Test: `src/lib/day-metrics.test.ts` (añadir)

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/day-metrics.test.ts`, cambia la línea de import por:

```ts
import {
  computeDayMetrics, hourLabel, hourlySeries, isIsoDate, occupancyLevel, occupancyPercent,
  parseDayParam, shiftIsoDate,
} from './day-metrics';
import type { ReservationRow } from '@/lib/db/reservations';
```

y añade al final:

```ts
function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 'r1', code: 'PP-0001', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 0,
    total_usd: 20, bcv_rate: 36.5, total_ves: 730,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T12:00:00Z',
    ...over,
  };
}

describe('computeDayMetrics', () => {
  const rows: ReservationRow[] = [
    row({ adults: 2, children: 1, total_usd: 30, total_ves: 1095 }),                       // confirmed
    row({ status: 'checked_in', adults: 1, children: 0, total_usd: 10, total_ves: 365,
      checked_in_at: '2030-01-15T13:05:00Z' }),                                              // 09:05 Caracas
    row({ status: 'checked_in', adults: 2, children: 2, total_usd: 25.5, total_ves: 930.75,
      checked_in_at: '2030-01-15T15:40:00Z' }),                                              // 11:40 Caracas
    row({ status: 'pending_payment', adults: 3, children: 0, total_usd: 30, total_ves: null }),
    row({ status: 'pending_payment', adults: 1, children: 0, total_usd: 10.1, total_ves: null }),
    row({ status: 'failed', adults: 9, children: 9, total_usd: 999, total_ves: 1 }),       // ignored
  ];

  it('uses settings.daily_capacity when the day has no override', () => {
    const m = computeDayMetrics({
      date: '2030-01-15', rows, dailyCapacity: 100,
      overrides: [{ date: '2030-01-16', capacity: 0, reason: 'Otro día' }],
    });
    expect(m.capacity).toBe(100);
    expect(m.defaultCapacity).toBe(100);
    expect(m.override).toBeNull();
  });

  it('uses the day override (closed day = capacity 0) and keeps its reason', () => {
    const m = computeDayMetrics({
      date: '2030-01-15', rows, dailyCapacity: 100,
      overrides: [{ date: '2030-01-15', capacity: 0, reason: 'Mantenimiento' }],
    });
    expect(m.capacity).toBe(0);
    expect(m.defaultCapacity).toBe(100);
    expect(m.override).toEqual({ capacity: 0, reason: 'Mantenimiento' });
  });

  it('sums people, check-ins, collected and pending money by status', () => {
    const m = computeDayMetrics({ date: '2030-01-15', rows, dailyCapacity: 100, overrides: [] });
    expect(m.confirmedPeople).toBe(8);      // 3 + 1 + 4 (confirmed + checked_in)
    expect(m.checkedInPeople).toBe(5);
    expect(m.checkedInParties).toBe(2);
    expect(m.checkinsByHour).toEqual([{ hour: 9, people: 1 }, { hour: 11, people: 4 }]);
    expect(m.collected).toEqual({ usd: 65.5, ves: 2390.75, count: 3 });
    expect(m.pending).toEqual({ usd: 40.1, count: 2 });
  });

  it('returns zeros for an empty day', () => {
    const m = computeDayMetrics({ date: '2030-01-15', rows: [], dailyCapacity: 80, overrides: [] });
    expect(m).toEqual({
      capacity: 80, defaultCapacity: 80, override: null,
      confirmedPeople: 0, checkedInPeople: 0, checkedInParties: 0, checkinsByHour: [],
      collected: { usd: 0, ves: 0, count: 0 },
      pending: { usd: 0, count: 0 },
    });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts`
Expected: FAIL — `computeDayMetrics is not a function`.

- [ ] **Step 3: Implementación mínima**

Añade al **principio** de `src/lib/day-metrics.ts` (antes de `/** Occupancy color bands`):

```ts
import { bucketCheckinsByHour } from '@/lib/day-stats';
import { roundMoney } from '@/lib/money';
import type { OverrideRow, ReservationRow } from '@/lib/db/reservations';

```

y añade al final del archivo:

```ts
/** Everything the admin "Hoy" view needs for its KPI cards. */
export interface DayMetrics {
  /** Effective capacity: the day's capacity_overrides row if any, else settings.daily_capacity. 0 = closed. */
  capacity: number;
  /** settings.daily_capacity, to explain a special day ("normal: 100"). */
  defaultCapacity: number;
  /** The day's override, or null when it uses the default capacity. */
  override: { capacity: number; reason: string | null } | null;
  /** Adults + children in confirmed + checked_in reservations. */
  confirmedPeople: number;
  checkedInPeople: number;
  checkedInParties: number;
  /** People checked in per Caracas hour (0–23), ascending; empty hours omitted. */
  checkinsByHour: HourBucket[];
  /** Paid (confirmed + checked_in). VES is what was charged at confirmation. */
  collected: { usd: number; ves: number; count: number };
  /** pending_payment (C2P awaiting verification). Their VES is only fixed when confirmed, so USD only. */
  pending: { usd: number; count: number };
}

type MetricsRow = Pick<
  ReservationRow,
  'status' | 'adults' | 'children' | 'total_usd' | 'total_ves' | 'checked_in_at'
>;

const peopleIn = (rows: MetricsRow[]) => rows.reduce((s, r) => s + r.adults + r.children, 0);
const usdIn = (rows: MetricsRow[]) => roundMoney(rows.reduce((s, r) => s + Number(r.total_usd), 0));
const vesIn = (rows: MetricsRow[]) => roundMoney(rows.reduce((s, r) => s + Number(r.total_ves ?? 0), 0));

/** Day KPIs from that day's reservations, the default capacity and the overrides list. */
export function computeDayMetrics(input: {
  date: string;
  rows: MetricsRow[];
  dailyCapacity: number;
  overrides: Pick<OverrideRow, 'date' | 'capacity' | 'reason'>[];
}): DayMetrics {
  const o = input.overrides.find((x) => x.date === input.date) ?? null;
  const paid = input.rows.filter((r) => r.status === 'confirmed' || r.status === 'checked_in');
  const checkedIn = input.rows.filter((r) => r.status === 'checked_in');
  const pending = input.rows.filter((r) => r.status === 'pending_payment');
  return {
    capacity: o ? o.capacity : input.dailyCapacity,
    defaultCapacity: input.dailyCapacity,
    override: o ? { capacity: o.capacity, reason: o.reason } : null,
    confirmedPeople: peopleIn(paid),
    checkedInPeople: peopleIn(checkedIn),
    checkedInParties: checkedIn.length,
    checkinsByHour: bucketCheckinsByHour(input.rows),
    collected: { usd: usdIn(paid), ves: vesIn(paid), count: paid.length },
    pending: { usd: usdIn(pending), count: pending.length },
  };
}
```

Nota: `HourBucket` se declaró en la Task 3 dentro del mismo archivo; las `interface` se elevan, así que usarla aquí arriba no es problema.

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/day-metrics.test.ts && npx tsc --noEmit`
Expected: PASS (23 tests); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/lib/day-metrics.ts src/lib/day-metrics.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): compute day KPIs with the day's effective capacity

The day summary used settings.daily_capacity and ignored capacity
overrides, so closed or special days showed the wrong capacity.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Server action `adminGetDayMetrics`

**Files:**
- Create: `src/app/admin/metrics-actions.ts`
- Test: `src/app/admin/metrics-actions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crea `src/app/admin/metrics-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReservationRow, SettingsRow } from '@/lib/db/reservations';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listReservationsByDate: vi.fn(),
  getSettings: vi.fn(),
  listOverrides: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/reservations', () => ({
  listReservationsByDate: mocks.listReservationsByDate,
  getSettings: mocks.getSettings,
  listOverrides: mocks.listOverrides,
}));

import { adminGetDayMetrics } from './metrics-actions';

const settings: SettingsRow = {
  daily_capacity: 100, adult_price_usd: 10, child_price_usd: 5,
  last_bcv_rate: null, last_bcv_rate_at: null,
};

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 'r1', code: 'PP-0001', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 0,
    total_usd: 20, bcv_rate: 36.5, total_ves: 730,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T12:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'admin@club.com', role: 'operator' });
  mocks.listReservationsByDate.mockResolvedValue([row()]);
  mocks.getSettings.mockResolvedValue(settings);
  mocks.listOverrides.mockResolvedValue([]);
});

function expectNoDataReads() {
  expect(mocks.listReservationsByDate).not.toHaveBeenCalled();
  expect(mocks.getSettings).not.toHaveBeenCalled();
  expect(mocks.listOverrides).not.toHaveBeenCalled();
}

describe('adminGetDayMetrics', () => {
  it('rejects with Unauthorized and never reads data when the gate fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(adminGetDayMetrics('2030-01-15')).rejects.toThrow('Unauthorized');
    expectNoDataReads();
  });

  it('is open to operators (no owner role required)', async () => {
    await adminGetDayMetrics('2030-01-15');
    expect(mocks.requireAdmin).toHaveBeenCalledWith();
  });

  it.each(['hoy', '2030-1-15', '2030-02-31', ''])('rejects the invalid date %j without reading data', async (d) => {
    await expect(adminGetDayMetrics(d)).rejects.toThrow('Invalid date');
    expectNoDataReads();
  });

  it('reads the day and uses the default capacity when there is no override', async () => {
    mocks.listOverrides.mockResolvedValue([{ date: '2030-01-20', capacity: 0, reason: null }]);
    const m = await adminGetDayMetrics('2030-01-15');
    expect(mocks.listReservationsByDate).toHaveBeenCalledWith('2030-01-15');
    expect(m.capacity).toBe(100);
    expect(m.override).toBeNull();
    expect(m.confirmedPeople).toBe(2);
    expect(m.collected).toEqual({ usd: 20, ves: 730, count: 1 });
  });

  it("uses the day's override so a closed day reports capacity 0", async () => {
    mocks.listOverrides.mockResolvedValue([{ date: '2030-01-15', capacity: 0, reason: 'Mantenimiento' }]);
    const m = await adminGetDayMetrics('2030-01-15');
    expect(m.capacity).toBe(0);
    expect(m.defaultCapacity).toBe(100);
    expect(m.override).toEqual({ capacity: 0, reason: 'Mantenimiento' });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/metrics-actions.test.ts`
Expected: FAIL — `Failed to resolve import "./metrics-actions"`.

- [ ] **Step 3: Implementación mínima**

Crea `src/app/admin/metrics-actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSettings, listOverrides, listReservationsByDate } from '@/lib/db/reservations';
import { computeDayMetrics, isIsoDate, type DayMetrics } from '@/lib/day-metrics';

const dateSchema = z.string().refine(isIsoDate);

/**
 * KPIs for the admin "Hoy" view. Read-only (no audit entry). Unlike
 * adminGetDaySummary, capacity is the day's effective capacity
 * (capacity_overrides first), so closed and special days are right.
 */
export async function adminGetDayMetrics(date: string): Promise<DayMetrics> {
  await requireAdmin();
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) throw new Error('Invalid date');
  const day = parsed.data;
  const [rows, settings, overrides] = await Promise.all([
    listReservationsByDate(day),
    getSettings(),
    listOverrides(),
  ]);
  return computeDayMetrics({ date: day, rows, dailyCapacity: settings.daily_capacity, overrides });
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/metrics-actions.test.ts && npx tsc --noEmit`
Expected: PASS (8 tests); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/metrics-actions.ts src/app/admin/metrics-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add adminGetDayMetrics server action

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Tarjeta de Ocupación (gauge radial accesible)

**Files:**
- Modify: `src/components/admin/metric-cards.tsx` (imports + código nuevo antes del `MetricGrid` antiguo, que se conserva hasta la Task 10)
- Test: `src/components/admin/metric-cards.test.tsx` (reescribir)

- [ ] **Step 1: Escribir el test que falla**

Reemplaza TODO el contenido de `src/components/admin/metric-cards.test.tsx` por (los dos tests antiguos se conservan en un `describe` "legacy" hasta la Task 10):

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MetricGrid, OccupancyCard } from './metric-cards';
import type { DaySummary } from '@/app/admin/actions';
import type { DayMetrics } from '@/lib/day-metrics';

const metrics: DayMetrics = {
  capacity: 100, defaultCapacity: 100, override: null,
  confirmedPeople: 5, checkedInPeople: 1, checkedInParties: 1, checkinsByHour: [],
  collected: { usd: 65, ves: 2390.05, count: 2 },
  pending: { usd: 0, count: 0 },
};
const m = (over: Partial<DayMetrics> = {}): DayMetrics => ({ ...metrics, ...over });

describe('OccupancyCard', () => {
  it.each<[number, string, string, string]>([
    [0, 'normal', 'stroke-teal', 'Normal'],
    [70, 'normal', 'stroke-teal', 'Normal'],
    [71, 'high', 'stroke-amber-500', 'Alta demanda'],
    [90, 'high', 'stroke-amber-500', 'Alta demanda'],
    [91, 'peak', 'stroke-coral', 'Casi lleno'],
    [100, 'peak', 'stroke-coral', 'Lleno'],
  ])('%i of 100 people → %s band', (people, level, stroke, label) => {
    render(<OccupancyCard metrics={m({ confirmedPeople: people })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(card).toHaveAttribute('data-level', level);
    expect(within(card).getByTestId('occupancy-arc')).toHaveClass(stroke);
    expect(within(card).getByText(label)).toBeInTheDocument();
    const meter = within(card).getByRole('meter', { name: 'Ocupación del día' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuenow', String(people));
    expect(meter).toHaveAttribute('aria-valuetext', `${people} de 100 personas (${people} %)`);
    expect(card).toHaveTextContent(`${people} / 100`);
  });

  it('decides the band on the rounded percent it shows (70.5 % → 71 % → amber)', () => {
    render(<OccupancyCard metrics={m({ capacity: 200, defaultCapacity: 200, confirmedPeople: 141 })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(card).toHaveAttribute('data-level', 'high');
    expect(within(card).getByText('71 %')).toBeInTheDocument();
  });

  it('clamps the meter and fills the arc when overbooked, but tells the real number', () => {
    render(<OccupancyCard metrics={m({ confirmedPeople: 120 })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    const meter = within(card).getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter).toHaveAttribute('aria-valuetext', '120 de 100 personas (120 %)');
    expect(within(card).getByTestId('occupancy-arc')).toHaveAttribute('stroke-dashoffset', '0');
    expect(within(card).getByText('Lleno')).toBeInTheDocument();
  });

  it('shows "Cerrado" and no meter on a day closed by an override (capacity 0)', () => {
    render(<OccupancyCard metrics={m({
      capacity: 0, override: { capacity: 0, reason: 'Mantenimiento' }, confirmedPeople: 0,
    })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(card).toHaveAttribute('data-level', 'closed');
    expect(within(card).getByText('Cerrado')).toBeInTheDocument();
    expect(within(card).getByText('Día cerrado por excepción · Mantenimiento')).toBeInTheDocument();
    expect(within(card).queryByRole('meter')).toBeNull();
    expect(within(card).queryByText(/con reserva este día/)).toBeNull();
  });

  it('warns about people still booked on a closed day', () => {
    render(<OccupancyCard metrics={m({
      capacity: 0, override: { capacity: 0, reason: null }, confirmedPeople: 3,
    })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(within(card).getByText('Día cerrado por excepción')).toBeInTheDocument();
    expect(within(card).getByText('3 personas con reserva este día')).toBeInTheDocument();
  });

  it('explains a closed day that comes from a default capacity of 0', () => {
    render(<OccupancyCard metrics={m({ capacity: 0, defaultCapacity: 0, override: null, confirmedPeople: 0 })} />);
    expect(screen.getByText('La capacidad diaria está en 0')).toBeInTheDocument();
  });

  it('measures against a special-capacity day and explains it', () => {
    render(<OccupancyCard metrics={m({
      capacity: 50, override: { capacity: 50, reason: 'Evento privado' }, confirmedPeople: 25,
    })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(within(card).getByRole('meter')).toHaveAttribute('aria-valuemax', '50');
    expect(within(card).getByText('50 %')).toBeInTheDocument();
    expect(within(card).getByText('Capacidad especial (normal: 100) · Evento privado')).toBeInTheDocument();
  });
});

// Legacy grid (DaySummary) — replaced in Task 10.
const summary: DaySummary = {
  capacity: 100, confirmedPeople: 5, checkedInParties: 1, checkedInPeople: 1,
  revenueUsd: 65, revenueVes: 2390.05, paidCount: 2, pendingCount: 0,
  checkinsByHour: [],
};

describe('MetricGrid (legacy)', () => {
  it('shows occupancy, arrivals, revenue and "Todo al día" when no pending', () => {
    render(<MetricGrid summary={summary} onReviewPending={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
    expect(screen.getByText('$65.00')).toBeInTheDocument();
    expect(screen.getByText(/Todo al día/i)).toBeInTheDocument();
  });
  it('shows "Requiere atención" and a review button when pending > 0', () => {
    render(<MetricGrid summary={{ ...summary, pendingCount: 3 }} onReviewPending={() => {}} />);
    expect(screen.getByText(/Requiere atención/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar pagos/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx`
Expected: FAIL — los tests de `OccupancyCard` fallan con `Element type is invalid` / `OccupancyCard is not a function` (no existe aún); los 2 legacy pasan.

- [ ] **Step 3: Implementación mínima**

En `src/components/admin/metric-cards.tsx`, reemplaza la línea

```ts
import type { DaySummary } from '@/app/admin/actions';
```

por este bloque (imports + código nuevo; el resto del archivo —`function Metric`, `occupancyTone`, `MetricGrid` antiguos— queda igual debajo):

```tsx
import { useId } from 'react';
import { CalendarX2, Users, type LucideIcon } from 'lucide-react';
import type { DaySummary } from '@/app/admin/actions';
import {
  occupancyLevel, occupancyPercent, type DayMetrics, type OccupancyLevel,
} from '@/lib/day-metrics';
import { cn } from '@/lib/utils';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** KPI card shell: a labelled region (h2) so screen readers and tests can find each card by name. */
function MetricCard(props: {
  title: string;
  icon: LucideIcon;
  level?: string;
  alert?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const Icon = props.icon;
  return (
    <section
      aria-labelledby={titleId}
      data-level={props.level}
      className={cn(
        'flex min-h-44 flex-col rounded-2xl border bg-white p-4 shadow-sm',
        props.alert && 'border-amber-300 bg-amber-50',
      )}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        {props.title}
      </h2>
      <div className="mt-3 flex flex-1 flex-col">{props.children}</div>
    </section>
  );
}

const LEVEL_STROKE: Record<OccupancyLevel, string> = {
  normal: 'stroke-teal',
  high: 'stroke-amber-500',
  peak: 'stroke-coral',
};

const LEVEL_CHIP: Record<OccupancyLevel, string> = {
  normal: 'bg-mint text-navy',
  high: 'bg-amber-100 text-amber-800',
  peak: 'bg-coral/15 text-red-800',
};

function levelLabel(percent: number): string {
  if (percent >= 100) return 'Lleno';
  const level = occupancyLevel(percent);
  if (level === 'peak') return 'Casi lleno';
  if (level === 'high') return 'Alta demanda';
  return 'Normal';
}

const GAUGE_R = 30;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

/** Decorative radial gauge; the accessible value lives on the role="meter" wrapper. */
function RadialGauge(props: { percent: number; level: OccupancyLevel }) {
  const fill = Math.min(100, Math.max(0, props.percent));
  return (
    <svg viewBox="0 0 72 72" aria-hidden className="size-20 -rotate-90">
      <circle cx="36" cy="36" r={GAUGE_R} fill="none" strokeWidth="8" className="stroke-slate-200" />
      <circle
        data-testid="occupancy-arc"
        cx="36" cy="36" r={GAUGE_R} fill="none" strokeWidth="8"
        strokeLinecap={fill > 0 ? 'round' : 'butt'}
        strokeDasharray={GAUGE_C}
        strokeDashoffset={GAUGE_C * (1 - fill / 100)}
        className={cn(LEVEL_STROKE[props.level], 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500')}
      />
    </svg>
  );
}

export function OccupancyCard(props: { metrics: DayMetrics }) {
  const { capacity, defaultCapacity, override, confirmedPeople: people } = props.metrics;
  const percent = occupancyPercent(people, capacity);

  if (percent === null) {
    const why = override
      ? `Día cerrado por excepción${override.reason ? ` · ${override.reason}` : ''}`
      : 'La capacidad diaria está en 0';
    return (
      <MetricCard title="Ocupación" icon={Users} level="closed">
        <p className="flex items-center gap-2 text-2xl font-extrabold text-navy">
          <CalendarX2 aria-hidden className="size-6 text-coral" />
          Cerrado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{why}</p>
        {people > 0 && (
          <p className="mt-2 text-sm font-semibold text-red-800">
            {plural(people, 'persona', 'personas')} con reserva este día
          </p>
        )}
      </MetricCard>
    );
  }

  const level = occupancyLevel(percent);
  return (
    <MetricCard title="Ocupación" icon={Users} level={level}>
      <div className="flex items-center gap-4">
        <div
          role="meter"
          aria-label="Ocupación del día"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={Math.min(people, capacity)}
          aria-valuetext={`${people} de ${capacity} personas (${percent} %)`}
          className="relative size-20 shrink-0"
        >
          <RadialGauge percent={percent} level={level} />
          <span aria-hidden className="absolute inset-0 grid place-items-center text-base font-extrabold text-navy">
            {percent} %
          </span>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-navy">
            {people}<span className="text-sm font-normal text-muted-foreground"> / {capacity}</span>
          </p>
          <p className="text-xs text-muted-foreground">personas confirmadas</p>
          <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', LEVEL_CHIP[level])}>
            {levelLabel(percent)}
          </span>
        </div>
      </div>
      {override && (
        <p className="mt-auto pt-3 text-xs text-muted-foreground">
          {`Capacidad especial (normal: ${defaultCapacity})${override.reason ? ` · ${override.reason}` : ''}`}
        </p>
      )}
    </MetricCard>
  );
}

```

Notas: el texto "71 %" del centro es `aria-hidden` (el valor accesible está en `aria-valuetext`), pero `getByText` lo encuentra igual. El contraste del texto no depende del color de la banda: el número va en `text-navy` y el color sólo pinta el arco y el chip (teal sobre blanco no llega a 3:1 como texto).

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx && npx tsc --noEmit`
Expected: PASS (14 tests: 12 de `OccupancyCard` + 2 legacy); `tsc` sin salida.

Si `getByRole('meter')` no encontrara el elemento (versión de `aria-query` sin el rol `meter`), NO cambies el rol: comprueba `npm ls aria-query` (debe ser ≥ 5.3, al escribir este plan es 5.3.2, que sí lo incluye).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/metric-cards.tsx src/components/admin/metric-cards.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add occupancy KPI card with banded radial gauge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Tarjeta de Check-ins con tendencia por hora

**Files:**
- Modify: `src/components/admin/metric-cards.tsx`
- Test: `src/components/admin/metric-cards.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

En `src/components/admin/metric-cards.test.tsx`, cambia

```tsx
import { MetricGrid, OccupancyCard } from './metric-cards';
```

por

```tsx
import { CheckinsCard, MetricGrid, OccupancyCard } from './metric-cards';
```

y añade, justo antes de la línea `// Legacy grid (DaySummary) — replaced in Task 10.`:

```tsx
describe('CheckinsCard', () => {
  it('shows checked-in vs confirmed people, the ratio and the parties', () => {
    render(<CheckinsCard metrics={m({ confirmedPeople: 8, checkedInPeople: 4, checkedInParties: 2 })} />);
    const card = screen.getByRole('region', { name: 'Check-ins' });
    expect(card).toHaveTextContent('4 / 8 personas');
    expect(card).toHaveTextContent('50 % ya ingresó · 2 grupos');
  });

  it('uses 0 % and singular wording without dividing by zero', () => {
    render(<CheckinsCard metrics={m({ confirmedPeople: 0, checkedInPeople: 0, checkedInParties: 1 })} />);
    expect(screen.getByRole('region', { name: 'Check-ins' })).toHaveTextContent('0 % ya ingresó · 1 grupo');
  });

  it('shows an empty state instead of a chart when nobody has checked in', () => {
    render(<CheckinsCard metrics={m({ checkinsByHour: [] })} />);
    const card = screen.getByRole('region', { name: 'Check-ins' });
    expect(within(card).getByText('Aún no hay ingresos registrados.')).toBeInTheDocument();
    expect(within(card).queryByRole('list')).toBeNull();
  });

  it('draws one bar per hour (gaps filled), scaled to the busiest hour, with text for screen readers', () => {
    render(<CheckinsCard metrics={m({
      checkinsByHour: [{ hour: 9, people: 3 }, { hour: 11, people: 5 }],
    })} />);
    const card = screen.getByRole('region', { name: 'Check-ins' });
    const list = within(card).getByRole('list', { name: 'Ingresos por hora (hora de Caracas)' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('09:00: 3 personas')).toBeInTheDocument();
    expect(within(items[1]).getByText('10:00: 0 personas')).toBeInTheDocument();
    expect(within(items[2]).getByText('11:00: 5 personas')).toBeInTheDocument();
    expect(within(items[0]).getByTestId('hour-bar')).toHaveStyle({ height: '60%' });
    expect(within(items[2]).getByTestId('hour-bar')).toHaveStyle({ height: '100%' });
    expect(within(card).getByText('Hora pico: 11:00 (5 personas)')).toBeInTheDocument();
  });

  it('uses singular wording for a single person in an hour', () => {
    render(<CheckinsCard metrics={m({ checkinsByHour: [{ hour: 14, people: 1 }] })} />);
    expect(screen.getByText('14:00: 1 persona')).toBeInTheDocument();
    expect(screen.getByText('Hora pico: 14:00 (1 persona)')).toBeInTheDocument();
  });
});

```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx`
Expected: FAIL — los 5 tests de `CheckinsCard` fallan (`CheckinsCard` no existe).

- [ ] **Step 3: Implementación mínima**

En `src/components/admin/metric-cards.tsx`, reemplaza el bloque de imports nuevo:

```tsx
import { CalendarX2, Users, type LucideIcon } from 'lucide-react';
import type { DaySummary } from '@/app/admin/actions';
import {
  occupancyLevel, occupancyPercent, type DayMetrics, type OccupancyLevel,
} from '@/lib/day-metrics';
```

por

```tsx
import { CalendarX2, DoorOpen, Users, type LucideIcon } from 'lucide-react';
import type { DaySummary } from '@/app/admin/actions';
import {
  hourLabel, hourlySeries, occupancyLevel, occupancyPercent, type DayMetrics, type OccupancyLevel,
} from '@/lib/day-metrics';
```

y añade, justo antes de la línea `function Metric(props: { label: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {`:

```tsx
/** Tiny inline bar sparkline (no chart lib). Bars are decorative; each hour has sr-only text. */
function HourlyBars(props: { byHour: DayMetrics['checkinsByHour'] }) {
  const series = hourlySeries(props.byHour);
  const max = Math.max(...series.map((b) => b.people));
  const peak = series.find((b) => b.people === max)!;
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <div className="mt-auto pt-3">
      <ul role="list" aria-label="Ingresos por hora (hora de Caracas)" className="flex h-10 items-end gap-0.5">
        {series.map((b) => (
          <li key={b.hour} className="flex h-full flex-1 items-end" title={`${hourLabel(b.hour)} · ${plural(b.people, 'persona', 'personas')}`}>
            <span
              data-testid="hour-bar"
              aria-hidden
              className={cn('w-full rounded-sm', b.people > 0 ? 'bg-teal' : 'bg-slate-200')}
              style={{ height: b.people > 0 ? `${Math.max(10, Math.round((b.people / max) * 100))}%` : '2px' }}
            />
            <span className="sr-only">{`${hourLabel(b.hour)}: ${plural(b.people, 'persona', 'personas')}`}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{hourLabel(first.hour)}</span>
        {last.hour !== first.hour && <span>{hourLabel(last.hour)}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {`Hora pico: ${hourLabel(peak.hour)} (${plural(peak.people, 'persona', 'personas')})`}
      </p>
    </div>
  );
}

export function CheckinsCard(props: { metrics: DayMetrics }) {
  const { checkedInPeople, confirmedPeople, checkedInParties, checkinsByHour } = props.metrics;
  const ratio = confirmedPeople > 0 ? Math.round((checkedInPeople / confirmedPeople) * 100) : 0;
  return (
    <MetricCard title="Check-ins" icon={DoorOpen}>
      <p className="text-2xl font-extrabold text-navy">
        {checkedInPeople}
        <span className="text-sm font-normal text-muted-foreground"> / {confirmedPeople} personas</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {`${ratio} % ya ingresó · ${plural(checkedInParties, 'grupo', 'grupos')}`}
      </p>
      {checkinsByHour.length === 0 ? (
        <p className="mt-auto pt-3 text-xs text-muted-foreground">Aún no hay ingresos registrados.</p>
      ) : (
        <HourlyBars byHour={checkinsByHour} />
      )}
    </MetricCard>
  );
}

```

(`role="list"` explícito porque Safari quita el rol de lista a un `<ul>` con `list-style: none`, que es lo que pone el preflight de Tailwind.)

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx && npx tsc --noEmit`
Expected: PASS (19 tests); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/metric-cards.tsx src/components/admin/metric-cards.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add check-ins KPI card with hourly sparkline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Tarjeta de Ingresos (USD + Bs., cobrado vs por verificar)

**Files:**
- Modify: `src/components/admin/metric-cards.tsx`
- Test: `src/components/admin/metric-cards.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

En `src/components/admin/metric-cards.test.tsx`, cambia

```tsx
import { CheckinsCard, MetricGrid, OccupancyCard } from './metric-cards';
```

por

```tsx
import { CheckinsCard, MetricGrid, OccupancyCard, RevenueCard } from './metric-cards';
```

y añade, justo antes de `// Legacy grid (DaySummary) — replaced in Task 10.`:

```tsx
describe('RevenueCard', () => {
  it('shows collected USD as primary and Bs. as secondary', () => {
    render(<RevenueCard metrics={m()} />);
    const card = screen.getByRole('region', { name: 'Ingresos' });
    expect(within(card).getByTestId('revenue-usd')).toHaveTextContent('$65.00');
    expect(within(card).getByText('Bs. 2390.05')).toBeInTheDocument();
  });

  it('splits the money by payment status', () => {
    render(<RevenueCard metrics={m({ pending: { usd: 30, count: 1 } })} />);
    const card = screen.getByRole('region', { name: 'Ingresos' });
    expect(within(card).getByText('Cobrado · 2 reservas').parentElement).toHaveTextContent('$65.00');
    expect(within(card).getByText('Por verificar · 1 pago').parentElement).toHaveTextContent('$30.00');
    expect(within(card).getByText('El monto en Bs. de los pagos por verificar se fija al confirmarlos.')).toBeInTheDocument();
  });

  it('shows $0.00 pending and no Bs. note when nothing awaits verification', () => {
    render(<RevenueCard metrics={m({ collected: { usd: 10, ves: 1234.5, count: 1 } })} />);
    const card = screen.getByRole('region', { name: 'Ingresos' });
    expect(within(card).getByText('Bs. 1234.50')).toBeInTheDocument();
    expect(within(card).getByText('Cobrado · 1 reserva').parentElement).toHaveTextContent('$10.00');
    expect(within(card).getByText('Por verificar · 0 pagos').parentElement).toHaveTextContent('$0.00');
    expect(within(card).queryByText(/se fija al confirmarlos/)).toBeNull();
  });
});

```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx`
Expected: FAIL — los 3 tests de `RevenueCard` fallan (`RevenueCard` no existe).

- [ ] **Step 3: Implementación mínima**

En `src/components/admin/metric-cards.tsx`, cambia

```tsx
import { CalendarX2, DoorOpen, Users, type LucideIcon } from 'lucide-react';
```

por

```tsx
import { CalendarX2, DoorOpen, Users, Wallet, type LucideIcon } from 'lucide-react';
```

cambia

```tsx
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
```

por

```tsx
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const usd = (n: number) => `$${n.toFixed(2)}`;
const ves = (n: number) => `Bs. ${n.toFixed(2)}`;
```

y añade, justo antes de `function Metric(props: { label: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {`:

```tsx
export function RevenueCard(props: { metrics: DayMetrics }) {
  const { collected, pending } = props.metrics;
  return (
    <MetricCard title="Ingresos" icon={Wallet}>
      <p data-testid="revenue-usd" className="text-2xl font-extrabold text-navy">{usd(collected.usd)}</p>
      <p className="text-sm text-muted-foreground">{ves(collected.ves)}</p>
      <dl className="mt-auto space-y-1 pt-3 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{`Cobrado · ${plural(collected.count, 'reserva', 'reservas')}`}</dt>
          <dd className="font-semibold text-navy">{usd(collected.usd)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{`Por verificar · ${plural(pending.count, 'pago', 'pagos')}`}</dt>
          <dd className="font-semibold text-amber-800">{usd(pending.usd)}</dd>
        </div>
      </dl>
      {pending.count > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          El monto en Bs. de los pagos por verificar se fija al confirmarlos.
        </p>
      )}
    </MetricCard>
  );
}

```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx && npx tsc --noEmit`
Expected: PASS (22 tests); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/metric-cards.tsx src/components/admin/metric-cards.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add revenue KPI card split by payment status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Tarjeta "Cola C2P" (ámbar, badge pulsante, botón de revisión)

**Files:**
- Modify: `src/components/admin/metric-cards.tsx`
- Test: `src/components/admin/metric-cards.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

En `src/components/admin/metric-cards.test.tsx`, cambia las líneas de import

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CheckinsCard, MetricGrid, OccupancyCard, RevenueCard } from './metric-cards';
```

por

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { C2PQueueCard, CheckinsCard, MetricGrid, OccupancyCard, RevenueCard } from './metric-cards';
```

y añade, justo antes de `// Legacy grid (DaySummary) — replaced in Task 10.`:

```tsx
describe('C2PQueueCard', () => {
  it('is calm with "Todo al día" and no action when nothing is pending', () => {
    render(<C2PQueueCard metrics={m()} onReviewPending={() => {}} />);
    const card = screen.getByRole('region', { name: 'Cola C2P' });
    expect(card).not.toHaveClass('bg-amber-50');
    expect(within(card).getByText('Todo al día')).toBeInTheDocument();
    expect(within(card).queryByRole('button')).toBeNull();
    expect(within(card).queryByTestId('c2p-pulse')).toBeNull();
  });

  it('turns amber with a motion-safe pulsing badge and the amount waiting', () => {
    render(<C2PQueueCard metrics={m({ pending: { usd: 45, count: 3 } })} onReviewPending={() => {}} />);
    const card = screen.getByRole('region', { name: 'Cola C2P' });
    expect(card).toHaveClass('bg-amber-50');
    expect(card).toHaveTextContent('3 pagos por verificar');
    expect(within(card).getByText('$45.00 en espera de conciliación bancaria')).toBeInTheDocument();
    const ping = within(card).getByTestId('c2p-pulse').firstElementChild;
    expect(ping).toHaveClass('motion-safe:animate-ping');
    expect(ping).not.toHaveClass('animate-ping');
  });

  it('uses singular wording for one pending payment', () => {
    render(<C2PQueueCard metrics={m({ pending: { usd: 10, count: 1 } })} onReviewPending={() => {}} />);
    expect(screen.getByRole('region', { name: 'Cola C2P' })).toHaveTextContent('1 pago por verificar');
  });

  it('"Revisar C2P pendientes" is a 44px button that calls onReviewPending', async () => {
    const onReview = vi.fn();
    render(<C2PQueueCard metrics={m({ pending: { usd: 45, count: 3 } })} onReviewPending={onReview} />);
    const button = screen.getByRole('button', { name: 'Revisar C2P pendientes' });
    expect(button).toHaveClass('h-11');
    await userEvent.click(button);
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});

```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx`
Expected: FAIL — los 4 tests de `C2PQueueCard` fallan (`C2PQueueCard` no existe).

- [ ] **Step 3: Implementación mínima**

En `src/components/admin/metric-cards.tsx`, cambia

```tsx
import { CalendarX2, DoorOpen, Users, Wallet, type LucideIcon } from 'lucide-react';
```

por

```tsx
import { CalendarX2, CircleCheck, DoorOpen, Smartphone, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMIN_ACTION } from './ui-constants';
```

y añade, justo antes de `function Metric(props: { label: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {`:

```tsx
export function C2PQueueCard(props: { metrics: DayMetrics; onReviewPending: () => void }) {
  const { count, usd: amount } = props.metrics.pending;

  if (count === 0) {
    return (
      <MetricCard title="Cola C2P" icon={Smartphone}>
        <p className="text-2xl font-extrabold text-navy">0</p>
        <p className="text-xs text-muted-foreground">pagos por verificar</p>
        <p className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-green-700">
          <CircleCheck aria-hidden className="size-4" />
          Todo al día
        </p>
      </MetricCard>
    );
  }

  return (
    <MetricCard title="Cola C2P" icon={Smartphone} alert>
      <div className="flex items-center gap-2">
        <span data-testid="c2p-pulse" aria-hidden className="relative flex size-3">
          <span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
        </span>
        {/* one <p> with an explicit space so the text reads "3 pagos por verificar" */}
        <p className="flex items-baseline gap-1.5 text-amber-800">
          <span className="text-2xl font-extrabold">{count}</span>{' '}
          <span className="text-sm font-semibold">{count === 1 ? 'pago por verificar' : 'pagos por verificar'}</span>
        </p>
      </div>
      <p className="text-xs text-amber-900">{`${usd(amount)} en espera de conciliación bancaria`}</p>
      <div className="mt-auto pt-3">
        <Button
          type="button"
          onClick={props.onReviewPending}
          className={cn(ADMIN_ACTION, 'w-full bg-amber-600 text-white hover:bg-amber-700')}
        >
          Revisar C2P pendientes
        </Button>
      </div>
    </MetricCard>
  );
}

```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx && npx tsc --noEmit`
Expected: PASS (26 tests); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/metric-cards.tsx src/components/admin/metric-cards.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add C2P verification queue KPI card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Nuevo `MetricGrid` sobre `DayMetrics` + página `/admin`

Cambia de golpe el contrato de `MetricGrid` (de `DaySummary` a `DayMetrics`), la página y las props de `AdminDayView`, para que `tsc` nunca quede en rojo entre commits.

**Files:**
- Modify: `src/components/admin/metric-cards.tsx` (borrar el grid legacy)
- Modify: `src/components/admin/metric-cards.test.tsx` (reemplazar el bloque legacy)
- Modify: `src/components/admin/day-view.tsx` (props mínimas)
- Modify: `src/app/admin/(dashboard)/page.tsx`
- Test: `src/app/admin/(dashboard)/page.test.ts` (crear)

- [ ] **Step 1: Escribir los tests que fallan**

(a) En `src/components/admin/metric-cards.test.tsx`, borra la línea

```tsx
import type { DaySummary } from '@/app/admin/actions';
```

y reemplaza TODO el bloque desde `// Legacy grid (DaySummary) — replaced in Task 10.` hasta el final del archivo por:

```tsx
describe('MetricGrid', () => {
  it('renders the four KPI cards in operating order', () => {
    render(<MetricGrid metrics={m()} onReviewPending={() => {}} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Ocupación', 'Check-ins', 'Ingresos', 'Cola C2P',
    ]);
  });

  it('wires "Revisar C2P pendientes" to onReviewPending', async () => {
    const onReview = vi.fn();
    render(<MetricGrid metrics={m({ pending: { usd: 20, count: 2 } })} onReviewPending={onReview} />);
    await userEvent.click(screen.getByRole('button', { name: 'Revisar C2P pendientes' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});
```

(b) Crea `src/app/admin/(dashboard)/page.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { todayCaracas } from '@/lib/dates';

const mocks = vi.hoisted(() => ({
  adminListReservations: vi.fn(),
  adminGetDayMetrics: vi.fn(),
}));

vi.mock('@/app/admin/actions', () => ({ adminListReservations: mocks.adminListReservations }));
vi.mock('@/app/admin/metrics-actions', () => ({ adminGetDayMetrics: mocks.adminGetDayMetrics }));
vi.mock('@/components/admin/day-view', () => ({ AdminDayView: () => null }));

import AdminHome from './page';

const run = (params: { date?: string }) => AdminHome({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminListReservations.mockResolvedValue([]);
  mocks.adminGetDayMetrics.mockResolvedValue({ marker: 'metrics' });
});

describe('admin home page', () => {
  it('loads rows and metrics for a valid ?date= and keys the view by date', async () => {
    const el = await run({ date: '2030-01-15' });
    expect(mocks.adminListReservations).toHaveBeenCalledWith('2030-01-15');
    expect(mocks.adminGetDayMetrics).toHaveBeenCalledWith('2030-01-15');
    expect(el.key).toBe('2030-01-15');
    expect(el.props).toMatchObject({
      date: '2030-01-15', today: todayCaracas(), rows: [], metrics: { marker: 'metrics' },
    });
  });

  it.each([{}, { date: 'hoy' }, { date: '2030-02-31' }])('falls back to today (Caracas) for %j', async (params) => {
    const today = todayCaracas();
    const el = await run(params);
    expect(mocks.adminGetDayMetrics).toHaveBeenCalledWith(today);
    expect(el.props).toMatchObject({ date: today, today });
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx 'src/app/admin/(dashboard)/page.test.ts'`
Expected: FAIL — `MetricGrid` todavía espera `summary` (renderiza el grid legacy: los headings no coinciden y falta el botón "Revisar C2P pendientes"); `page.test.ts` falla porque la página llama a `adminGetDaySummary` (no mockeado → `undefined is not a function`) y no pasa `today`/`metrics`.

- [ ] **Step 3: Implementación**

(a) `src/components/admin/metric-cards.tsx`: borra la línea

```tsx
import type { DaySummary } from '@/app/admin/actions';
```

y reemplaza TODO desde `function Metric(props: { label: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {` hasta el final del archivo (es decir, `Metric`, `occupancyTone` y el `MetricGrid` antiguo) por:

```tsx
export function MetricGrid(props: { metrics: DayMetrics; onReviewPending: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <OccupancyCard metrics={props.metrics} />
      <CheckinsCard metrics={props.metrics} />
      <RevenueCard metrics={props.metrics} />
      <C2PQueueCard metrics={props.metrics} onReviewPending={props.onReviewPending} />
    </div>
  );
}
```

(b) `src/components/admin/day-view.tsx` (cambios mínimos; la barra de fecha llega en la Task 11):

- Reemplaza `import { adminCheckIn, adminResendVoucher, type DaySummary } from '@/app/admin/actions';` por:
  ```tsx
  import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
  import type { DayMetrics } from '@/lib/day-metrics';
  ```
- Reemplaza `import { longDateEs, todayCaracas } from '@/lib/dates';` por `import { longDateEs } from '@/lib/dates';`
- Reemplaza `export function AdminDayView(props: { date: string; rows: ReservationRow[]; summary: DaySummary }) {` por:
  ```tsx
  export function AdminDayView(props: { date: string; today: string; rows: ReservationRow[]; metrics: DayMetrics }) {
  ```
- Reemplaza `const today = todayCaracas();` por `const today = props.today;`
- Reemplaza `<MetricGrid summary={props.summary} onReviewPending={() => setChip('pending_payment')} />` por:
  ```tsx
  <MetricGrid metrics={props.metrics} onReviewPending={() => setChip('pending_payment')} />
  ```

(c) Reemplaza TODO `src/app/admin/(dashboard)/page.tsx` por:

```tsx
import { adminListReservations } from '../actions';
import { adminGetDayMetrics } from '../metrics-actions';
import { AdminDayView } from '@/components/admin/day-view';
import { todayCaracas } from '@/lib/dates';
import { parseDayParam } from '@/lib/day-metrics';

export const dynamic = 'force-dynamic';

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: rawDate } = await searchParams;
  const today = todayCaracas();
  const date = parseDayParam(rawDate, today);
  const [rows, metrics] = await Promise.all([
    adminListReservations(date),
    adminGetDayMetrics(date),
  ]);

  // key: a new day starts with fresh view state (chip "Todas", no toast).
  return <AdminDayView key={date} date={date} today={today} rows={rows} metrics={metrics} />;
}
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/metric-cards.test.tsx 'src/app/admin/(dashboard)/page.test.ts' && npx tsc --noEmit && npm test`
Expected: PASS (`metric-cards`: 26 tests; `page.test.ts`: 4 tests); `tsc` sin salida; toda la suite en verde (incluido `src/app/admin/actions.test.ts`, que sigue probando `adminGetDaySummary` sin cambios).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/metric-cards.tsx src/components/admin/metric-cards.test.tsx src/components/admin/day-view.tsx 'src/app/admin/(dashboard)/page.tsx' 'src/app/admin/(dashboard)/page.test.ts'
git commit -m "$(cat <<'EOF'
feat(admin): drive the day KPI grid from adminGetDayMetrics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Barra de fecha (Ayer · Hoy · Mañana) y "Revisar C2P pendientes" → lista filtrada

**Files:**
- Modify: `src/components/admin/day-view.tsx` (reescribir)
- Test: `src/components/admin/day-view.test.tsx` (crear)

- [ ] **Step 1: Escribir el test que falla**

Crea `src/components/admin/day-view.test.tsx`. La tabla de reservas pertenece al PR 10, así que se sustituye por un stub que sólo expone el chip recibido: estos tests cubren el cableado propio de la vista.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DayMetrics } from '@/lib/day-metrics';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/app/admin/actions', () => ({ adminCheckIn: vi.fn(), adminResendVoucher: vi.fn() }));
vi.mock('./reservations-table', async () => {
  const { createElement } = await import('react');
  return {
    ReservationsTable: (p: { chip?: string }) =>
      createElement('div', { 'data-testid': 'reservations-table', 'data-chip': p.chip }),
  };
});

import { AdminDayView } from './day-view';

const metrics: DayMetrics = {
  capacity: 100, defaultCapacity: 100, override: null,
  confirmedPeople: 10, checkedInPeople: 2, checkedInParties: 1, checkinsByHour: [],
  collected: { usd: 100, ves: 3650, count: 3 },
  pending: { usd: 30, count: 2 },
};

function renderView(date: string, today = '2030-01-15') {
  render(<AdminDayView date={date} today={today} rows={[]} metrics={metrics} />);
  return screen.getByRole('group', { name: 'Elegir día' });
}

const scrollIntoView = vi.fn();
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('AdminDayView — date toolbar', () => {
  it('on today: title "Hoy" and the Hoy jumper is the active (current) date', () => {
    const toolbar = renderView('2030-01-15');
    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'date');
  });

  it('shows the long Caracas date with first-letter uppercase (not capitalize)', () => {
    renderView('2030-01-10');
    const subtitle = screen.getByText(/10 de enero/);
    expect(subtitle).toHaveClass('first-letter:uppercase');
    expect(subtitle).not.toHaveClass('capitalize');
  });

  it('‹ Ayer and Mañana › move one day from the shown date via ?date=', async () => {
    const toolbar = renderView('2030-03-01', '2030-03-05');
    await userEvent.click(within(toolbar).getByRole('button', { name: '‹ Ayer' }));
    expect(push).toHaveBeenLastCalledWith('/admin?date=2030-02-28');
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Mañana ›' }));
    expect(push).toHaveBeenLastCalledWith('/admin?date=2030-03-02');
  });

  it('on another day: "Resumen del día", Hoy is not active and jumps to today', async () => {
    const toolbar = renderView('2030-01-10');
    expect(screen.getByRole('heading', { level: 1, name: 'Resumen del día' })).toBeInTheDocument();
    const hoy = within(toolbar).getByRole('button', { name: 'Hoy' });
    expect(hoy).not.toHaveAttribute('aria-current');
    await userEvent.click(hoy);
    expect(push).toHaveBeenCalledWith('/admin?date=2030-01-15');
  });

  it('Hoy does not navigate when already on today', async () => {
    const toolbar = renderView('2030-01-15');
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Hoy' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('the labelled date input navigates only to real dates', () => {
    const toolbar = renderView('2030-01-15');
    const input = within(toolbar).getByLabelText('Fecha');
    expect(input).toHaveValue('2030-01-15');
    fireEvent.change(input, { target: { value: '2030-02-01' } });
    expect(push).toHaveBeenCalledWith('/admin?date=2030-02-01');
    push.mockClear();
    fireEvent.change(input, { target: { value: '' } });
    expect(push).not.toHaveBeenCalled();
  });

  it('every toolbar control is a 44px touch target', () => {
    const toolbar = renderView('2030-01-15');
    for (const name of ['‹ Ayer', 'Hoy', 'Mañana ›']) {
      expect(within(toolbar).getByRole('button', { name })).toHaveClass('h-11');
    }
    expect(within(toolbar).getByLabelText('Fecha')).toHaveClass('h-11');
  });
});

describe('AdminDayView — "Revisar C2P pendientes"', () => {
  it('starts on the "Todas" chip', () => {
    renderView('2030-01-15');
    expect(screen.getByTestId('reservations-table')).toHaveAttribute('data-chip', 'all');
  });

  it('filters the day list to pending payments, scrolls to it and moves focus there', async () => {
    renderView('2030-01-15');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar C2P pendientes' }));
    expect(screen.getByTestId('reservations-table')).toHaveAttribute('data-chip', 'pending_payment');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Reservas programadas' }));
  });

  it('scrolls without animation when the user prefers reduced motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    renderView('2030-01-15');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar C2P pendientes' }));
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/day-view.test.tsx`
Expected: FAIL — no existe el grupo "Elegir día", el h1 es "Reservas del día", "Hoy" sólo aparece fuera de hoy, y el botón no hace scroll/foco.

- [ ] **Step 3: Implementación**

Reemplaza TODO `src/components/admin/day-view.tsx` por:

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { MetricGrid } from './metric-cards';
import { ReservationsTable, type ChipKey } from './reservations-table';
import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
import { ADMIN_ACTION, ADMIN_INPUT } from './ui-constants';
import { longDateEs } from '@/lib/dates';
import { isIsoDate, shiftIsoDate, type DayMetrics } from '@/lib/day-metrics';
import type { ReservationRow } from '@/lib/db/reservations';
import { cn } from '@/lib/utils';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** "‹ Ayer" / "Mañana ›" move one day from the shown date; "Hoy" is highlighted when the shown date is today. */
function DateToolbar(props: { date: string; today: string; onGo: (date: string) => void }) {
  const isToday = props.date === props.today;
  return (
    <div
      role="group"
      aria-label="Elegir día"
      className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm"
    >
      <Button variant="outline" className={ADMIN_ACTION} onClick={() => props.onGo(shiftIsoDate(props.date, -1))}>
        ‹ Ayer
      </Button>
      <Button
        variant={isToday ? 'default' : 'outline'}
        aria-current={isToday ? 'date' : undefined}
        className={cn(ADMIN_ACTION, isToday && 'bg-navy text-white hover:bg-navy/90')}
        onClick={() => { if (!isToday) props.onGo(props.today); }}
      >
        Hoy
      </Button>
      <Button variant="outline" className={ADMIN_ACTION} onClick={() => props.onGo(shiftIsoDate(props.date, 1))}>
        Mañana ›
      </Button>
      <label htmlFor="admin-day-date" className="sr-only">Fecha</label>
      <Input
        id="admin-day-date"
        type="date"
        className={`${ADMIN_INPUT} w-full bg-white sm:ml-auto sm:w-fit`}
        value={props.date}
        onChange={(e) => { if (isIsoDate(e.target.value)) props.onGo(e.target.value); }}
      />
    </div>
  );
}

export function AdminDayView(props: { date: string; today: string; rows: ReservationRow[]; metrics: DayMetrics }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [chip, setChip] = useState<ChipKey>('all');
  const listRef = useRef<HTMLElement>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const isToday = props.date === props.today;

  const go = (d: string) => router.push(`/admin?date=${d}`);

  const reviewPending = () => {
    setChip('pending_payment');
    const list = listRef.current;
    list?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    list?.focus({ preventScroll: true });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">{isToday ? 'Hoy' : 'Resumen del día'}</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{longDateEs(props.date)}</p>
      </div>

      <DateToolbar date={props.date} today={props.today} onGo={go} />

      <MetricGrid metrics={props.metrics} onReviewPending={reviewPending} />

      <section
        ref={listRef}
        tabIndex={-1}
        aria-labelledby="day-list-title"
        className="scroll-mt-4 rounded-2xl border bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <h2 id="day-list-title" className="font-extrabold">Reservas programadas</h2>
        <p className="mb-3 text-sm text-muted-foreground">Consulta y gestiona los accesos del día</p>
        <ReservationsTable
          rows={props.rows}
          today={props.today}
          chip={chip}
          onChipChange={setChip}
          onCheckIn={async (id) => {
            const res = await adminCheckIn(id);
            setToast(res.ok
              ? { kind: 'success', message: 'Check-in aprobado' }
              : { kind: 'error', message: res.message ?? 'No se pudo guardar. Revisa la fecha y la capacidad.' });
            router.refresh();
            return res;
          }}
          onResend={async (id) => {
            const res = await adminResendVoucher(id);
            setToast(res.ok
              ? { kind: 'success', message: 'Correo reenviado correctamente' }
              : { kind: 'error', message: res.message ?? 'No se pudo reenviar el correo.' });
          }}
        />
      </section>

      <Toast kind={toast?.kind ?? 'success'} message={toast?.message ?? null} onDismiss={dismissToast} />
    </main>
  );
}
```

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/day-view.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS (10 tests); `tsc` sin salida; `eslint` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/day-view.tsx src/components/admin/day-view.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add Ayer/Hoy/Mañana toolbar and C2P review shortcut

"Revisar C2P pendientes" filters the day list to pending payments
and scrolls/focuses it; it never links to the reservations page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: e2e de la vista "Hoy"

**Files:**
- Create: `e2e/admin-day-view.spec.ts`

No hay e2e del admin que dependan de los textos cambiados (`grep` de "Revisar pagos", "Pagos por verificar", "Reservas del día" en `e2e/` sale vacío), así que no se rompe ningún spec existente. Este spec nuevo usa sólo roles y nombres accesibles y no asume datos concretos.

- [ ] **Step 1: Escribir el spec**

Crea `e2e/admin-day-view.spec.ts`:

```ts
// e2e/admin-day-view.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Local admin credentials live outside the repo (never copy them in).
 * Main checkout: <repo>/supabase/…; worktree: <repo>/.worktrees/<type>/<name>/e2e → 4 levels up.
 */
function readAdminCredentials(): { email: string; password: string } | null {
  const candidates = [
    process.env.ADMIN_CREDENTIALS_FILE,
    path.resolve(__dirname, '../supabase/.local-admin-credentials.txt'),
    path.resolve(__dirname, '../../../../supabase/.local-admin-credentials.txt'),
  ].filter((p): p is string => Boolean(p));
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return null;
  const text = fs.readFileSync(file, 'utf8');
  const email = /^email:\s*(\S+)/m.exec(text)?.[1];
  const password = /^password:\s*(.+)$/m.exec(text)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

const creds = readAdminCredentials();

function caracasDate(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test.describe('admin "Hoy" view', () => {
  test.skip(!creds, 'no local admin credentials file (CI)');

  test('shows the four KPI cards and moves with Ayer / Hoy', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(creds!.email);
    await page.getByLabel('Password').fill(creds!.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/admin(\?|$)/);

    const toolbar = page.getByRole('group', { name: 'Elegir día' });
    await expect(toolbar.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'date');
    for (const name of ['Ocupación', 'Check-ins', 'Ingresos', 'Cola C2P']) {
      await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
    }

    await toolbar.getByRole('button', { name: '‹ Ayer' }).click();
    await expect(page).toHaveURL(new RegExp(`date=${caracasDate(-1)}`));
    await expect(toolbar.getByRole('button', { name: 'Hoy' })).not.toHaveAttribute('aria-current', 'date');

    await toolbar.getByRole('button', { name: 'Hoy' }).click();
    await expect(page).toHaveURL(new RegExp(`date=${caracasDate(0)}`));
    await expect(toolbar.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'date');
  });
});
```

- [ ] **Step 2: Ejecutar el spec (dentro del lock)**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-metrics
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; \
  if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy — aborting"; else \
  source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx playwright test e2e/admin-day-view.spec.ts; fi; rmdir "$L"
```

Expected: `1 passed`. Si `lsof` muestra algo escuchando en :3100, NO lo mates: espera y reintenta (es de otro PR). Si el login falla, comprueba que el email del archivo de credenciales esté en `ADMIN_EMAILS` de `.env.local` del worktree (no lo copies al repo).

- [ ] **Step 3: Commit**

```bash
git add e2e/admin-day-view.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover the admin Hoy view toolbar and KPI cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Verificación final

**Files:** ninguno (sólo correcciones si algo falla).

- [ ] **Step 1: Tipos, lint, unit y build**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-metrics
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: `tsc` sin salida; `eslint` sin errores; Vitest todo en verde; `next build` termina con `/admin` listado como ruta dinámica (ƒ).

- [ ] **Step 2: Suite e2e completa (dentro del lock)**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-metrics
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; \
  if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy — aborting"; else \
  source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:e2e; fi; rmdir "$L"
```

Expected: todos los specs pasan (incluido `admin-day-view.spec.ts`).

`npm run test:integration` no es necesario: este PR no añade consultas ni migraciones (sólo reutiliza `listReservationsByDate`, `getSettings` y `listOverrides`, ya cubiertos).

- [ ] **Step 3: Revisión visual rápida (opcional pero recomendada)**

Con el dev server del Step 2 (o `npm run dev -- --port 3100` dentro del lock), abre `/admin` en ancho móvil (≈390 px) y escritorio: las 4 tarjetas en 1 / 2 / 4 columnas, "Hoy" en navy cuando es hoy, gauge con el color de su banda, y con "Reducir movimiento" activado en el SO el badge ámbar no pulsa. Crea un override de capacidad 0 para un día en `/admin/settings` y comprueba que ese día muestra "Cerrado" (bórralo después).

- [ ] **Step 4: Estado limpio**

```bash
git status --short
git log --oneline develop..HEAD
```

Expected: `git status` vacío; 12 commits de este PR (Tasks 1–12). No hagas push ni abras PR: lo hace el coordinador.

---

## Self-review (hecho al escribir el plan)

**Cobertura del alcance:**
- Barra de fecha prominente con "‹ Ayer" · "Hoy" · "Mañana ›", navegación por `?date=`, "Hoy" activo (`aria-current="date"` + navy) → Task 11 (+ e2e Task 12).
- Ocupación: gauge radial, capacidad EFECTIVA del día (override primero, días cerrados = "Cerrado"), bandas 70/71/90/91 %, `role="meter"` con `aria-valuenow`/`aria-valuetext` → Tasks 1, 4, 5, 6.
- Check-ins: personas ingresadas vs confirmadas, sparkline por hora sin librería (hora Caracas vía `bucketCheckinsByHour`), estado vacío → Tasks 3, 7.
- Ingresos: USD primario, Bs. secundario, cobrado (confirmed+checked_in) vs por verificar (pending_payment) → Tasks 4, 8.
- Cola C2P: tarjeta ámbar, badge pulsante `motion-safe:animate-ping`, botón "Revisar C2P pendientes" → chip `pending_payment` de la lista del día (sin enlazar a `/admin/reservations`) → Tasks 9, 11.
- `src/app/admin/metrics-actions.ts` con `adminGetDayMetrics` (`requireAdmin()` + zod, helpers de BD reutilizados, sin `logAudit` por ser lectura); `adminGetDaySummary` intacto → Task 5.
- `metric-cards.test.tsx` a fondo (bordes 0/70/71/90/91/100, redondeo 70,5 %, sobrecupo, cerrado por override y por capacidad 0, capacidad especial, tendencia vacía/llena, ingresos, cola) + tests de `day-view` → Tasks 6–11.

**Placeholders:** ninguno; cada paso de código trae el código completo y cada comando su salida esperada.

**Consistencia de tipos/nombres:** `DayMetrics` (`capacity`, `defaultCapacity`, `override`, `confirmedPeople`, `checkedInPeople`, `checkedInParties`, `checkinsByHour`, `collected{usd,ves,count}`, `pending{usd,count}`) es el mismo en Tasks 4–12. `computeDayMetrics({date, rows, dailyCapacity, overrides})`, `adminGetDayMetrics(date)`, `parseDayParam(raw, today)`, `shiftIsoDate`, `isIsoDate`, `hourlySeries`, `hourLabel`, `occupancyPercent`, `occupancyLevel` coinciden entre definición y uso. `AdminDayView` props `{date, today, rows, metrics}` coinciden en Task 10, 11 y en `page.tsx`.

## Notas para el coordinador (desviaciones y preguntas abiertas)

1. **Archivos nuevos fuera de la tabla de propiedad:** `src/lib/day-metrics.ts` (+test), `src/components/admin/day-view.test.tsx`, `src/app/admin/(dashboard)/page.test.ts`, `src/app/admin/metrics-actions.test.ts`, `e2e/admin-day-view.spec.ts`. Todos nuevos, sin choque con otros PRs.
2. **Contrato con PR 10:** `day-view.tsx` depende de `ReservationsTable` con props `chip` / `onChipChange` y `ChipKey` que incluya `'pending_payment'`. Si PR 10 cambia esa interfaz, hay que ajustar `day-view.tsx` al rebasar (los tests de `day-view` usan un stub, así que no detectarían el cambio; `tsc` sí).
3. **Bs. por verificar no se muestra:** `total_ves` de un `pending_payment` es `null` hasta confirmar; mostrar una conversión con la tasa actual sería un dato inventado. Se muestra sólo USD y una nota.
4. **`listOverrides()` lee todos los overrides** para encontrar el del día (igual que `getTodayCapacity`). La tabla es pequeña; un `getOverride(date)` en `src/lib/db/reservations.ts` sería más eficiente, pero ese archivo es compartido y no se toca aquí.
5. **`adminGetDaySummary` sigue con el bug de capacidad** (no se edita `actions.ts`, según el brief); tras este PR ya no lo usa la UI. Propuesta: eliminarlo (o redirigirlo a `computeDayMetrics`) en un PR de limpieza.
6. **Ocupación sólo cuenta `confirmed`+`checked_in`** (spec: `confirmedPeople / capacity`); los cupos retenidos por `pending_payment` no vencidos no entran en el gauge, aunque sí bloquean disponibilidad en `reserve_slots`.
7. **"‹ Ayer" / "Mañana ›" son relativos al día mostrado** (como hoy), no a la fecha real; se conservan las etiquetas del spec.
