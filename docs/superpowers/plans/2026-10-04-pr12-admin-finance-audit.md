# PR 12 — Finanzas y Auditoría del admin: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres páginas del admin de solo lectura, renderizadas en el servidor y paginadas por URL: Transacciones C2P (`/admin/finance/transactions`), Tasas BCV (`/admin/finance/bcv`) y Auditoría (`/admin/audit`, solo dueño), activadas en el menú.

**Architecture:** La lógica pura (parseo de `searchParams`, rangos de fecha en hora de Caracas, totales, variación %, sparkline, etiquetas de auditoría) vive en módulos sin `server-only` en `src/lib/…`, con tests unitarios. Hay dos helpers de BD nuevos (`src/lib/db/transactions.ts` y `src/lib/db/audit-search.ts`), cada uno con test de integración y sin migración. Las páginas llaman a server actions nuevas de `src/app/admin/finance-actions.ts`. Cada acción hace su propio gate con `requireAdmin` y valida con zod. Los componentes son de servidor (`src/components/admin/finance/*`, `src/components/admin/audit/*`), con tarjetas apiladas en móvil y tabla desde `md`. Todas las páginas reutilizan el `Pagination` compartido.

**Tech Stack:** Next.js 16 App Router (`searchParams` es una `Promise`), React 19, TypeScript, Tailwind v4, shadcn `ui/table`, lucide-react, zod v4, Supabase (PostgREST, service role), Vitest + Testing Library, Playwright.

---

## Contexto y decisiones (léelo antes de empezar)

**Requisitos:** md2 §1 (grupos "Finance & Sales" y "Management"), roadmap §3.4 (rutas `finance/transactions/`, `finance/bcv/`, `audit/`, Auditoría solo para el dueño) y el brief de la ola 3.

**Decisiones de diseño:**

1. **Transacciones = reservas que llegaron al pago**: estados `confirmed`, `checked_in`, `pending_payment` y `failed`. `expired` no cuenta, porque nunca se intentó cobrar.
2. **El filtro de fechas usa `created_at`** (el momento del pago C2P), no `date` (el día de la visita). Lo pide la propia columna "Fecha/hora de creación", y finanzas cuadra por el día en que entra el dinero. Por eso **no se puede reutilizar `searchReservations`**, que filtra por `date`. Se crea `searchTransactions` en un archivo nuevo (`src/lib/db/transactions.ts`) que no toca `src/lib/db/reservations.ts`. Sí se reutilizan `pageRange` (`src/lib/db/paginate.ts`), `STATUS_CHIP_CLASS` y `statusLabelEs` (`src/lib/reservation-status.ts`), `roundMoney` y `todayCaracas`.
3. **Rango en hora de Caracas**: Venezuela es UTC−4 todo el año (no tiene horario de verano desde 2016). `[desde 00:00 −04:00, (hasta+1) 00:00 −04:00)`. Por defecto son los últimos 30 días, hoy incluido (`hoy−29 … hoy`). El rango máximo es de 366 días. Un rango inválido vuelve al de por defecto.
4. **Totales**: se calculan sobre **el rango de fechas** e ignoran el filtro de estado (la fila de totales dice "del rango"). "Cobrado" = `confirmed` + `checked_in` en USD y Bs. "Por verificar" = `pending_payment`, solo en USD y con conteo, porque `total_ves` es `null` hasta confirmar y no se inventa un monto en Bs. Supabase local tiene `max_rows = 1000` (`supabase/config.toml`), así que `transactionTotals` lee por bloques de 1000 hasta agotar el rango. Sin bloques, los totales saldrían truncados en silencio. No hace falta migración ni RPC.
5. **BCV**: se reutiliza `listBcvHistory` sin cambios. La variación de cada fila se compara con la fila **anterior en el tiempo** (la de abajo). La última fila visible se compara con la primera de la página siguiente, que se lee aparte con `listBcvHistory({ page: page*pageSize+1, pageSize: 1 })` (con páginas de 1 fila, la página N es la fila N). La fila más antigua de todas muestra "—". Sparkline: SVG inline de la página visible, ordenada de más antigua a más reciente y sin librería. Lleva `aria-hidden` y un resumen en texto (mín./máx./último) en `figcaption`.
6. **Auditoría**: `listAudit` no filtra por acción, así que se crea `searchAudit` (`src/lib/db/audit-search.ts`), con el mismo orden y un `.eq('action', …)` opcional. Las etiquetas en español están en `AUDIT_ACTION_LABELS … satisfies Record<AuditAction, string>`. Ese `satisfies` hace que el compilador falle si falta o sobra una acción, y el test con `expectTypeOf` lo refuerza. Si llega una acción desconocida desde la BD, se muestra tal cual en `font-mono`.
7. **Server actions vs. BD directa**: se elige **un único enfoque: las páginas llaman a server actions nuevas de `src/app/admin/finance-actions.ts`** (`adminListTransactions`, `adminBcvHistoryPage`, `adminSearchAudit`). Así se sigue el patrón actual (`page.tsx` → `adminListReservations`; `settings/page.tsx` → `adminGetSettings`). Además, cada lectura de datos lleva su propio `requireAdmin` y su validación zod (defensa en profundidad, aunque la página se use desde otro sitio) y el gating se puede probar con mocks. Las existentes `adminListBcvHistory` y `adminListAudit` no alcanzan porque les falta la variación y el filtro por acción. No se tocan.
8. **Auditoría solo para el dueño**: la página hace `requireAdmin()` y, si `role !== 'owner'`, muestra el aviso ámbar (el mismo patrón que `settings/page.tsx`) sin llamar a la acción. La acción además exige `requireAdmin({ role: 'owner' })`.
9. **Filtros por GET**: un `<form method="get">` normal, sin JS de cliente. No incluye `page`, así que al filtrar se vuelve a la página 1, y conserva `pageSize` en un input oculto. Los `params` que se pasan a `Pagination` se construyen **desde la query ya validada** (`transactionLinkParams`, `auditLinkParams`), nunca desde la URL cruda.
10. **`PAGE_SIZES`**: `pagination.tsx` es `'use client'`, y si una página de servidor importa una constante desde ahí recibe una referencia de cliente. Por eso `src/lib/admin-page-params.ts` define `ADMIN_PAGE_SIZES` y un test comprueba que es igual a `PAGE_SIZES`.
11. **Sin animaciones**: no hay transiciones nuevas, así que `prefers-reduced-motion` se cumple sin más. Las fechas usan el formato `dd/mm/aaaa HH:MM` (Caracas) construido con `formatToParts`, sin `capitalize`. Los montos siguen la convención actual del admin (`$35.00`, `Bs. 1277.50`) y las tasas se muestran con 4 decimales (`Bs. 36.5000`), que es la precisión de `numeric(14,4)`.

**Archivos fuera de mi propiedad que se tocan (mínimo inevitable):**
- `src/components/admin/nav-config.ts`: solo `ready: true` en Transacciones C2P, Tasas BCV y Auditoría.
- `src/components/admin/nav-config.test.ts` y `src/components/admin/admin-shell.test.tsx`: afirman que esos ítems no están listos, así que hay que actualizarlos. **Es probable un conflicto trivial con el PR 10**, que activa "Reservas" en las mismas líneas.
- No se toca `src/app/admin/actions.ts`, ni `src/lib/audit.ts` (no se añade ningún `AuditAction`), ni `src/lib/db/reservations.ts`. No hay migración.

## Entorno de ejecución (obligatorio)

- Directorio de trabajo para **todos** los comandos: `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-finance-audit`.
- La versión de Node por defecto es la v16: anteponer siempre `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null &&` a todo `npm`/`npx`.
- Supabase local es compartido y ya está corriendo. **Prohibido** usar `supabase start/stop/db reset/migration`. Este PR no tiene migración.
- Los tests de integración y e2e van serializados con el lock:
  `L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"`.
  Dentro del lock, antes del e2e, comprobar que nada escucha en :3100 (`lsof -nP -iTCP:3100 -sTCP:LISTEN`).
- Las credenciales del admin para e2e están en `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt`. El worktree no tiene ese archivo, así que el spec lee la ruta de `ADMIN_CREDENTIALS_FILE` y hace `test.skip` si no existe. Nunca se copian al repo.
- Nada de worktree, push ni PR: lo hace el coordinador. Los commits son conventional y terminan con una línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (con `-m "<asunto>" -m "Co-Authored-By: …"`).

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/admin-page-params.ts` | Crear | `firstParam`, `parsePageParams`, `isIsoDate`, `shiftIsoDate`, `daysBetween`, `ADMIN_PAGE_SIZES`, `pageFields`/`pageQuerySchema` |
| `src/lib/admin-page-params.test.ts` | Crear | Tests unitarios |
| `src/lib/finance/format.ts` | Crear | `caracasDateTime`, `formatUsd`, `formatBs`, `formatRate`, `EMPTY` |
| `src/lib/finance/format.test.ts` | Crear | Tests unitarios |
| `src/lib/finance/transactions.ts` | Crear | Estados, tipos, schema zod, `parseTransactionParams`, `transactionLinkParams`, `caracasDayBoundsUtc`, `summarizeTransactions` |
| `src/lib/finance/transactions.test.ts` | Crear | Tests unitarios |
| `src/lib/db/transactions.ts` | Crear | `searchTransactions`, `transactionTotals` (por bloques) |
| `src/lib/db/transactions.integration.test.ts` | Crear | Test de integración |
| `src/lib/finance/bcv.ts` | Crear | `variationPct`, `withVariation`, `formatVariation`, `variationTrend`, `sparklinePoints`, `rateSummary`, `sourceLabel` |
| `src/lib/finance/bcv.test.ts` | Crear | Tests unitarios |
| `src/lib/audit-labels.ts` | Crear | `AUDIT_ACTION_LABELS`, `AUDIT_ACTIONS`, `isAuditAction`, `auditActionLabel`, `formatAuditDetails`, `parseAuditParams`, `auditLinkParams`, `auditQuerySchema` |
| `src/lib/audit-labels.test.ts` | Crear | Tests de tipo y unitarios |
| `src/lib/db/audit-search.ts` | Crear | `searchAudit` (filtro opcional por acción) |
| `src/lib/db/audit-search.integration.test.ts` | Crear | Test de integración |
| `src/app/admin/finance-actions.ts` | Crear | `adminListTransactions`, `adminBcvHistoryPage`, `adminSearchAudit` |
| `src/app/admin/finance-actions.test.ts` | Crear | Gating, validación y vecino BCV |
| `src/components/admin/finance/empty-state.tsx` | Crear | Estado vacío compartido (también lo usa Auditoría) |
| `src/components/admin/finance/status-chip.tsx` | Crear | Chip de estado sobre `STATUS_CHIP_CLASS` |
| `src/components/admin/finance/transactions-filters.tsx` | Crear | Formulario GET (desde/hasta/estado) |
| `src/components/admin/finance/transactions-totals.tsx` | Crear | Fila de totales (cobrado / por verificar) |
| `src/components/admin/finance/transactions-list.tsx` | Crear | Tarjetas en móvil + tabla en escritorio |
| `src/components/admin/finance/transactions.test.tsx` | Crear | Tests de los 4 componentes anteriores |
| `src/app/admin/(dashboard)/finance/transactions/page.tsx` | Crear | Página |
| `src/app/admin/(dashboard)/finance/transactions/page.test.tsx` | Crear | Wiring: params → acción, vacío, paginación |
| `src/components/admin/finance/bcv-sparkline.tsx` | Crear | SVG + resumen en texto |
| `src/components/admin/finance/bcv-history-list.tsx` | Crear | Tarjetas + tabla con chip de origen y variación |
| `src/components/admin/finance/bcv.test.tsx` | Crear | Tests de componentes |
| `src/app/admin/(dashboard)/finance/bcv/page.tsx` | Crear | Página |
| `src/app/admin/(dashboard)/finance/bcv/page.test.tsx` | Crear | Wiring |
| `src/components/admin/audit/audit-filters.tsx` | Crear | Formulario GET (acción) |
| `src/components/admin/audit/audit-list.tsx` | Crear | Tarjetas + tabla |
| `src/components/admin/audit/audit.test.tsx` | Crear | Tests de componentes |
| `src/app/admin/(dashboard)/audit/page.tsx` | Crear | Página solo para el dueño |
| `src/app/admin/(dashboard)/audit/page.test.tsx` | Crear | Gating de dueño y wiring |
| `src/components/admin/nav-config.ts` | Modificar | `ready: true` en 3 ítems |
| `src/components/admin/nav-config.test.ts` | Modificar | Nuevas expectativas |
| `src/components/admin/admin-shell.test.tsx` | Modificar | Lista de "no listos" y visibilidad por rol |
| `e2e/admin-finance-audit.spec.ts` | Crear | Smoke e2e de las 3 páginas (se salta sin credenciales) |

---

### Task 0: Preparar el worktree y la línea base

**Files:** ninguno.

- [ ] **Step 1: Instalar dependencias**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-finance-audit && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci
```
Expected: `added N packages` y sin errores.

- [ ] **Step 2: Comprobar que `.env.local` existe (lo usan integración y e2e)**

Run: `test -f .env.local && echo ok`
Expected: `ok`. Si no existe, detente y avisa al coordinador. No lo inventes.

- [ ] **Step 3: Línea base**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test
```
Expected: todo en verde. Si algo ya falla en `develop`, anótalo antes de seguir y no lo arregles en este PR.

---

### Task 1: Helpers de paginación y fechas por URL

**Files:**
- Create: `src/lib/admin-page-params.ts`
- Test: `src/lib/admin-page-params.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/admin-page-params.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));

import {
  ADMIN_PAGE_SIZES, DEFAULT_PAGE_SIZE, daysBetween, firstParam, isIsoDate,
  pageQuerySchema, parsePageParams, shiftIsoDate,
} from './admin-page-params';
import { PAGE_SIZES } from '@/components/admin/pagination';

describe('ADMIN_PAGE_SIZES', () => {
  it('mirrors the shared Pagination selector', () => {
    expect([...ADMIN_PAGE_SIZES]).toEqual([...PAGE_SIZES]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });
});

describe('firstParam', () => {
  it('takes the first value of repeated params', () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam('a')).toBe('a');
    expect(firstParam(['a', 'b'])).toBe('a');
  });
});

describe('parsePageParams', () => {
  it('defaults to page 1 and 10 rows', () => {
    expect(parsePageParams({})).toEqual({ page: 1, pageSize: 10 });
  });

  it('accepts valid values', () => {
    expect(parsePageParams({ page: '3', pageSize: '25' })).toEqual({ page: 3, pageSize: 25 });
    expect(parsePageParams({ page: ['2', '9'], pageSize: '50' })).toEqual({ page: 2, pageSize: 50 });
  });

  it.each([
    ['0'], ['-1'], ['1.5'], ['abc'], [''], ['10001'],
  ])('falls back to page 1 for %j', (page) => {
    expect(parsePageParams({ page }).page).toBe(1);
  });

  it.each([['30'], ['100'], ['x'], ['']])('falls back to 10 rows for pageSize %j', (pageSize) => {
    expect(parsePageParams({ pageSize }).pageSize).toBe(10);
  });
});

describe('isIsoDate', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2026-10-04')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-04')).toBe(false);
    expect(isIsoDate('04/10/2026')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe('shiftIsoDate / daysBetween', () => {
  it('shifts across month and year boundaries', () => {
    expect(shiftIsoDate('2026-10-04', -29)).toBe('2026-09-05');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days, negative when reversed', () => {
    expect(daysBetween('2026-09-05', '2026-10-04')).toBe(29);
    expect(daysBetween('2026-10-04', '2026-10-04')).toBe(0);
    expect(daysBetween('2026-10-04', '2026-10-03')).toBe(-1);
  });
});

describe('pageQuerySchema', () => {
  it('validates action input strictly', () => {
    expect(pageQuerySchema.safeParse({ page: 1, pageSize: 25 }).success).toBe(true);
    expect(pageQuerySchema.safeParse({ page: 0, pageSize: 25 }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: 1, pageSize: 30 }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: '1', pageSize: 10 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/admin-page-params.test.ts`
Expected: FAIL con `Failed to resolve import "./admin-page-params"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/admin-page-params.ts
import { z } from 'zod';

/**
 * Pure helpers shared by the URL-paginated admin pages (transactions, BCV
 * rates, audit). No `server-only`, so they are unit-testable. The page sizes
 * are duplicated from `components/admin/pagination.tsx` on purpose: that module
 * is 'use client', so a server page importing a constant from it would get a
 * client reference instead of the array (a test keeps both in sync).
 */

export const ADMIN_PAGE_SIZES = [10, 25, 50] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: AdminPageSize = 10;
export const MAX_PAGE = 10000;

/** Shape of an awaited Next.js `searchParams`. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Lenient URL parsing: anything invalid falls back to page 1 / 10 rows. */
export function parsePageParams(sp: RawSearchParams): { page: number; pageSize: AdminPageSize } {
  const rawPage = Number(firstParam(sp.page));
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= MAX_PAGE ? rawPage : 1;
  const rawSize = Number(firstParam(sp.pageSize));
  const pageSize = (ADMIN_PAGE_SIZES as readonly number[]).includes(rawSize)
    ? (rawSize as AdminPageSize)
    : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

/** Real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** YYYY-MM-DD plus `days` (may be negative). Noon UTC avoids any DST edge. */
export function shiftIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Strict validation for server-action input (no coercion: callers pass parsed numbers). */
export const pageFields = {
  page: z.number().int().min(1).max(MAX_PAGE),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]),
};

export const pageQuerySchema = z.object(pageFields);
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/admin-page-params.test.ts`
Expected: PASS (todos los tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-page-params.ts src/lib/admin-page-params.test.ts
git commit -m "feat(admin): add URL page/date param helpers for admin lists" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Formato de fecha/hora (Caracas) y montos

**Files:**
- Create: `src/lib/finance/format.ts`
- Test: `src/lib/finance/format.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/finance/format.test.ts
import { describe, it, expect } from 'vitest';
import { EMPTY, caracasDateTime, formatBs, formatRate, formatUsd } from './format';

describe('caracasDateTime', () => {
  it('renders dd/mm/yyyy HH:MM in America/Caracas (UTC-4)', () => {
    expect(caracasDateTime('2026-10-04T14:05:00Z')).toBe('04/10/2026 10:05');
  });

  it('crosses midnight correctly', () => {
    expect(caracasDateTime('2026-10-04T03:59:00Z')).toBe('03/10/2026 23:59');
    expect(caracasDateTime('2026-10-04T04:00:00Z')).toBe('04/10/2026 00:00');
  });
});

describe('money and rates', () => {
  it('formats USD with two decimals', () => {
    expect(formatUsd(15)).toBe('$15.00');
    expect(formatUsd('35.5')).toBe('$35.50');
  });

  it('formats Bs. with two decimals, dash when missing', () => {
    expect(formatBs(1277.5)).toBe('Bs. 1277.50');
    expect(formatBs('547.5')).toBe('Bs. 547.50');
    expect(formatBs(null)).toBe(EMPTY);
  });

  it('formats BCV rates with four decimals, dash when missing', () => {
    expect(formatRate(36.5)).toBe('Bs. 36.5000');
    expect(formatRate('37.1234')).toBe('Bs. 37.1234');
    expect(formatRate(null)).toBe(EMPTY);
  });

  it('EMPTY is an em dash', () => {
    expect(EMPTY).toBe('—');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/finance/format.test.ts`
Expected: FAIL con `Failed to resolve import "./format"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/finance/format.ts

/** Placeholder for a missing value (null payment ref, rate not fixed yet…). */
export const EMPTY = '—';

/**
 * "04/10/2026 10:05" in America/Caracas. Built from formatToParts so the
 * output does not depend on the ICU punctuation of a locale.
 */
export function caracasDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Caracas',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** Supabase may return numeric columns as strings: always go through Number(). */
export function formatUsd(n: number | string): string {
  return `$${Number(n).toFixed(2)}`;
}

export function formatBs(n: number | string | null): string {
  return n == null ? EMPTY : `Bs. ${Number(n).toFixed(2)}`;
}

/** BCV rates are stored as numeric(14,4): show all four decimals. */
export function formatRate(n: number | string | null): string {
  return n == null ? EMPTY : `Bs. ${Number(n).toFixed(4)}`;
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/finance/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/format.ts src/lib/finance/format.test.ts
git commit -m "feat(admin): add Caracas date-time and money formatters for finance" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lógica pura de transacciones (params, rango Caracas, totales)

**Files:**
- Create: `src/lib/finance/transactions.ts`
- Test: `src/lib/finance/transactions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/finance/transactions.test.ts
import { describe, it, expect } from 'vitest';
import {
  TRANSACTION_STATUSES, caracasDayBoundsUtc, defaultTransactionRange, parseTransactionParams,
  summarizeTransactions, transactionLinkParams, transactionQuerySchema,
} from './transactions';

const TODAY = '2026-10-04';

describe('TRANSACTION_STATUSES', () => {
  it('lists the statuses that reached payment (not expired)', () => {
    expect([...TRANSACTION_STATUSES]).toEqual(['confirmed', 'checked_in', 'pending_payment', 'failed']);
  });
});

describe('defaultTransactionRange', () => {
  it('is the last 30 days including today', () => {
    expect(defaultTransactionRange(TODAY)).toEqual({ dateFrom: '2026-09-05', dateTo: '2026-10-04' });
  });
});

describe('parseTransactionParams', () => {
  it('defaults to the last 30 days, all statuses, page 1 of 10', () => {
    expect(parseTransactionParams({}, TODAY)).toEqual({
      dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10,
    });
  });

  it('accepts a valid range, status and paging', () => {
    expect(parseTransactionParams(
      { from: '2026-09-01', to: '2026-09-30', status: 'pending_payment', page: '2', pageSize: '25' },
      TODAY,
    )).toEqual({
      dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'pending_payment', page: 2, pageSize: 25,
    });
  });

  it('keeps the default for the missing end of the range', () => {
    expect(parseTransactionParams({ from: '2026-10-01' }, TODAY)).toMatchObject({
      dateFrom: '2026-10-01', dateTo: '2026-10-04',
    });
  });

  it.each([
    ['reversed range', { from: '2026-10-04', to: '2026-10-01' }],
    ['range longer than 366 days', { from: '2025-01-01', to: '2026-10-04' }],
    ['invalid dates', { from: '2026-02-30', to: 'ayer' }],
  ])('falls back to the default range on %s', (_label, sp) => {
    expect(parseTransactionParams(sp, TODAY)).toMatchObject({ dateFrom: '2026-09-05', dateTo: '2026-10-04' });
  });

  it('ignores statuses that are not transactions', () => {
    expect(parseTransactionParams({ status: 'expired' }, TODAY)).not.toHaveProperty('status');
    expect(parseTransactionParams({ status: '' }, TODAY)).not.toHaveProperty('status');
  });
});

describe('transactionQuerySchema', () => {
  const ok = { dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 };

  it('accepts a parsed query', () => {
    expect(transactionQuerySchema.safeParse(ok).success).toBe(true);
    expect(transactionQuerySchema.safeParse({ ...ok, status: 'failed' }).success).toBe(true);
  });

  it.each([
    ['bad status', { ...ok, status: 'expired' }],
    ['reversed range', { ...ok, dateFrom: '2026-10-05' }],
    ['too long', { ...ok, dateFrom: '2025-01-01' }],
    ['bad page size', { ...ok, pageSize: 30 }],
    ['fake date', { ...ok, dateTo: '2026-02-30' }],
  ])('rejects %s', (_label, raw) => {
    expect(transactionQuerySchema.safeParse(raw).success).toBe(false);
  });
});

describe('transactionLinkParams', () => {
  it('keeps the normalized filters for pagination links', () => {
    expect(transactionLinkParams({ dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 3, pageSize: 25 }))
      .toEqual({ from: '2026-09-05', to: '2026-10-04' });
    expect(transactionLinkParams({
      dateFrom: '2026-09-05', dateTo: '2026-10-04', status: 'confirmed', page: 1, pageSize: 10,
    })).toEqual({ from: '2026-09-05', to: '2026-10-04', status: 'confirmed' });
  });
});

describe('caracasDayBoundsUtc', () => {
  it('maps Caracas midnights (UTC-4) to a half-open UTC interval', () => {
    expect(caracasDayBoundsUtc('2026-10-01', '2026-10-04')).toEqual({
      startIso: '2026-10-01T04:00:00.000Z',
      endIso: '2026-10-05T04:00:00.000Z',
    });
  });

  it('handles a single day across a month end', () => {
    expect(caracasDayBoundsUtc('2026-10-31', '2026-10-31')).toEqual({
      startIso: '2026-10-31T04:00:00.000Z',
      endIso: '2026-11-01T04:00:00.000Z',
    });
  });
});

describe('summarizeTransactions', () => {
  it('sums collected (confirmed + checked_in) and pending, ignoring failed', () => {
    expect(summarizeTransactions([
      { status: 'confirmed', total_usd: 15, total_ves: 547.5 },
      // Supabase can return numeric columns as strings.
      { status: 'checked_in', total_usd: '35', total_ves: '1277.5' },
      { status: 'pending_payment', total_usd: 5, total_ves: null },
      { status: 'pending_payment', total_usd: 10, total_ves: null },
      { status: 'failed', total_usd: 55, total_ves: null },
    ] as unknown as Parameters<typeof summarizeTransactions>[0])).toEqual({
      collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 2,
    });
  });

  it('rounds to cents (no float noise)', () => {
    expect(summarizeTransactions([
      { status: 'confirmed', total_usd: 0.1, total_ves: 0.1 },
      { status: 'confirmed', total_usd: 0.2, total_ves: 0.2 },
    ]).collectedUsd).toBe(0.3);
  });

  it('is all zeros for no rows', () => {
    expect(summarizeTransactions([])).toEqual({
      collectedUsd: 0, collectedVes: 0, collectedCount: 0, pendingUsd: 0, pendingCount: 0,
    });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/finance/transactions.test.ts`
Expected: FAIL con `Failed to resolve import "./transactions"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/finance/transactions.ts
import { z } from 'zod';
import { roundMoney } from '@/lib/money';
import type { ReservationRow } from '@/lib/db/reservations';
import {
  daysBetween, firstParam, isIsoDate, pageFields, parsePageParams, shiftIsoDate,
  type AdminPageSize, type RawSearchParams,
} from '@/lib/admin-page-params';

/**
 * C2P transactions = reservations that reached the payment step. `expired`
 * never attempted a charge, so it is not a transaction. Pure module (no
 * server-only): the DB query lives in src/lib/db/transactions.ts.
 */
export const TRANSACTION_STATUSES = [
  'confirmed', 'checked_in', 'pending_payment', 'failed',
] as const satisfies readonly ReservationRow['status'][];

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const DEFAULT_RANGE_DAYS = 30;
/** Longest accepted range, inclusive (keeps the totals scan bounded). */
export const MAX_RANGE_DAYS = 366;

export type TransactionRow = Pick<
  ReservationRow,
  'id' | 'code' | 'first_name' | 'last_name' | 'total_usd' | 'bcv_rate' | 'total_ves'
  | 'status' | 'payment_ref' | 'checked_in_at' | 'created_at'
>;

export interface TransactionQuery {
  /** YYYY-MM-DD, Caracas calendar day of `created_at`, inclusive. */
  dateFrom: string;
  dateTo: string;
  status?: TransactionStatus;
  page: number;
  pageSize: AdminPageSize;
}

export interface TransactionTotals {
  /** confirmed + checked_in */
  collectedUsd: number;
  collectedVes: number;
  collectedCount: number;
  /** pending_payment: the Bs. amount is only fixed on confirmation, so USD only. */
  pendingUsd: number;
  pendingCount: number;
}

export function defaultTransactionRange(today: string): { dateFrom: string; dateTo: string } {
  return { dateFrom: shiftIsoDate(today, -(DEFAULT_RANGE_DAYS - 1)), dateTo: today };
}

function validRange(from: string, to: string): boolean {
  const span = daysBetween(from, to);
  return span >= 0 && span < MAX_RANGE_DAYS;
}

/** Strict validation for server-action input. */
export const transactionQuerySchema = z
  .object({
    dateFrom: z.string().refine((s) => isIsoDate(s)),
    dateTo: z.string().refine((s) => isIsoDate(s)),
    status: z.enum(TRANSACTION_STATUSES).optional(),
    ...pageFields,
  })
  .refine((q) => validRange(q.dateFrom, q.dateTo), { message: 'invalid range', path: ['dateTo'] });

/** Lenient URL parsing: invalid pieces fall back to defaults instead of erroring. */
export function parseTransactionParams(sp: RawSearchParams, today: string): TransactionQuery {
  const { page, pageSize } = parsePageParams(sp);
  const fallback = defaultTransactionRange(today);
  const rawFrom = firstParam(sp.from);
  const rawTo = firstParam(sp.to);
  let dateFrom = isIsoDate(rawFrom) ? rawFrom : fallback.dateFrom;
  let dateTo = isIsoDate(rawTo) ? rawTo : fallback.dateTo;
  if (!validRange(dateFrom, dateTo)) ({ dateFrom, dateTo } = fallback);
  const rawStatus = firstParam(sp.status);
  const status = TRANSACTION_STATUSES.find((s) => s === rawStatus);
  return { dateFrom, dateTo, ...(status ? { status } : {}), page, pageSize };
}

/** Filters to carry in pagination links (built from the validated query, never raw URL input). */
export function transactionLinkParams(q: TransactionQuery): Record<string, string> {
  return { from: q.dateFrom, to: q.dateTo, ...(q.status ? { status: q.status } : {}) };
}

/**
 * Half-open UTC interval [start, end) covering Caracas days dateFrom..dateTo.
 * Venezuela is UTC-4 all year (no DST since 2016).
 */
export function caracasDayBoundsUtc(dateFrom: string, dateTo: string): { startIso: string; endIso: string } {
  return {
    startIso: new Date(`${dateFrom}T00:00:00-04:00`).toISOString(),
    endIso: new Date(`${shiftIsoDate(dateTo, 1)}T00:00:00-04:00`).toISOString(),
  };
}

export function summarizeTransactions(
  rows: Pick<TransactionRow, 'status' | 'total_usd' | 'total_ves'>[],
): TransactionTotals {
  let collectedUsd = 0;
  let collectedVes = 0;
  let collectedCount = 0;
  let pendingUsd = 0;
  let pendingCount = 0;
  for (const r of rows) {
    if (r.status === 'confirmed' || r.status === 'checked_in') {
      collectedUsd += Number(r.total_usd);
      collectedVes += Number(r.total_ves ?? 0);
      collectedCount += 1;
    } else if (r.status === 'pending_payment') {
      pendingUsd += Number(r.total_usd);
      pendingCount += 1;
    }
  }
  return {
    collectedUsd: roundMoney(collectedUsd),
    collectedVes: roundMoney(collectedVes),
    collectedCount,
    pendingUsd: roundMoney(pendingUsd),
    pendingCount,
  };
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/finance/transactions.test.ts`
Expected: PASS.

- [ ] **Step 5: Comprobar tipos**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance/transactions.ts src/lib/finance/transactions.test.ts
git commit -m "feat(admin): add C2P transaction query parsing and totals math" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Helper de BD de transacciones (búsqueda + totales por bloques)

**Files:**
- Create: `src/lib/db/transactions.ts`
- Test: `src/lib/db/transactions.integration.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

```ts
// src/lib/db/transactions.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { searchTransactions, transactionTotals } from './transactions';
import type { TransactionQuery } from '@/lib/finance/transactions';
import type { ReservationRow } from './reservations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } },
);

// Isolated: codes PP-ZT### (6 chars after "PP-", never produced by reserve_slots),
// created_at in March 2032 and a visit date nobody else books.
const CODE_LIKE = 'PP-ZT%';
const VISIT = '2032-03-20';

interface Seed {
  code: string; createdAt: string; status: ReservationRow['status'];
  usd: number; ves: number | null; rate: number | null; ref: string | null;
}

const SEEDS: Seed[] = [
  // 2032-03-02 00:00 Caracas — first instant of the range: included.
  { code: 'PP-ZT001', createdAt: '2032-03-02T04:00:00Z', status: 'confirmed', usd: 15, ves: 547.5, rate: 36.5, ref: 'REF001' },
  { code: 'PP-ZT002', createdAt: '2032-03-05T15:00:00Z', status: 'checked_in', usd: 35, ves: 1277.5, rate: 36.5, ref: 'REF002' },
  { code: 'PP-ZT003', createdAt: '2032-03-06T15:00:00Z', status: 'pending_payment', usd: 5, ves: null, rate: null, ref: null },
  { code: 'PP-ZT004', createdAt: '2032-03-07T15:00:00Z', status: 'failed', usd: 55, ves: null, rate: null, ref: null },
  // expired never reached payment: never listed.
  { code: 'PP-ZT005', createdAt: '2032-03-08T15:00:00Z', status: 'expired', usd: 99, ves: null, rate: null, ref: null },
  // 2032-03-01 23:59:59 Caracas — the day before the range: excluded.
  { code: 'PP-ZT006', createdAt: '2032-03-02T03:59:59Z', status: 'confirmed', usd: 20, ves: 730, rate: 36.5, ref: 'REF006' },
  { code: 'PP-ZT007', createdAt: '2032-03-31T16:00:00Z', status: 'pending_payment', usd: 10, ves: null, rate: null, ref: null },
  // 2032-04-01 00:00 Caracas — the day after the range: excluded.
  { code: 'PP-ZT008', createdAt: '2032-04-01T04:00:00Z', status: 'confirmed', usd: 30, ves: 1095, rate: 36.5, ref: 'REF008' },
];

const seedRow = (s: Seed) => ({
  code: s.code, date: VISIT, first_name: 'Tx', last_name: s.code.slice(-3),
  email: 'seed@example.com', id_type: 'V', id_number: `7700${s.code.slice(-3)}`,
  adults: 1, children: 0, total_usd: s.usd, total_ves: s.ves, bcv_rate: s.rate,
  status: s.status, payment_ref: s.ref, created_at: s.createdAt,
  expires_at: s.status === 'pending_payment' ? '2099-01-01T00:00:00Z' : null,
  checked_in_at: s.status === 'checked_in' ? '2032-03-20T14:00:00Z' : null,
});

const MARCH: TransactionQuery = { dateFrom: '2032-03-02', dateTo: '2032-03-31', page: 1, pageSize: 10 };

beforeAll(async () => {
  await supabase.from('reservations').delete().like('code', CODE_LIKE);
  const { error } = await supabase.from('reservations').insert(SEEDS.map(seedRow));
  if (error) throw new Error(`seed failed: ${error.message}`);
});

afterAll(async () => {
  await supabase.from('reservations').delete().like('code', CODE_LIKE);
});

describe('searchTransactions', () => {
  it('lists payment-stage reservations created in the Caracas range, newest first', async () => {
    const res = await searchTransactions(MARCH);
    expect(res.total).toBe(5);
    expect(res.rows.map((r) => r.code)).toEqual(['PP-ZT007', 'PP-ZT004', 'PP-ZT003', 'PP-ZT002', 'PP-ZT001']);
  });

  it('returns exactly the transaction columns', async () => {
    const { rows } = await searchTransactions(MARCH);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'bcv_rate', 'checked_in_at', 'code', 'created_at', 'first_name', 'id', 'last_name',
      'payment_ref', 'status', 'total_usd', 'total_ves',
    ]);
  });

  it('filters by a single status', async () => {
    const res = await searchTransactions({ ...MARCH, status: 'confirmed' });
    expect(res.rows.map((r) => r.code)).toEqual(['PP-ZT001']);
    expect(res.total).toBe(1);
  });

  it('respects the Caracas day boundary on both ends', async () => {
    const before = await searchTransactions({ ...MARCH, dateFrom: '2032-03-01', dateTo: '2032-03-01' });
    expect(before.rows.map((r) => r.code)).toEqual(['PP-ZT006']);
    const after = await searchTransactions({ ...MARCH, dateFrom: '2032-04-01', dateTo: '2032-04-01' });
    expect(after.rows.map((r) => r.code)).toEqual(['PP-ZT008']);
  });

  it('returns no rows but the real total for a page past the end', async () => {
    await expect(searchTransactions({ ...MARCH, page: 2 })).resolves.toEqual({ rows: [], total: 5 });
  });
});

describe('transactionTotals', () => {
  const expected = { collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 2 };

  it('sums collected and pending for the range (failed/expired ignored)', async () => {
    await expect(transactionTotals(MARCH)).resolves.toEqual(expected);
  });

  it('reads in chunks and still sums every row', async () => {
    // 4 qualifying rows with chunks of 2: two full chunks, then an empty one.
    await expect(transactionTotals(MARCH, 2)).resolves.toEqual(expected);
    await expect(transactionTotals(MARCH, 3)).resolves.toEqual(expected);
  });

  it('is all zeros for an empty range', async () => {
    await expect(transactionTotals({ dateFrom: '2032-03-10', dateTo: '2032-03-11' })).resolves.toEqual({
      collectedUsd: 0, collectedVes: 0, collectedCount: 0, pendingUsd: 0, pendingCount: 0,
    });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run -c vitest.integration.config.ts src/lib/db/transactions.integration.test.ts; rmdir "$L"
```
Expected: FAIL con `Failed to resolve import "./transactions"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/db/transactions.ts
import { serviceClient } from './service-client';
import { pageRange } from './paginate';
import {
  TRANSACTION_STATUSES, caracasDayBoundsUtc, summarizeTransactions,
  type TransactionQuery, type TransactionRow, type TransactionTotals,
} from '@/lib/finance/transactions';

/** Explicit list so rows match TransactionRow exactly (no PII beyond the name). */
const TRANSACTION_COLUMNS =
  'id, code, first_name, last_name, total_usd, bcv_rate, total_ves, status, payment_ref, checked_in_at, created_at';

function filtered(q: Pick<TransactionQuery, 'dateFrom' | 'dateTo' | 'status'>, head: boolean) {
  const { startIso, endIso } = caracasDayBoundsUtc(q.dateFrom, q.dateTo);
  return serviceClient()
    .from('reservations')
    .select(TRANSACTION_COLUMNS, { count: 'exact', head })
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .in('status', q.status ? [q.status] : [...TRANSACTION_STATUSES]);
}

/**
 * C2P transactions created in [dateFrom, dateTo] (Caracas days), newest first.
 * Caller must validate `q` (transactionQuerySchema) and gate on requireAdmin().
 */
export async function searchTransactions(
  q: TransactionQuery,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const { from, to } = pageRange(q.page, q.pageSize);
  const { data, count, error } = await filtered(q, false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true }) // unique tiebreaker keeps pages stable
    .range(from, to);

  // PostgREST answers PGRST103 when the offset is past the last row (count=exact).
  if (error?.code === 'PGRST103') {
    const head = await filtered(q, true);
    if (head.error) throw new Error(head.error.message);
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as TransactionRow[], total: count ?? 0 };
}

/** PostgREST caps every response at max_rows (1000 in supabase/config.toml). */
export const TOTALS_CHUNK = 1000;

/**
 * Collected / pending totals for the whole range (status filter not applied).
 * Reads in chunks so a busy range is never silently truncated by max_rows.
 */
export async function transactionTotals(
  range: { dateFrom: string; dateTo: string },
  chunkSize: number = TOTALS_CHUNK,
): Promise<TransactionTotals> {
  const { startIso, endIso } = caracasDayBoundsUtc(range.dateFrom, range.dateTo);
  const rows: Pick<TransactionRow, 'status' | 'total_usd' | 'total_ves'>[] = [];
  for (let from = 0; ; from += chunkSize) {
    const { data, error } = await serviceClient()
      .from('reservations')
      .select('status, total_usd, total_ves')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .in('status', ['confirmed', 'checked_in', 'pending_payment'])
      .order('id', { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error?.code === 'PGRST103') break; // offset past the end
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as Pick<TransactionRow, 'status' | 'total_usd' | 'total_ves'>[];
    rows.push(...chunk);
    if (chunk.length < chunkSize) break;
  }
  return summarizeTransactions(rows);
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run -c vitest.integration.config.ts src/lib/db/transactions.integration.test.ts; rmdir "$L"
```
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/transactions.ts src/lib/db/transactions.integration.test.ts
git commit -m "feat(admin): add C2P transaction search and chunked totals queries" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lógica pura del historial BCV (variación, sparkline, resumen)

**Files:**
- Create: `src/lib/finance/bcv.ts`
- Test: `src/lib/finance/bcv.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/finance/bcv.test.ts
import { describe, it, expect } from 'vitest';
import type { BcvHistoryRow } from '@/lib/bcv-history';
import {
  formatVariation, rateSummary, sourceLabel, sparklinePoints, variationPct, variationTrend, withVariation,
} from './bcv';

const row = (id: number, rate: number, source: string | null = 'auto'): BcvHistoryRow => ({
  id, rate, source, fetched_at: `2026-10-0${id}T13:00:00Z`,
});

describe('variationPct', () => {
  it('is the % change vs the previous (older) rate', () => {
    expect(variationPct(37, 36.5)).toBeCloseTo(1.369863, 5);
    expect(variationPct(36.5, 40)).toBeCloseTo(-8.75, 10);
    expect(variationPct(36.5, 36.5)).toBe(0);
  });

  it('is null without a usable previous rate', () => {
    expect(variationPct(37, null)).toBeNull();
    expect(variationPct(37, undefined)).toBeNull();
    expect(variationPct(37, 0)).toBeNull();
  });
});

describe('withVariation', () => {
  // Newest first, as listBcvHistory returns them.
  const rows = [row(3, 37), row(2, 36.5), row(1, 36.5)];

  it('compares each row with the next (older) one and the last with the older neighbour', () => {
    const out = withVariation(rows, row(9, 40));
    expect(out.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(out[0].variationPct).toBeCloseTo(1.369863, 5);
    expect(out[1].variationPct).toBe(0);
    expect(out[2].variationPct).toBeCloseTo(-8.75, 10);
  });

  it('leaves the oldest row of all (no neighbour) without variation', () => {
    const out = withVariation(rows, null);
    expect(out[2].variationPct).toBeNull();
  });

  it('handles an empty page', () => {
    expect(withVariation([], null)).toEqual([]);
  });
});

describe('formatVariation / variationTrend', () => {
  it('formats with sign and two decimals', () => {
    expect(formatVariation(1.369863)).toBe('+1.37 %');
    expect(formatVariation(-8.75)).toBe('-8.75 %');
  });

  it('shows 0.00 % without sign when it rounds to zero', () => {
    expect(formatVariation(0)).toBe('0.00 %');
    expect(formatVariation(0.004)).toBe('0.00 %');
    expect(formatVariation(-0.004)).toBe('0.00 %');
  });

  it('shows a dash for the first row', () => {
    expect(formatVariation(null)).toBe('—');
  });

  it('classifies the trend consistently with the rounding', () => {
    expect(variationTrend(1.2)).toBe('up');
    expect(variationTrend(-1.2)).toBe('down');
    expect(variationTrend(-0.004)).toBe('flat');
    expect(variationTrend(null)).toBe('none');
  });
});

describe('sparklinePoints', () => {
  it('spreads x evenly and maps min→bottom, max→top inside the padding', () => {
    expect(sparklinePoints([1, 2, 3], 100, 20, 2)).toEqual([
      { x: 2, y: 18 }, { x: 50, y: 10 }, { x: 98, y: 2 },
    ]);
  });

  it('draws a flat line in the middle when all rates are equal', () => {
    expect(sparklinePoints([5, 5], 100, 20, 2)).toEqual([{ x: 2, y: 10 }, { x: 98, y: 10 }]);
  });

  it('centers a single point and returns nothing for no data', () => {
    expect(sparklinePoints([5], 100, 20, 2)).toEqual([{ x: 50, y: 10 }]);
    expect(sparklinePoints([], 100, 20, 2)).toEqual([]);
  });
});

describe('rateSummary', () => {
  it('gives min, max and the latest (first, newest) rate', () => {
    expect(rateSummary([row(3, 37), row(2, 36.5), row(1, 38)])).toEqual({ min: 36.5, max: 38, last: 37 });
  });

  it('is null for an empty page', () => {
    expect(rateSummary([])).toBeNull();
  });
});

describe('sourceLabel', () => {
  it('names the known sources in Spanish and keeps unknown ones raw', () => {
    expect(sourceLabel('auto')).toBe('Automática');
    expect(sourceLabel('manual')).toBe('Manual');
    expect(sourceLabel('cron')).toBe('cron');
    expect(sourceLabel(null)).toBe('Sin origen');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/finance/bcv.test.ts`
Expected: FAIL con `Failed to resolve import "./bcv"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/finance/bcv.ts
import type { BcvHistoryRow } from '@/lib/bcv-history';

/** Pure helpers for the BCV rate log page (no server-only: unit-testable). */

export interface BcvRowWithVariation extends BcvHistoryRow {
  /** % change vs the chronologically previous rate; null for the oldest row of all. */
  variationPct: number | null;
}

export function variationPct(current: number, previous: number | null | undefined): number | null {
  if (previous == null || !(previous > 0)) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * `rows` are newest first (listBcvHistory order), so the previous rate of
 * rows[i] is rows[i + 1]; the last row compares with `older`, the first row
 * of the next page (null when this page holds the oldest rate).
 */
export function withVariation(rows: BcvHistoryRow[], older: BcvHistoryRow | null): BcvRowWithVariation[] {
  return rows.map((r, i) => ({
    ...r,
    variationPct: variationPct(r.rate, (rows[i + 1] ?? older)?.rate),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type VariationTrend = 'up' | 'down' | 'flat' | 'none';

export function variationTrend(pct: number | null): VariationTrend {
  if (pct == null) return 'none';
  const r = round2(pct);
  if (r === 0) return 'flat';
  return r > 0 ? 'up' : 'down';
}

/** "+1.37 %", "-8.75 %", "0.00 %", "—" (dot decimals, like the rest of the admin). */
export function formatVariation(pct: number | null): string {
  if (pct == null) return '—';
  const r = round2(pct);
  if (r === 0) return '0.00 %';
  return `${r > 0 ? '+' : '-'}${Math.abs(r).toFixed(2)} %`;
}

/** SVG coordinates for a sparkline of `values` (oldest → newest) inside width×height. */
export function sparklinePoints(
  values: number[],
  width: number,
  height: number,
  pad = 2,
): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  return values.map((v, i) => ({
    x: round2(values.length === 1 ? width / 2 : pad + (i * innerW) / (values.length - 1)),
    y: round2(max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * innerH),
  }));
}

/** Text summary of the visible page; `last` is the newest rate (rows are newest first). */
export function rateSummary(rows: Pick<BcvHistoryRow, 'rate'>[]): { min: number; max: number; last: number } | null {
  if (rows.length === 0) return null;
  const rates = rows.map((r) => r.rate);
  return { min: Math.min(...rates), max: Math.max(...rates), last: rates[0] };
}

export function sourceLabel(source: string | null): string {
  if (source === 'auto') return 'Automática';
  if (source === 'manual') return 'Manual';
  return source ?? 'Sin origen';
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/finance/bcv.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/bcv.ts src/lib/finance/bcv.test.ts
git commit -m "feat(admin): add BCV variation, sparkline and summary helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Etiquetas de auditoría (exhaustivas) y params

**Files:**
- Create: `src/lib/audit-labels.ts`
- Test: `src/lib/audit-labels.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/audit-labels.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { AuditAction } from '@/lib/audit';
import {
  AUDIT_ACTIONS, AUDIT_ACTION_LABELS, auditActionLabel, auditLinkParams, auditQuerySchema,
  formatAuditDetails, isAuditAction, parseAuditParams,
} from './audit-labels';

describe('AUDIT_ACTION_LABELS', () => {
  it('has exactly one key per AuditAction (type level, checked by tsc)', () => {
    expectTypeOf<keyof typeof AUDIT_ACTION_LABELS>().toEqualTypeOf<AuditAction>();
    expectTypeOf(AUDIT_ACTIONS).toEqualTypeOf<AuditAction[]>();
  });

  it('covers every action of the roadmap §3.2 contract', () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual([
      'override.delete', 'override.upsert', 'reservation.check_in',
      'reservation.resend_voucher', 'role.upsert', 'settings.update',
    ]);
  });

  it('uses distinct, human Spanish labels (never the raw key)', () => {
    const labels = AUDIT_ACTIONS.map((a) => AUDIT_ACTION_LABELS[a]);
    expect(new Set(labels).size).toBe(labels.length);
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label.trim()).not.toBe('');
      expect(label).not.toBe(action);
      expect(label).not.toContain('.');
    }
    expect(auditActionLabel('reservation.check_in')).toBe('Check-in registrado');
    expect(auditActionLabel('settings.update')).toBe('Configuración actualizada');
  });

  it('shows unknown actions raw', () => {
    expect(auditActionLabel('legacy.thing')).toBe('legacy.thing');
    expect(isAuditAction('legacy.thing')).toBe(false);
    expect(isAuditAction('toString')).toBe(false);
    expect(isAuditAction('role.upsert')).toBe(true);
  });
});

describe('formatAuditDetails', () => {
  it('renders key: value pairs joined by a middle dot', () => {
    expect(formatAuditDetails({ daily_capacity: 80, adult_price_usd: 15 }))
      .toBe('daily_capacity: 80 · adult_price_usd: 15');
  });

  it('shows null/empty values as a dash and nested values as JSON', () => {
    expect(formatAuditDetails({ capacity: 0, reason: null })).toBe('capacity: 0 · reason: —');
    expect(formatAuditDetails({ note: '' })).toBe('note: —');
    expect(formatAuditDetails({ nested: { a: 1 }, flag: true })).toBe('nested: {"a":1} · flag: true');
  });

  it('is a dash when there are no details', () => {
    expect(formatAuditDetails({})).toBe('—');
    expect(formatAuditDetails(null)).toBe('—');
  });
});

describe('parseAuditParams / auditLinkParams / auditQuerySchema', () => {
  it('parses a known action and paging', () => {
    expect(parseAuditParams({ action: 'role.upsert', page: '2', pageSize: '25' }))
      .toEqual({ action: 'role.upsert', page: 2, pageSize: 25 });
  });

  it('drops unknown or empty actions', () => {
    expect(parseAuditParams({ action: 'evil' })).toEqual({ page: 1, pageSize: 10 });
    expect(parseAuditParams({ action: '' })).toEqual({ page: 1, pageSize: 10 });
  });

  it('carries only the action into pagination links', () => {
    expect(auditLinkParams({ action: 'override.delete', page: 3, pageSize: 10 })).toEqual({ action: 'override.delete' });
    expect(auditLinkParams({ page: 1, pageSize: 10 })).toEqual({});
  });

  it('validates action input strictly', () => {
    expect(auditQuerySchema.safeParse({ page: 1, pageSize: 10 }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ action: 'role.upsert', page: 1, pageSize: 10 }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ action: 'evil', page: 1, pageSize: 10 }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ page: 1, pageSize: 99 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/audit-labels.test.ts`
Expected: FAIL con `Failed to resolve import "./audit-labels"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/audit-labels.ts
import { z } from 'zod';
import type { AuditAction } from '@/lib/audit';
import {
  firstParam, pageFields, parsePageParams, type AdminPageSize, type RawSearchParams,
} from '@/lib/admin-page-params';

/**
 * Human Spanish label for every AuditAction. `satisfies Record<AuditAction, …>`
 * makes the build fail when an action is added to src/lib/audit.ts without a
 * label here (or a label is left for an action that no longer exists).
 */
export const AUDIT_ACTION_LABELS = {
  'reservation.check_in': 'Check-in registrado',
  'reservation.resend_voucher': 'Voucher reenviado',
  'settings.update': 'Configuración actualizada',
  'override.upsert': 'Excepción de capacidad guardada',
  'override.delete': 'Excepción de capacidad eliminada',
  'role.upsert': 'Rol de acceso asignado',
} as const satisfies Record<AuditAction, string>;

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

export function isAuditAction(v: unknown): v is AuditAction {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(AUDIT_ACTION_LABELS, v);
}

/** Known actions get their label; anything else (old or foreign rows) is shown raw. */
export function auditActionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

function detailValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** "daily_capacity: 80 · reason: —"; "—" when there is nothing to show. */
export function formatAuditDetails(details: Record<string, unknown> | null | undefined): string {
  const entries = Object.entries(details ?? {});
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${detailValue(v)}`).join(' · ');
}

export interface AuditQuery {
  action?: AuditAction;
  page: number;
  pageSize: AdminPageSize;
}

export const auditQuerySchema = z.object({
  action: z.custom<AuditAction>((v) => isAuditAction(v)).optional(),
  ...pageFields,
});

export function parseAuditParams(sp: RawSearchParams): AuditQuery {
  const { page, pageSize } = parsePageParams(sp);
  const action = firstParam(sp.action);
  return { ...(isAuditAction(action) ? { action } : {}), page, pageSize };
}

export function auditLinkParams(q: AuditQuery): Record<string, string> {
  return q.action ? { action: q.action } : {};
}
```

- [ ] **Step 4: Ejecutar el test y la comprobación de tipos**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/audit-labels.test.ts && npx tsc --noEmit`
Expected: PASS y tsc sin errores. Los `expectTypeOf` solo se verifican con tsc.

- [ ] **Step 5: Comprobar que la exhaustividad de tipos funciona (verificación manual; se revierte)**

Borra temporalmente la línea `'role.upsert': …` de `AUDIT_ACTION_LABELS` y ejecuta `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit`.
Expected: error `Property ''role.upsert'' is missing in type …`. Restaura la línea y vuelve a ejecutar tsc: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit-labels.ts src/lib/audit-labels.test.ts
git commit -m "feat(admin): add exhaustive Spanish audit action labels and params" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Helper de BD de auditoría con filtro por acción

**Files:**
- Create: `src/lib/db/audit-search.ts`
- Test: `src/lib/db/audit-search.integration.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

```ts
// src/lib/db/audit-search.integration.test.ts
import { describe, it, expect } from 'vitest';
import { logAudit, listAudit } from '@/lib/audit';
import { searchAudit } from './audit-search';

// audit_log is append-only: never clean up; use a unique actor/targets and
// compare totals measured before inserting (integration files run serially).
const actor = `it-audit-search-${Date.now()}@club.com`;

describe('searchAudit', () => {
  it('filters by action, newest first, with an exact total', async () => {
    const before = (await searchAudit({ page: 1, pageSize: 1, action: 'role.upsert' })).total;
    await logAudit({ actor, action: 'role.upsert', target: `first-${actor}`, details: { role: 'operator' } });
    await logAudit({ actor, action: 'settings.update', details: { daily_capacity: 80 } });
    await logAudit({ actor, action: 'role.upsert', target: `second-${actor}`, details: { role: 'owner' } });

    const { rows, total } = await searchAudit({ page: 1, pageSize: 2, action: 'role.upsert' });
    expect(total).toBe(before + 2);
    expect(rows.map((r) => r.target)).toEqual([`second-${actor}`, `first-${actor}`]);
    expect(rows.every((r) => r.action === 'role.upsert')).toBe(true);
    expect(rows[0]).toMatchObject({ actor_email: actor, details: { role: 'owner' } });
  });

  it('without an action matches listAudit', async () => {
    const [a, b] = await Promise.all([
      searchAudit({ page: 1, pageSize: 5 }),
      listAudit({ page: 1, pageSize: 5 }),
    ]);
    expect(a.total).toBe(b.total);
    expect(a.rows.map((r) => r.id)).toEqual(b.rows.map((r) => r.id));
  });

  it('returns an empty page past the end with the real filtered total', async () => {
    const first = await searchAudit({ page: 1, pageSize: 1, action: 'role.upsert' });
    const beyond = await searchAudit({ page: 100000, pageSize: 100, action: 'role.upsert' });
    expect(beyond).toEqual({ rows: [], total: first.total });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run -c vitest.integration.config.ts src/lib/db/audit-search.integration.test.ts; rmdir "$L"
```
Expected: FAIL con `Failed to resolve import "./audit-search"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/db/audit-search.ts
import { serviceClient } from './service-client';
import { pageRange } from './paginate';
import type { AuditAction, AuditRow } from '@/lib/audit';

function filtered(action: AuditAction | undefined, head: boolean) {
  let query = serviceClient().from('audit_log').select('*', { count: 'exact', head });
  if (action) query = query.eq('action', action);
  return query;
}

/**
 * Audit log, newest first, optionally narrowed to one action. Same ordering as
 * listAudit. Caller must validate input (auditQuerySchema) and require an owner.
 */
export async function searchAudit(p: {
  page: number;
  pageSize: number;
  action?: AuditAction;
}): Promise<{ rows: AuditRow[]; total: number }> {
  const { from, to } = pageRange(p.page, p.pageSize);
  const { data, count, error } = await filtered(p.action, false)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error?.code === 'PGRST103') {
    const head = await filtered(p.action, true);
    if (head.error) throw new Error(head.error.message);
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run -c vitest.integration.config.ts src/lib/db/audit-search.integration.test.ts; rmdir "$L"
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/audit-search.ts src/lib/db/audit-search.integration.test.ts
git commit -m "feat(admin): add audit log search filtered by action" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Server actions de finanzas y auditoría

**Files:**
- Create: `src/app/admin/finance-actions.ts`
- Test: `src/app/admin/finance-actions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/app/admin/finance-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  searchTransactions: vi.fn(),
  transactionTotals: vi.fn(),
  listBcvHistory: vi.fn(),
  searchAudit: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/transactions', () => ({
  searchTransactions: mocks.searchTransactions,
  transactionTotals: mocks.transactionTotals,
}));
vi.mock('@/lib/bcv-history', () => ({ listBcvHistory: mocks.listBcvHistory }));
vi.mock('@/lib/db/audit-search', () => ({ searchAudit: mocks.searchAudit }));

import { adminBcvHistoryPage, adminListTransactions, adminSearchAudit } from './finance-actions';

const OWNER = { email: 'owner@club.com', role: 'owner' as const };
const totals = { collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 2 };
const bcv = (id: number, rate: number) => ({ id, rate, source: 'auto', fetched_at: '2026-10-04T13:00:00Z' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(OWNER);
});

describe('adminListTransactions', () => {
  const q = { dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 };

  it('gates on any admin and returns the page plus range totals', async () => {
    mocks.searchTransactions.mockResolvedValue({ rows: [{ id: 'r1' }], total: 1 });
    mocks.transactionTotals.mockResolvedValue(totals);
    await expect(adminListTransactions({ ...q, status: 'confirmed' })).resolves.toEqual({
      rows: [{ id: 'r1' }], total: 1, totals,
    });
    expect(mocks.requireAdmin).toHaveBeenCalledWith();
    expect(mocks.searchTransactions).toHaveBeenCalledWith({ ...q, status: 'confirmed' });
    // Totals ignore the status filter: they describe the whole range.
    expect(mocks.transactionTotals).toHaveBeenCalledWith({ dateFrom: q.dateFrom, dateTo: q.dateTo });
  });

  it('never reads data when the gate fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(adminListTransactions(q)).rejects.toThrow('Unauthorized');
    expect(mocks.searchTransactions).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    await expect(adminListTransactions({ ...q, dateFrom: '2026-10-05' })).rejects.toThrow('Invalid query');
    await expect(adminListTransactions({ ...q, status: 'expired' })).rejects.toThrow('Invalid query');
    expect(mocks.searchTransactions).not.toHaveBeenCalled();
  });
});

describe('adminBcvHistoryPage', () => {
  beforeEach(() => mocks.listBcvHistory.mockReset());

  it('asks for row page*pageSize+1 as a 1-row page when the page is full', async () => {
    const page = Array.from({ length: 10 }, (_, i) => bcv(20 - i, 37));
    mocks.listBcvHistory
      .mockResolvedValueOnce({ rows: page, total: 25 })
      .mockResolvedValueOnce({ rows: [bcv(10, 36.63)], total: 25 });
    const res = await adminBcvHistoryPage({ page: 2, pageSize: 10 });
    expect(mocks.listBcvHistory).toHaveBeenNthCalledWith(1, { page: 2, pageSize: 10 });
    expect(mocks.listBcvHistory).toHaveBeenNthCalledWith(2, { page: 21, pageSize: 1 });
    expect(res.total).toBe(25);
    expect(res.rows[0].variationPct).toBe(0);
    expect(res.rows[9].variationPct).toBeCloseTo(((37 - 36.63) / 36.63) * 100, 10);
  });

  it('does not look further on the last (short) page: the oldest row has no variation', async () => {
    mocks.listBcvHistory.mockResolvedValueOnce({ rows: [bcv(2, 37), bcv(1, 36.5)], total: 12 });
    const res = await adminBcvHistoryPage({ page: 2, pageSize: 10 });
    expect(mocks.listBcvHistory).toHaveBeenCalledTimes(1);
    expect(res.rows[1].variationPct).toBeNull();
  });

  it('gates on any admin and validates paging', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(adminBcvHistoryPage({ page: 1, pageSize: 10 })).rejects.toThrow('Unauthorized');
    mocks.requireAdmin.mockResolvedValue(OWNER);
    await expect(adminBcvHistoryPage({ page: 0, pageSize: 10 })).rejects.toThrow('Invalid page');
  });
});

describe('adminSearchAudit', () => {
  it('requires the owner role', async () => {
    mocks.searchAudit.mockResolvedValue({ rows: [], total: 0 });
    await adminSearchAudit({ page: 1, pageSize: 10 });
    expect(mocks.requireAdmin).toHaveBeenCalledWith({ role: 'owner' });
  });

  it('never reads the log for an operator', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Forbidden'));
    await expect(adminSearchAudit({ page: 1, pageSize: 10 })).rejects.toThrow('Forbidden');
    expect(mocks.searchAudit).not.toHaveBeenCalled();
  });

  it('passes a valid action filter and rejects unknown ones', async () => {
    mocks.searchAudit.mockResolvedValue({ rows: [], total: 0 });
    await adminSearchAudit({ action: 'role.upsert', page: 2, pageSize: 25 });
    expect(mocks.searchAudit).toHaveBeenCalledWith({ action: 'role.upsert', page: 2, pageSize: 25 });
    await expect(adminSearchAudit({ action: 'evil', page: 1, pageSize: 10 })).rejects.toThrow('Invalid query');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/finance-actions.test.ts`
Expected: FAIL con `Failed to resolve import "./finance-actions"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/app/admin/finance-actions.ts
'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { searchTransactions, transactionTotals } from '@/lib/db/transactions';
import { searchAudit } from '@/lib/db/audit-search';
import { listBcvHistory } from '@/lib/bcv-history';
import { pageQuerySchema } from '@/lib/admin-page-params';
import {
  transactionQuerySchema, type TransactionRow, type TransactionTotals,
} from '@/lib/finance/transactions';
import { withVariation, type BcvRowWithVariation } from '@/lib/finance/bcv';
import { auditQuerySchema } from '@/lib/audit-labels';
import type { AuditRow } from '@/lib/audit';

/**
 * Read-only finance + audit listings (PR 12). Every function gates itself and
 * validates its input: pages call them, but they are reachable as server
 * actions too. They never write, so there is nothing to audit.
 */

export interface TransactionsPageData {
  rows: TransactionRow[];
  total: number;
  /** For the whole date range (status filter not applied). */
  totals: TransactionTotals;
}

export async function adminListTransactions(raw: unknown): Promise<TransactionsPageData> {
  await requireAdmin();
  const parsed = transactionQuerySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid query');
  const q = parsed.data;
  const [page, totals] = await Promise.all([
    searchTransactions(q),
    transactionTotals({ dateFrom: q.dateFrom, dateTo: q.dateTo }),
  ]);
  return { ...page, totals };
}

export async function adminBcvHistoryPage(
  raw: unknown,
): Promise<{ rows: BcvRowWithVariation[]; total: number }> {
  await requireAdmin();
  const parsed = pageQuerySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid page');
  const { page, pageSize } = parsed.data;
  const { rows, total } = await listBcvHistory({ page, pageSize });
  // The rate just older than this page's last row is the first row of the next
  // page. With 1-row pages, page N is row N, so fetch exactly that row.
  const olderPosition = page * pageSize + 1;
  const older = rows.length === pageSize && olderPosition <= total
    ? (await listBcvHistory({ page: olderPosition, pageSize: 1 })).rows[0] ?? null
    : null;
  return { rows: withVariation(rows, older), total };
}

export async function adminSearchAudit(raw: unknown): Promise<{ rows: AuditRow[]; total: number }> {
  await requireAdmin({ role: 'owner' });
  const parsed = auditQuerySchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid query');
  return searchAudit(parsed.data);
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/finance-actions.test.ts && npx tsc --noEmit`
Expected: PASS y tsc sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/finance-actions.ts src/app/admin/finance-actions.test.ts
git commit -m "feat(admin): add gated finance and audit read actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Componentes de Transacciones (vacío, chip, filtros, totales, lista)

**Files:**
- Create: `src/components/admin/finance/empty-state.tsx`
- Create: `src/components/admin/finance/status-chip.tsx`
- Create: `src/components/admin/finance/transactions-filters.tsx`
- Create: `src/components/admin/finance/transactions-totals.tsx`
- Create: `src/components/admin/finance/transactions-list.tsx`
- Test: `src/components/admin/finance/transactions.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/finance/transactions.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReceiptText } from 'lucide-react';
import type { TransactionRow } from '@/lib/finance/transactions';
import { EmptyState } from './empty-state';
import { StatusChip } from './status-chip';
import { TransactionsFilters } from './transactions-filters';
import { TransactionsTotals, paymentsLabel } from './transactions-totals';
import { TransactionsList } from './transactions-list';

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 'r1', code: 'PP-AAAAA', first_name: 'Ana', last_name: 'Pérez',
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
    payment_ref: 'C2P-123', checked_in_at: null, created_at: '2026-10-04T14:05:00Z',
    ...over,
  };
}

describe('EmptyState', () => {
  it('announces a title and an explanation', () => {
    render(<EmptyState icon={ReceiptText} title="Nada por aquí">Prueba otro rango.</EmptyState>);
    const box = screen.getByRole('status');
    expect(within(box).getByText('Nada por aquí')).toBeInTheDocument();
    expect(within(box).getByText('Prueba otro rango.')).toBeInTheDocument();
  });
});

describe('StatusChip', () => {
  it('reuses the central status label and colour', () => {
    render(<StatusChip row={{ status: 'pending_payment', checked_in_at: null }} />);
    expect(screen.getByText('Pago en verificación')).toHaveClass('bg-amber-100');
  });
});

describe('TransactionsFilters', () => {
  it('is a GET form prefilled with the current query that keeps the page size', () => {
    const { container } = render(
      <TransactionsFilters query={{ dateFrom: '2026-09-05', dateTo: '2026-10-04', status: 'failed', page: 3, pageSize: 25 }} />,
    );
    const form = screen.getByRole('form', { name: 'Filtros de transacciones' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/admin/finance/transactions');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-05');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-10-04');
    expect(screen.getByLabelText('Estado')).toHaveValue('failed');
    expect(container.querySelector('input[type="hidden"][name="pageSize"]')).toHaveValue('25');
    // No page input: filtering always goes back to page 1.
    expect(container.querySelector('[name="page"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Restablecer' })).toHaveAttribute('href', '/admin/finance/transactions');
  });

  it('offers every transaction status plus "Todos"', () => {
    render(<TransactionsFilters query={{ dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 }} />);
    const options = within(screen.getByLabelText('Estado')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Todos', 'Confirmada', 'Ingresó', 'Pago en verificación', 'Fallida']);
    expect(screen.getByLabelText('Estado')).toHaveValue('');
  });

  it('uses 44px controls', () => {
    render(<TransactionsFilters query={{ dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 }} />);
    expect(screen.getByLabelText('Desde')).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: 'Filtrar' })).toHaveClass('h-11');
  });
});

describe('TransactionsTotals', () => {
  it('shows collected in USD and Bs., and pending in USD only', () => {
    render(<TransactionsTotals totals={{ collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 1 }} />);
    const region = screen.getByRole('region', { name: 'Totales del rango' });
    const collected = within(region).getByTestId('totals-collected');
    expect(within(collected).getByText('$50.00')).toBeInTheDocument();
    expect(within(collected).getByText('Bs. 1825.00 · 2 pagos')).toBeInTheDocument();
    const pending = within(region).getByTestId('totals-pending');
    expect(within(pending).getByText('$15.00')).toBeInTheDocument();
    expect(within(pending).getByText(/1 pago · el monto en Bs\. se fija al confirmar/)).toBeInTheDocument();
  });

  it('pluralizes payments', () => {
    expect(paymentsLabel(0)).toBe('0 pagos');
    expect(paymentsLabel(1)).toBe('1 pago');
    expect(paymentsLabel(7)).toBe('7 pagos');
  });
});

describe('TransactionsList', () => {
  const rows = [
    tx(),
    tx({ id: 'r2', code: 'PP-BBBBB', status: 'pending_payment', payment_ref: null, bcv_rate: null, total_ves: null, total_usd: 5 }),
  ];

  it('renders a desktop table with every column in Caracas time', () => {
    render(<TransactionsList rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha/hora de creación', 'Código', 'Cliente', 'Monto USD', 'Tasa BCV', 'Monto Bs.', 'Referencia C2P', 'Estado',
    ]);
    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first).getByText('04/10/2026 10:05')).toBeInTheDocument();
    expect(within(first).getByText('PP-AAAAA')).toBeInTheDocument();
    expect(within(first).getByText('Ana Pérez')).toBeInTheDocument();
    expect(within(first).getByText('$35.00')).toBeInTheDocument();
    expect(within(first).getByText('Bs. 36.5000')).toBeInTheDocument();
    expect(within(first).getByText('Bs. 1277.50')).toBeInTheDocument();
    expect(within(first).getByText('C2P-123')).toBeInTheDocument();
    expect(within(first).getByText('Confirmada')).toBeInTheDocument();
    // Pending: no rate, no Bs. amount and no C2P reference yet.
    expect(within(second).getAllByText('—')).toHaveLength(3);
    expect(within(second).getByText('Pago en verificación')).toBeInTheDocument();
  });

  it('renders one stacked card per row for mobile', () => {
    render(<TransactionsList rows={rows} />);
    const cards = screen.getAllByTestId('tx-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('PP-AAAAA')).toBeInTheDocument();
    expect(within(cards[0]).getByText('C2P-123')).toBeInTheDocument();
    expect(within(cards[1]).getAllByText('—')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/finance/transactions.test.tsx`
Expected: FAIL con `Failed to resolve import "./empty-state"`.

- [ ] **Step 3: Implementar `empty-state.tsx`**

```tsx
// src/components/admin/finance/empty-state.tsx
import type { LucideIcon } from 'lucide-react';

/** Empty-list notice shared by the finance and audit pages (server component). */
export function EmptyState(props: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center"
    >
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-semibold">{props.title}</p>
      {props.children && <p className="max-w-sm text-sm text-muted-foreground">{props.children}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Implementar `status-chip.tsx`**

```tsx
// src/components/admin/finance/status-chip.tsx
import { cn } from '@/lib/utils';
import { STATUS_CHIP_CLASS, statusLabelEs } from '@/lib/reservation-status';
import type { ReservationRow } from '@/lib/db/reservations';

/** Status pill using the central colours/labels (src/lib/reservation-status.ts, owned by PR 10). */
export function StatusChip({ row }: { row: Pick<ReservationRow, 'status' | 'checked_in_at'> }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold',
        STATUS_CHIP_CLASS[row.status],
      )}
    >
      {statusLabelEs(row)}
    </span>
  );
}
```

- [ ] **Step 5: Implementar `transactions-filters.tsx`**

```tsx
// src/components/admin/finance/transactions-filters.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ADMIN_ACTION, ADMIN_INPUT } from '@/components/admin/ui-constants';
import { statusLabelEs } from '@/lib/reservation-status';
import { TRANSACTION_STATUSES, type TransactionQuery } from '@/lib/finance/transactions';

export const TRANSACTIONS_PATH = '/admin/finance/transactions';

const FIELD = cn(ADMIN_INPUT, 'w-full rounded-lg border border-border bg-background px-3');
const GROUP = 'grid gap-1';
const LABEL = 'text-sm font-medium';

/**
 * Plain GET form (no client JS). It has no `page` field, so applying filters
 * always lands on page 1; the page size is kept in a hidden field.
 * Labels use htmlFor (not wrapping) so a select's option text never leaks
 * into its accessible name.
 */
export function TransactionsFilters({ query }: { query: TransactionQuery }) {
  return (
    <form
      method="get"
      action={TRANSACTIONS_PATH}
      aria-label="Filtros de transacciones"
      className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end"
    >
      <div className={GROUP}>
        <label htmlFor="tx-from" className={LABEL}>Desde</label>
        <input id="tx-from" type="date" name="from" defaultValue={query.dateFrom} className={FIELD} />
      </div>
      <div className={GROUP}>
        <label htmlFor="tx-to" className={LABEL}>Hasta</label>
        <input id="tx-to" type="date" name="to" defaultValue={query.dateTo} className={FIELD} />
      </div>
      <div className={GROUP}>
        <label htmlFor="tx-status" className={LABEL}>Estado</label>
        <select id="tx-status" name="status" defaultValue={query.status ?? ''} className={FIELD}>
          <option value="">Todos</option>
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabelEs({ status: s, checked_in_at: null })}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name="pageSize" defaultValue={query.pageSize} />
      <button
        type="submit"
        className={cn(ADMIN_ACTION, 'cursor-pointer rounded-lg bg-navy-deep font-semibold text-white')}
      >
        Filtrar
      </button>
      <Link
        href={TRANSACTIONS_PATH}
        className={cn(ADMIN_ACTION, 'inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted')}
      >
        Restablecer
      </Link>
    </form>
  );
}
```

- [ ] **Step 6: Implementar `transactions-totals.tsx`**

```tsx
// src/components/admin/finance/transactions-totals.tsx
import { formatBs, formatUsd } from '@/lib/finance/format';
import type { TransactionTotals } from '@/lib/finance/transactions';

export function paymentsLabel(n: number): string {
  return n === 1 ? '1 pago' : `${n} pagos`;
}

/** Totals for the whole date range (status filter not applied). */
export function TransactionsTotals({ totals }: { totals: TransactionTotals }) {
  return (
    <section aria-label="Totales del rango" className="grid gap-3 sm:grid-cols-2">
      <div data-testid="totals-collected" className="rounded-2xl border bg-white p-4">
        <p className="text-sm text-muted-foreground">Cobrado (confirmadas + ingresaron)</p>
        <p className="text-2xl font-extrabold tabular-nums">{formatUsd(totals.collectedUsd)}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {`${formatBs(totals.collectedVes)} · ${paymentsLabel(totals.collectedCount)}`}
        </p>
      </div>
      <div data-testid="totals-pending" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">Por verificar</p>
        <p className="text-2xl font-extrabold tabular-nums text-amber-900">{formatUsd(totals.pendingUsd)}</p>
        <p className="text-sm text-amber-900/80">
          {`${paymentsLabel(totals.pendingCount)} · el monto en Bs. se fija al confirmar`}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Implementar `transactions-list.tsx`**

```tsx
// src/components/admin/finance/transactions-list.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EMPTY, caracasDateTime, formatBs, formatRate, formatUsd } from '@/lib/finance/format';
import type { TransactionRow } from '@/lib/finance/transactions';
import { StatusChip } from './status-chip';

const NUM = 'text-right tabular-nums';

/** Stacked cards below `md`, a table from `md` up. */
export function TransactionsList({ rows }: { rows: TransactionRow[] }) {
  return (
    <>
      <ul aria-label="Transacciones" className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="tx-card" className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono font-semibold">{r.code}</span>
              <StatusChip row={r} />
            </div>
            <p className="mt-1 text-sm font-medium">{r.first_name} {r.last_name}</p>
            <p className="text-xs text-muted-foreground">{caracasDateTime(r.created_at)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 text-sm">
              <dt className="text-muted-foreground">Monto USD</dt>
              <dd className={NUM}>{formatUsd(r.total_usd)}</dd>
              <dt className="text-muted-foreground">Tasa BCV</dt>
              <dd className={NUM}>{formatRate(r.bcv_rate)}</dd>
              <dt className="text-muted-foreground">Monto Bs.</dt>
              <dd className={NUM}>{formatBs(r.total_ves)}</dd>
              <dt className="text-muted-foreground">Referencia C2P</dt>
              <dd className="break-all text-right font-mono">{r.payment_ref || EMPTY}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/hora de creación</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Monto USD</TableHead>
              <TableHead className="text-right">Tasa BCV</TableHead>
              <TableHead className="text-right">Monto Bs.</TableHead>
              <TableHead>Referencia C2P</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{caracasDateTime(r.created_at)}</TableCell>
                <TableCell className="font-mono font-semibold">{r.code}</TableCell>
                <TableCell>{r.first_name} {r.last_name}</TableCell>
                <TableCell className={NUM}>{formatUsd(r.total_usd)}</TableCell>
                <TableCell className={NUM}>{formatRate(r.bcv_rate)}</TableCell>
                <TableCell className={NUM}>{formatBs(r.total_ves)}</TableCell>
                <TableCell className="font-mono">{r.payment_ref || EMPTY}</TableCell>
                <TableCell><StatusChip row={r} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
```

Nota: en la fila de tabla, `{r.first_name} {r.last_name}` se renderiza como un solo nodo de texto "Ana Pérez" dentro de la celda, y `getByText` lo encuentra porque RTL normaliza el contenido del elemento.

- [ ] **Step 8: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/finance/transactions.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/finance/empty-state.tsx src/components/admin/finance/status-chip.tsx src/components/admin/finance/transactions-filters.tsx src/components/admin/finance/transactions-totals.tsx src/components/admin/finance/transactions-list.tsx src/components/admin/finance/transactions.test.tsx
git commit -m "feat(admin): add C2P transaction filters, totals and list components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Página `/admin/finance/transactions`

**Files:**
- Create: `src/app/admin/(dashboard)/finance/transactions/page.tsx`
- Test: `src/app/admin/(dashboard)/finance/transactions/page.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/app/admin/(dashboard)/finance/transactions/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TransactionRow } from '@/lib/finance/transactions';

const mocks = vi.hoisted(() => ({ adminListTransactions: vi.fn() }));

vi.mock('@/app/admin/finance-actions', () => ({ adminListTransactions: mocks.adminListTransactions }));
vi.mock('@/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dates')>()),
  todayCaracas: () => '2026-10-04',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import TransactionsPage from './page';

const zeroTotals = { collectedUsd: 0, collectedVes: 0, collectedCount: 0, pendingUsd: 0, pendingCount: 0 };

function tx(i: number): TransactionRow {
  return {
    id: `r${i}`, code: `PP-AAA${i}${i}`, first_name: 'Ana', last_name: 'Pérez',
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
    payment_ref: `C2P-${i}`, checked_in_at: null, created_at: '2026-10-04T14:05:00Z',
  };
}

async function renderPage(sp: Record<string, string | string[] | undefined>) {
  render(await TransactionsPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminListTransactions.mockResolvedValue({ rows: [], total: 0, totals: zeroTotals });
});

describe('/admin/finance/transactions', () => {
  it('defaults to the last 30 Caracas days, page 1 of 10', async () => {
    await renderPage({});
    expect(mocks.adminListTransactions).toHaveBeenCalledWith({
      dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Transacciones C2P' })).toBeInTheDocument();
  });

  it('passes parsed filters and paging to the action', async () => {
    await renderPage({ from: '2026-09-01', to: '2026-09-30', status: 'pending_payment', page: '2', pageSize: '25' });
    expect(mocks.adminListTransactions).toHaveBeenCalledWith({
      dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'pending_payment', page: 2, pageSize: 25,
    });
  });

  it('shows an empty state and no pagination when the range has no transactions', async () => {
    await renderPage({});
    expect(screen.getByText('No hay transacciones en este rango')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    // Totals are still shown (all zeros) so the range is explicit.
    expect(screen.getByRole('region', { name: 'Totales del rango' })).toBeInTheDocument();
  });

  it('renders rows, totals and pagination links that keep the filters', async () => {
    mocks.adminListTransactions.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, i) => tx(i)),
      total: 25,
      totals: { collectedUsd: 350, collectedVes: 12775, collectedCount: 10, pendingUsd: 0, pendingCount: 0 },
    });
    await renderPage({ from: '2026-09-01', to: '2026-09-30', status: 'confirmed' });

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    expect(within(screen.getByTestId('totals-collected')).getByText('$350.00')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–10 de 25 transacciones')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /paginación/i });
    expect(within(nav).getByRole('link', { name: 'Página 2' })).toHaveAttribute(
      'href',
      '/admin/finance/transactions?from=2026-09-01&to=2026-09-30&status=confirmed&page=2&pageSize=10',
    );
  });

  it('explains an out-of-range page instead of looking empty', async () => {
    mocks.adminListTransactions.mockResolvedValue({ rows: [], total: 25, totals: zeroTotals });
    await renderPage({ page: '9' });
    expect(screen.getByText('Esta página no tiene resultados')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run "src/app/admin/(dashboard)/finance/transactions/page.test.tsx"`
Expected: FAIL con `Failed to resolve import "./page"`.

- [ ] **Step 3: Implementar la página**

```tsx
// src/app/admin/(dashboard)/finance/transactions/page.tsx
import { ReceiptText } from 'lucide-react';
import { adminListTransactions } from '@/app/admin/finance-actions';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/admin/finance/empty-state';
import { TRANSACTIONS_PATH, TransactionsFilters } from '@/components/admin/finance/transactions-filters';
import { TransactionsTotals } from '@/components/admin/finance/transactions-totals';
import { TransactionsList } from '@/components/admin/finance/transactions-list';
import { todayCaracas } from '@/lib/dates';
import { parseTransactionParams, transactionLinkParams } from '@/lib/finance/transactions';
import type { RawSearchParams } from '@/lib/admin-page-params';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseTransactionParams(await searchParams, todayCaracas());
  const { rows, total, totals } = await adminListTransactions(query);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold">Transacciones C2P</h1>
        <p className="text-sm text-muted-foreground">
          Reservas que llegaron al pago, por fecha de creación (hora de Caracas).
        </p>
      </header>

      <TransactionsFilters query={query} />
      <TransactionsTotals totals={totals} />

      {total === 0 ? (
        <EmptyState icon={ReceiptText} title="No hay transacciones en este rango">
          Prueba con otras fechas o con otro estado.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Esta página no tiene resultados">
          Vuelve a la primera página con la paginación de abajo.
        </EmptyState>
      ) : (
        <TransactionsList rows={rows} />
      )}

      {total > 0 && (
        <Pagination
          pathname={TRANSACTIONS_PATH}
          params={transactionLinkParams(query)}
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          noun="transacciones"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run "src/app/admin/(dashboard)/finance/transactions/page.test.tsx" && npx tsc --noEmit`
Expected: PASS y tsc sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/finance/transactions/page.tsx" "src/app/admin/(dashboard)/finance/transactions/page.test.tsx"
git commit -m "feat(admin): add C2P transactions page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Componentes de Tasas BCV (sparkline + lista)

**Files:**
- Create: `src/components/admin/finance/bcv-sparkline.tsx`
- Create: `src/components/admin/finance/bcv-history-list.tsx`
- Test: `src/components/admin/finance/bcv.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/finance/bcv.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { BcvRowWithVariation } from '@/lib/finance/bcv';
import { BcvSparkline } from './bcv-sparkline';
import { BcvHistoryList } from './bcv-history-list';

const r = (id: number, rate: number, variationPct: number | null, source: string | null = 'auto'): BcvRowWithVariation => ({
  id, rate, source, variationPct, fetched_at: `2026-10-0${id}T13:00:00Z`,
});

// Newest first, like the action returns them.
const rows = [r(3, 37, 1.369863, 'manual'), r(2, 36.5, 0), r(1, 36.5, null, null)];

describe('BcvSparkline', () => {
  it('draws the page oldest→newest and summarizes it in text', () => {
    render(<BcvSparkline rows={rows} />);
    const svg = screen.getByTestId('bcv-sparkline');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // 3 points, newest (37 = max) on the right at the top.
    expect(svg.querySelector('polyline')).toHaveAttribute('points', '2,46 120,46 238,2');
    expect(svg.querySelector('circle')).toHaveAttribute('cx', '238');
    expect(screen.getByText('En esta página: mín. Bs. 36.5000 · máx. Bs. 37.0000 · último Bs. 37.0000')).toBeInTheDocument();
  });

  it('skips the line with a single rate but keeps the summary', () => {
    render(<BcvSparkline rows={[r(1, 36.5, null)]} />);
    expect(screen.queryByTestId('bcv-sparkline')).toBeNull();
    expect(screen.getByText(/último Bs\. 36\.5000/)).toBeInTheDocument();
  });

  it('renders nothing without rows', () => {
    const { container } = render(<BcvSparkline rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('BcvHistoryList', () => {
  it('renders a table with Caracas time, rate, source chip and variation', () => {
    render(<BcvHistoryList rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha (Caracas)', 'Tasa', 'Origen', 'Variación',
    ]);
    const [, newest, middle, oldest] = within(table).getAllByRole('row');
    expect(within(newest).getByText('03/10/2026 09:00')).toBeInTheDocument();
    expect(within(newest).getByText('Bs. 37.0000')).toBeInTheDocument();
    expect(within(newest).getByText('Manual')).toHaveClass('bg-sky-100');
    expect(within(newest).getByText('+1.37 %')).toHaveClass('text-amber-700');
    expect(within(middle).getByText('Automática')).toBeInTheDocument();
    expect(within(middle).getByText('0.00 %')).toBeInTheDocument();
    expect(within(oldest).getByText('Sin origen')).toBeInTheDocument();
    expect(within(oldest).getByText('—')).toHaveAttribute('title', 'Sin registro anterior');
  });

  it('renders one card per rate for mobile', () => {
    render(<BcvHistoryList rows={rows} />);
    const cards = screen.getAllByTestId('bcv-card');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('+1.37 %')).toBeInTheDocument();
  });
});
```

Cálculo esperado de la polyline (W=240, H=48, pad=2): los valores en orden cronológico son `[36.5, 36.5, 37]`. x = 2, 2+236/2 = 120, 238. y: los dos mínimos quedan en `2 + 1*44 = 46` y el máximo en `2`. Las fechas `2026-10-0NT13:00:00Z` son las 09:00 en Caracas.

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/finance/bcv.test.tsx`
Expected: FAIL con `Failed to resolve import "./bcv-sparkline"`.

- [ ] **Step 3: Implementar `bcv-sparkline.tsx`**

```tsx
// src/components/admin/finance/bcv-sparkline.tsx
import type { BcvHistoryRow } from '@/lib/bcv-history';
import { rateSummary, sparklinePoints } from '@/lib/finance/bcv';
import { formatRate } from '@/lib/finance/format';

const W = 240;
const H = 48;

/**
 * Minimal inline SVG trend of the visible page (no chart library, no motion).
 * The SVG is decorative (aria-hidden); the figcaption carries the same
 * information as text for screen readers and for everyone else.
 */
export function BcvSparkline({ rows }: { rows: Pick<BcvHistoryRow, 'rate'>[] }) {
  const summary = rateSummary(rows);
  if (!summary) return null;
  const points = sparklinePoints([...rows].reverse().map((r) => r.rate), W, H);
  const last = points[points.length - 1];

  return (
    <figure className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      {points.length >= 2 && (
        <svg
          data-testid="bcv-sparkline"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          aria-hidden="true"
          className="h-12 w-60 shrink-0 text-teal-600"
        >
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={last.x} cy={last.y} r={3} fill="currentColor" />
        </svg>
      )}
      <figcaption className="text-sm tabular-nums text-muted-foreground">
        {`En esta página: mín. ${formatRate(summary.min)} · máx. ${formatRate(summary.max)} · último ${formatRate(summary.last)}`}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Implementar `bcv-history-list.tsx`**

```tsx
// src/components/admin/finance/bcv-history-list.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { caracasDateTime, formatRate } from '@/lib/finance/format';
import {
  formatVariation, sourceLabel, variationTrend, type BcvRowWithVariation, type VariationTrend,
} from '@/lib/finance/bcv';

const SOURCE_CHIP: Record<string, string> = {
  auto: 'bg-slate-100 text-slate-700',
  manual: 'bg-sky-100 text-sky-800',
};

const TREND_CLASS: Record<VariationTrend, string> = {
  up: 'text-amber-700',
  down: 'text-teal-700',
  flat: 'text-muted-foreground',
  none: 'text-muted-foreground',
};

function SourceChip({ source }: { source: string | null }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold',
        SOURCE_CHIP[source ?? ''] ?? 'bg-slate-50 text-slate-500',
      )}
    >
      {sourceLabel(source)}
    </span>
  );
}

function Variation({ pct }: { pct: number | null }) {
  const trend = variationTrend(pct);
  return (
    <span
      className={cn('tabular-nums font-medium', TREND_CLASS[trend])}
      title={trend === 'none' ? 'Sin registro anterior' : undefined}
    >
      {formatVariation(pct)}
    </span>
  );
}

/** Stacked cards below `md`, a table from `md` up. Rows are newest first. */
export function BcvHistoryList({ rows }: { rows: BcvRowWithVariation[] }) {
  return (
    <>
      <ul aria-label="Tasas BCV" className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="bcv-card" className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-lg font-extrabold tabular-nums">{formatRate(r.rate)}</span>
              <SourceChip source={r.source} />
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{caracasDateTime(r.fetched_at)}</span>
              <Variation pct={r.variationPct} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha (Caracas)</TableHead>
              <TableHead className="text-right">Tasa</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Variación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{caracasDateTime(r.fetched_at)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(r.rate)}</TableCell>
                <TableCell><SourceChip source={r.source} /></TableCell>
                <TableCell className="text-right"><Variation pct={r.variationPct} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/finance/bcv.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/finance/bcv-sparkline.tsx src/components/admin/finance/bcv-history-list.tsx src/components/admin/finance/bcv.test.tsx
git commit -m "feat(admin): add BCV rate sparkline and history list components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Página `/admin/finance/bcv`

**Files:**
- Create: `src/app/admin/(dashboard)/finance/bcv/page.tsx`
- Test: `src/app/admin/(dashboard)/finance/bcv/page.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/app/admin/(dashboard)/finance/bcv/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ adminBcvHistoryPage: vi.fn() }));

vi.mock('@/app/admin/finance-actions', () => ({ adminBcvHistoryPage: mocks.adminBcvHistoryPage }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import BcvPage from './page';

const row = (id: number, rate: number) => ({
  id, rate, source: 'auto', fetched_at: '2026-10-04T13:00:00Z', variationPct: null,
});

async function renderPage(sp: Record<string, string | string[] | undefined>) {
  render(await BcvPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminBcvHistoryPage.mockResolvedValue({ rows: [], total: 0 });
});

describe('/admin/finance/bcv', () => {
  it('parses paging from the URL', async () => {
    await renderPage({ page: '3', pageSize: '25' });
    expect(mocks.adminBcvHistoryPage).toHaveBeenCalledWith({ page: 3, pageSize: 25 });
    expect(screen.getByRole('heading', { level: 1, name: 'Tasas BCV' })).toBeInTheDocument();
  });

  it('shows an empty state without pagination when nothing was recorded', async () => {
    await renderPage({});
    expect(mocks.adminBcvHistoryPage).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByText('Aún no hay tasas registradas')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
  });

  it('renders the sparkline, the list and pagination', async () => {
    mocks.adminBcvHistoryPage.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, i) => row(30 - i, 36 + i / 10)),
      total: 30,
    });
    await renderPage({});
    expect(screen.getByTestId('bcv-sparkline')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('Mostrando 1–10 de 30 registros')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: /paginación/i }))
      .getByRole('link', { name: 'Página 2' })).toHaveAttribute('href', '/admin/finance/bcv?page=2&pageSize=10');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run "src/app/admin/(dashboard)/finance/bcv/page.test.tsx"`
Expected: FAIL con `Failed to resolve import "./page"`.

- [ ] **Step 3: Implementar la página**

```tsx
// src/app/admin/(dashboard)/finance/bcv/page.tsx
import { ChartLine } from 'lucide-react';
import { adminBcvHistoryPage } from '@/app/admin/finance-actions';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/admin/finance/empty-state';
import { BcvSparkline } from '@/components/admin/finance/bcv-sparkline';
import { BcvHistoryList } from '@/components/admin/finance/bcv-history-list';
import { parsePageParams, type RawSearchParams } from '@/lib/admin-page-params';

export const dynamic = 'force-dynamic';

const BCV_PATH = '/admin/finance/bcv';

export default async function BcvPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { page, pageSize } = parsePageParams(await searchParams);
  const { rows, total } = await adminBcvHistoryPage({ page, pageSize });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold">Tasas BCV</h1>
        <p className="text-sm text-muted-foreground">
          Historial de tasas oficiales obtenidas por la app (hora de Caracas).
        </p>
      </header>

      {total === 0 ? (
        <EmptyState icon={ChartLine} title="Aún no hay tasas registradas">
          La primera tasa se guarda cuando la app consulta al BCV.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ChartLine} title="Esta página no tiene resultados">
          Vuelve a la primera página con la paginación de abajo.
        </EmptyState>
      ) : (
        <>
          <BcvSparkline rows={rows} />
          <BcvHistoryList rows={rows} />
        </>
      )}

      {total > 0 && (
        <Pagination pathname={BCV_PATH} params={{}} page={page} pageSize={pageSize} total={total} noun="registros" />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run "src/app/admin/(dashboard)/finance/bcv/page.test.tsx" && npx tsc --noEmit`
Expected: PASS y tsc sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/finance/bcv/page.tsx" "src/app/admin/(dashboard)/finance/bcv/page.test.tsx"
git commit -m "feat(admin): add BCV rate history page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Componentes de Auditoría (filtro + lista)

**Files:**
- Create: `src/components/admin/audit/audit-filters.tsx`
- Create: `src/components/admin/audit/audit-list.tsx`
- Test: `src/components/admin/audit/audit.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/audit/audit.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AuditAction, AuditRow } from '@/lib/audit';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from '@/lib/audit-labels';
import { AuditFilters } from './audit-filters';
import { AuditList } from './audit-list';

const rows: AuditRow[] = [
  {
    id: 2, at: '2026-10-04T14:05:00Z', actor_email: 'dueno@club.com', action: 'settings.update',
    target: null, details: { daily_capacity: 80, adult_price_usd: 15 },
  },
  {
    id: 1, at: '2026-10-03T20:00:00Z', actor_email: 'ops@club.com', action: 'legacy.thing' as AuditAction,
    target: 'PP-AAAAA', details: {},
  },
];

describe('AuditFilters', () => {
  it('is a GET form with every labelled action and keeps the page size', () => {
    const { container } = render(<AuditFilters query={{ action: 'role.upsert', page: 2, pageSize: 25 }} />);
    const form = screen.getByRole('form', { name: 'Filtro de auditoría' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/admin/audit');
    const select = screen.getByLabelText('Acción');
    expect(select).toHaveValue('role.upsert');
    expect(select).toHaveClass('h-11');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todas las acciones', ...AUDIT_ACTIONS.map((a) => AUDIT_ACTION_LABELS[a]),
    ]);
    expect(container.querySelector('input[type="hidden"][name="pageSize"]')).toHaveValue('25');
    expect(screen.getByRole('link', { name: 'Restablecer' })).toHaveAttribute('href', '/admin/audit');
  });
});

describe('AuditList', () => {
  it('renders a table with Caracas time, actor, Spanish action, target and compact details', () => {
    render(<AuditList rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha (Caracas)', 'Actor', 'Acción', 'Objetivo', 'Detalles',
    ]);
    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first).getByText('04/10/2026 10:05')).toBeInTheDocument();
    expect(within(first).getByText('dueno@club.com')).toBeInTheDocument();
    expect(within(first).getByText('Configuración actualizada')).toBeInTheDocument();
    expect(within(first).getByText('daily_capacity: 80 · adult_price_usd: 15')).toBeInTheDocument();
    // No target and no details: dashes.
    expect(within(first).getAllByText('—')).toHaveLength(1);
    // Unknown action is shown raw, in monospace.
    expect(within(second).getByText('legacy.thing')).toHaveClass('font-mono');
    expect(within(second).getByText('PP-AAAAA')).toBeInTheDocument();
  });

  it('renders one card per entry for mobile', () => {
    render(<AuditList rows={rows} />);
    const cards = screen.getAllByTestId('audit-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Configuración actualizada')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/audit/audit.test.tsx`
Expected: FAIL con `Failed to resolve import "./audit-filters"`.

- [ ] **Step 3: Implementar `audit-filters.tsx`**

```tsx
// src/components/admin/audit/audit-filters.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ADMIN_ACTION, ADMIN_INPUT } from '@/components/admin/ui-constants';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AuditQuery } from '@/lib/audit-labels';

export const AUDIT_PATH = '/admin/audit';

/** Plain GET form: filtering goes back to page 1, page size is kept. */
export function AuditFilters({ query }: { query: AuditQuery }) {
  return (
    <form
      method="get"
      action={AUDIT_PATH}
      aria-label="Filtro de auditoría"
      className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
    >
      <div className="grid gap-1">
        {/* htmlFor, not wrapping: option text must not leak into the label. */}
        <label htmlFor="audit-action" className="text-sm font-medium">Acción</label>
        <select
          id="audit-action"
          name="action"
          defaultValue={query.action ?? ''}
          className={cn(ADMIN_INPUT, 'w-full rounded-lg border border-border bg-background px-3')}
        >
          <option value="">Todas las acciones</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{AUDIT_ACTION_LABELS[a]}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name="pageSize" defaultValue={query.pageSize} />
      <button
        type="submit"
        className={cn(ADMIN_ACTION, 'cursor-pointer rounded-lg bg-navy-deep font-semibold text-white')}
      >
        Filtrar
      </button>
      <Link
        href={AUDIT_PATH}
        className={cn(ADMIN_ACTION, 'inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted')}
      >
        Restablecer
      </Link>
    </form>
  );
}
```

- [ ] **Step 4: Implementar `audit-list.tsx`**

```tsx
// src/components/admin/audit/audit-list.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EMPTY, caracasDateTime } from '@/lib/finance/format';
import { auditActionLabel, formatAuditDetails, isAuditAction } from '@/lib/audit-labels';
import type { AuditRow } from '@/lib/audit';

function ActionLabel({ action }: { action: string }) {
  // Unknown values (older or foreign rows) are shown raw, visibly different.
  return (
    <span className={cn('font-medium', !isAuditAction(action) && 'font-mono text-muted-foreground')}>
      {auditActionLabel(action)}
    </span>
  );
}

/** Stacked cards below `md`, a table from `md` up. Rows are newest first. */
export function AuditList({ rows }: { rows: AuditRow[] }) {
  return (
    <>
      <ul aria-label="Registro de auditoría" className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="audit-card" className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <ActionLabel action={r.action} />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{caracasDateTime(r.at)}</span>
            </div>
            <p className="mt-1 break-all text-sm">{r.actor_email}</p>
            {r.target && <p className="break-all font-mono text-xs text-muted-foreground">{r.target}</p>}
            <p className="mt-2 break-words border-t pt-2 text-xs text-muted-foreground">{formatAuditDetails(r.details)}</p>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha (Caracas)</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{caracasDateTime(r.at)}</TableCell>
                <TableCell>{r.actor_email}</TableCell>
                <TableCell><ActionLabel action={r.action} /></TableCell>
                <TableCell className="font-mono text-xs">{r.target || EMPTY}</TableCell>
                <TableCell className="max-w-md whitespace-normal break-words text-xs text-muted-foreground">
                  {formatAuditDetails(r.details)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
```

Nota: en el test, la primera fila tiene `target: null` (→ "—") y detalles no vacíos, así que hay exactamente un "—".

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/audit/audit.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/audit/audit-filters.tsx src/components/admin/audit/audit-list.tsx src/components/admin/audit/audit.test.tsx
git commit -m "feat(admin): add audit log filter and list components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Página `/admin/audit` (solo dueño)

**Files:**
- Create: `src/app/admin/(dashboard)/audit/page.tsx`
- Test: `src/app/admin/(dashboard)/audit/page.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/app/admin/(dashboard)/audit/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), adminSearchAudit: vi.fn() }));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/app/admin/finance-actions', () => ({ adminSearchAudit: mocks.adminSearchAudit }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import AuditPage from './page';

const entry = (id: number) => ({
  id, at: '2026-10-04T14:05:00Z', actor_email: 'dueno@club.com', action: 'role.upsert',
  target: 'ops@club.com', details: { role: 'operator' },
});

async function renderPage(sp: Record<string, string | string[] | undefined> = {}) {
  render(await AuditPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'dueno@club.com', role: 'owner' });
  mocks.adminSearchAudit.mockResolvedValue({ rows: [], total: 0 });
});

describe('/admin/audit', () => {
  it('shows operators a friendly notice and never reads the log', async () => {
    mocks.requireAdmin.mockResolvedValue({ email: 'ops@club.com', role: 'operator' });
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeInTheDocument();
    expect(screen.getByText('Solo el dueño puede ver la auditoría.')).toBeInTheDocument();
    expect(mocks.adminSearchAudit).not.toHaveBeenCalled();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('propagates auth failures (fail closed)', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('Unauthorized');
    expect(mocks.adminSearchAudit).not.toHaveBeenCalled();
  });

  it('owners get the log filtered and paginated from the URL', async () => {
    await renderPage({ action: 'role.upsert', page: '2', pageSize: '25' });
    expect(mocks.adminSearchAudit).toHaveBeenCalledWith({ action: 'role.upsert', page: 2, pageSize: 25 });
  });

  it('drops an unknown action filter', async () => {
    await renderPage({ action: 'evil' });
    expect(mocks.adminSearchAudit).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('shows an empty state without pagination', async () => {
    await renderPage();
    expect(screen.getByText('No hay acciones registradas')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
  });

  it('renders entries with pagination links that keep the action', async () => {
    mocks.adminSearchAudit.mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => entry(i + 1)), total: 12 });
    await renderPage({ action: 'role.upsert' });
    expect(within(screen.getByRole('table')).getAllByText('Rol de acceso asignado')).toHaveLength(10);
    expect(within(screen.getByRole('navigation', { name: /paginación/i }))
      .getByRole('link', { name: 'Página 2' }))
      .toHaveAttribute('href', '/admin/audit?action=role.upsert&page=2&pageSize=10');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run "src/app/admin/(dashboard)/audit/page.test.tsx"`
Expected: FAIL con `Failed to resolve import "./page"`.

- [ ] **Step 3: Implementar la página**

```tsx
// src/app/admin/(dashboard)/audit/page.tsx
import { ScrollText } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminSearchAudit } from '@/app/admin/finance-actions';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/admin/finance/empty-state';
import { AUDIT_PATH, AuditFilters } from '@/components/admin/audit/audit-filters';
import { AuditList } from '@/components/admin/audit/audit-list';
import { auditLinkParams, parseAuditParams } from '@/lib/audit-labels';
import type { RawSearchParams } from '@/lib/admin-page-params';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  // Owner-only (roadmap §3.2). Operators get a notice instead of an error page,
  // like settings; adminSearchAudit re-checks the owner role on its own.
  const me = await requireAdmin();
  const heading = <h1 className="text-xl font-extrabold">Auditoría</h1>;
  if (me.role !== 'owner') {
    return (
      <div className="space-y-5">
        <header>{heading}</header>
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Solo el dueño puede ver la auditoría.
        </p>
      </div>
    );
  }

  const query = parseAuditParams(await searchParams);
  const { rows, total } = await adminSearchAudit(query);

  return (
    <div className="space-y-5">
      <header>
        {heading}
        <p className="text-sm text-muted-foreground">
          Acciones de los administradores, de la más reciente a la más antigua (hora de Caracas).
        </p>
      </header>

      <AuditFilters query={query} />

      {total === 0 ? (
        <EmptyState icon={ScrollText} title="No hay acciones registradas">
          {query.action ? 'Prueba con otra acción o quita el filtro.' : 'Aquí aparecerán los cambios hechos desde el panel.'}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Esta página no tiene resultados">
          Vuelve a la primera página con la paginación de abajo.
        </EmptyState>
      ) : (
        <AuditList rows={rows} />
      )}

      {total > 0 && (
        <Pagination
          pathname={AUDIT_PATH}
          params={auditLinkParams(query)}
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          noun="registros"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run "src/app/admin/(dashboard)/audit/page.test.tsx" && npx tsc --noEmit`
Expected: PASS y tsc sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/audit/page.tsx" "src/app/admin/(dashboard)/audit/page.test.tsx"
git commit -m "feat(admin): add owner-only audit log page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Activar los ítems en el menú

**Files:**
- Modify: `src/components/admin/nav-config.ts` (solo los 3 `ready`)
- Modify: `src/components/admin/nav-config.test.ts`
- Modify: `src/components/admin/admin-shell.test.tsx`

- [ ] **Step 1: Actualizar los tests (que fallarán)**

En `src/components/admin/nav-config.test.ts`, sustituye el primer `describe` y el `describe('visibleNavGroups')` (solo los dos primeros `it`) por:

```ts
describe('NAV_GROUPS (roadmap §3.4 contract)', () => {
  it('declares every admin route in its group, with finance and audit ready', () => {
    const shape = NAV_GROUPS.map((g) => ({
      label: g.label,
      items: g.items.map((i) => ({ href: i.href, label: i.label, ownerOnly: !!i.ownerOnly, ready: i.ready })),
    }));
    expect(shape).toEqual([
      { label: 'Operaciones', items: [
        { href: '/admin', label: 'Hoy', ownerOnly: false, ready: true },
        { href: '/admin/reservations', label: 'Reservas', ownerOnly: false, ready: false },
      ] },
      { label: 'Finanzas', items: [
        { href: '/admin/finance/transactions', label: 'Transacciones C2P', ownerOnly: false, ready: true },
        { href: '/admin/finance/bcv', label: 'Tasas BCV', ownerOnly: false, ready: true },
      ] },
      { label: 'Gestión', items: [
        { href: '/admin/settings', label: 'Configuración', ownerOnly: true, ready: true },
        { href: '/admin/audit', label: 'Auditoría', ownerOnly: true, ready: true },
      ] },
    ]);
  });
});

describe('visibleNavGroups', () => {
  it('shows an owner only the ready items and drops empty groups', () => {
    const groups = visibleNavGroups('owner');
    expect(groups.map((g) => g.label)).toEqual(['Operaciones', 'Finanzas', 'Gestión']);
    expect(hrefs(groups)).toEqual([
      '/admin', '/admin/finance/transactions', '/admin/finance/bcv', '/admin/settings', '/admin/audit',
    ]);
  });

  it('hides owner-only items from an operator', () => {
    const groups = visibleNavGroups('operator');
    expect(groups.map((g) => g.label)).toEqual(['Operaciones', 'Finanzas']);
    expect(hrefs(groups)).toEqual(['/admin', '/admin/finance/transactions', '/admin/finance/bcv']);
  });
```

Deja tal cual el tercer `it` ("applies ready and role independently") y el resto del archivo. La llave de cierre `});` del `describe('visibleNavGroups')` ya existe tras ese tercer `it`.

En `src/components/admin/admin-shell.test.tsx`, sustituye los tests `'hides owner-only items from operators'` y `'does not render routes that are not ready yet'` por:

```tsx
  it('hides owner-only items from operators', () => {
    renderShell('operator');
    expect(screen.queryByRole('link', { name: 'Configuración' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Auditoría' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Transacciones C2P' })).toHaveAttribute('href', '/admin/finance/transactions');
    expect(screen.getByRole('link', { name: 'Tasas BCV' })).toHaveAttribute('href', '/admin/finance/bcv');
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  it('shows owners the finance and audit pages', () => {
    renderShell('owner');
    expect(screen.getByRole('link', { name: 'Transacciones C2P' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasas BCV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Auditoría' })).toHaveAttribute('href', '/admin/audit');
  });

  it('does not render routes that are not ready yet', () => {
    renderShell('owner');
    expect(screen.queryByRole('link', { name: 'Reservas' })).toBeNull();
  });
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/nav-config.test.ts src/components/admin/admin-shell.test.tsx`
Expected: FAIL (`ready: false` en lugar de `true`, y no se encuentra el link "Transacciones C2P").

- [ ] **Step 3: Activar los ítems**

En `src/components/admin/nav-config.ts` cambia **solo** el `ready` de estas tres líneas:

```ts
      { href: '/admin/finance/transactions', label: 'Transacciones C2P', icon: ReceiptText, ready: true },
      { href: '/admin/finance/bcv', label: 'Tasas BCV', icon: ChartLine, ready: true },
```
```ts
      { href: '/admin/audit', label: 'Auditoría', icon: ScrollText, ownerOnly: true, ready: true },
```

- [ ] **Step 4: Ejecutar los tests del shell y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/`
Expected: PASS. En ese directorio están también `admin-drawer.test.tsx` y `admin-nav-links.test.tsx`, que buscan links por nombre y siguen siendo válidos.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/nav-config.ts src/components/admin/nav-config.test.ts src/components/admin/admin-shell.test.tsx
git commit -m "feat(admin): enable C2P transactions, BCV rates and audit in the nav" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Smoke e2e de las tres páginas

**Files:**
- Create: `e2e/admin-finance-audit.spec.ts`

- [ ] **Step 1: Escribir el spec**

```ts
// e2e/admin-finance-audit.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Local admin credentials live outside the repo. In a worktree, point
// ADMIN_CREDENTIALS_FILE at the main checkout's file; CI has none → skip.
const CREDS_FILE =
  process.env.ADMIN_CREDENTIALS_FILE ?? path.join(process.cwd(), 'supabase', '.local-admin-credentials.txt');

function readCreds(): { email: string; password: string } | null {
  if (!fs.existsSync(CREDS_FILE)) return null;
  const txt = fs.readFileSync(CREDS_FILE, 'utf8');
  const email = /^email:\s*(.+)$/m.exec(txt)?.[1]?.trim();
  const password = /^password:\s*(.+)$/m.exec(txt)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

const creds = readCreds();
test.skip(!creds, 'local admin credentials not available');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(creds!.email);
  await page.getByLabel('Password').fill(creds!.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('finance and audit pages render for the local admin', async ({ page }) => {
  await login(page);

  await page.goto('/admin/finance/transactions');
  await expect(page.getByRole('heading', { level: 1, name: 'Transacciones C2P' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Totales del rango' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Filtros de transacciones' })).toBeVisible();

  await page.goto('/admin/finance/bcv');
  await expect(page.getByRole('heading', { level: 1, name: 'Tasas BCV' })).toBeVisible();

  await page.goto('/admin/audit');
  await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible();
});

test('the transactions filter goes back to page 1 and keeps the range in the URL', async ({ page }) => {
  await login(page);
  await page.goto('/admin/finance/transactions?page=3');
  await page.getByLabel('Estado').selectOption('confirmed');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/status=confirmed/);
  await expect(page).not.toHaveURL(/page=3/);
  await expect(page.getByLabel('Estado')).toHaveValue('confirmed');
});
```

- [ ] **Step 2: Ejecutar el e2e (con lock y puerto libre)**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy"; else source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ADMIN_CREDENTIALS_FILE=/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt npx playwright test e2e/admin-finance-audit.spec.ts; fi; rmdir "$L"
```
Expected: `2 passed`. Si sale "port 3100 busy", espera a que se libere y repite. No mates procesos ajenos. Si el admin local fuera `operator`, el primer test igual pasa (Auditoría siempre muestra el `h1`).

- [ ] **Step 3: Comprobar que se salta sin credenciales**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ADMIN_CREDENTIALS_FILE=/nonexistent npx playwright test e2e/admin-finance-audit.spec.ts --list`
Expected: lista los 2 tests sin errores de carga. En ejecución real quedarían como `skipped`.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-finance-audit.spec.ts
git commit -m "test(e2e): smoke the finance and audit admin pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Verificación final

**Files:** ninguno (solo se corrige lo que falle, con un commit `fix(admin): …`).

- [ ] **Step 1: Tipos, lint y unit tests**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test
```
Expected: sin errores; todos los tests en verde.

- [ ] **Step 2: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run build`
Expected: build OK. Las rutas `/admin/finance/transactions`, `/admin/finance/bcv` y `/admin/audit` aparecen como dinámicas (`ƒ`).

- [ ] **Step 3: Integración completa (con lock)**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:integration; rmdir "$L"
```
Expected: todos en verde, incluidos `transactions.integration.test.ts` y `audit-search.integration.test.ts`.

- [ ] **Step 4: e2e completo (con lock y puerto libre)**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy"; else source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ADMIN_CREDENTIALS_FILE=/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt npm run test:e2e; fi; rmdir "$L"
```
Expected: todos en verde.

- [ ] **Step 5: Revisión de alcance**

Run: `git diff --stat origin/develop...HEAD`
Expected: solo los archivos del "Mapa de archivos". Ni `src/app/admin/actions.ts`, ni `src/lib/audit.ts`, ni `src/lib/db/reservations.ts`, ni `src/lib/reservation-status.ts`, ni `supabase/migrations/` aparecen.

- [ ] **Step 6: Informar al coordinador** de los puntos de "Preguntas abiertas / desviaciones" de abajo. No hagas push ni abras el PR.

---

## Preguntas abiertas / desviaciones (para el coordinador)

1. **El filtro de fechas usa `created_at` y no la fecha de visita.** Por eso no se reutiliza `searchReservations`, que filtra por `date`, y se añade `searchTransactions` en un archivo nuevo. Si el dueño prefiere filtrar por día de visita, basta con cambiar `.gte/.lt('created_at', …)` por `.gte/.lte('date', …)` en `src/lib/db/transactions.ts` y el título de la columna.
2. **Los totales ignoran el filtro de estado** (son "del rango"), y "Por verificar" no muestra Bs. porque `total_ves` es `null` hasta confirmar. "Por verificar" cuenta todo `pending_payment`, incluso los ya vencidos por `expires_at` sin barrer, igual que la campana del topbar.
3. **Archivos compartidos**: `nav-config.test.ts` y `admin-shell.test.tsx` se editan, lo que dará un conflicto trivial con el PR 10, que activa "Reservas" en las mismas líneas.
4. **`AUDIT_ACTION_LABELS satisfies Record<AuditAction, string>`**: si otro PR de la ola (p. ej. el PR 11 con el refresco BCV) añade un valor a `AuditAction`, el build fallará hasta que se añada su etiqueta aquí. Es intencionado. Quien mergee segundo añade la etiqueta.
5. **e2e**: el spec lee `ADMIN_CREDENTIALS_FILE`, porque el worktree no contiene `supabase/.local-admin-credentials.txt`. Sin esa variable ni el archivo, el spec se salta.
6. **Rango máximo de 366 días** y **tasas con 4 decimales** son decisiones propias, no venían en el pedido.
