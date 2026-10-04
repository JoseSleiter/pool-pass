# PR 02 — Búsqueda de reservas server-side, check-ins por hora y prueba social del fin de semana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al backend la búsqueda paginada de reservas (`searchReservations` / `adminSearchReservations`), la serie `checkinsByHour` en `DaySummary` y la acción pública `getWeekendBookedPeople`, tal como fija el roadmap maestro §3.2.

**Architecture:** Una migración (`0008_party_size.sql`) añade la columna generada `party_size = adults + children`, para que PostgREST pueda filtrar por tipo de grupo y ordenar por número de personas sin RPC ni vista. La lógica pura (validación zod de la consulta, saneado de términos de búsqueda para `.or()`/`ilike`, paginación, cálculo del fin de semana en hora Caracas, agrupación de check-ins por hora) vive en módulos sin `server-only` con tests unitarios; las funciones de BD se prueban con tests de integración contra Supabase local.

**Tech Stack:** Next.js 16 (server actions), React 19, TypeScript, Supabase (PostgREST vía `@supabase/supabase-js`), zod 4, Vitest (unit + integration), Supabase CLI vía `npx supabase`.

**Rama / worktree:** `feat/backend-reservation-search` en `.worktrees/feat/backend-reservation-search`, creada desde `origin/develop`. Todas las rutas de este plan son relativas a la raíz del worktree.

---

## Desviaciones del roadmap

No hay desviaciones de contrato: los nombres y firmas de §3.2 se usan tal cual. Precisiones que el roadmap no fijaba:

1. **Migración `0008_party_size.sql` (columna generada).** El roadmap (§2) dice "derivado, sin columna nueva". `party_size` no es un dato nuevo: es una columna **generada** (`generated always as (adults + children) stored`) que nadie escribe. Se eligió en vez de:
   - *filtros `.or()` sobre adults/children*: sirven para `guestType`, pero **no** permiten ordenar por `adults + children` (sort `guests`), y además chocarían con el `.or()` de la búsqueda de texto;
   - *vista SQL*: duplica grants/RLS y obliga a consultar dos relaciones distintas;
   - *RPC*: habría que reimplementar en SQL los filtros, el orden dinámico y el conteo exacto que PostgREST ya da.
2. **`ReservationRow` no cambia.** `searchReservations` pide una lista explícita de columnas (sin `party_size`), así las filas encajan con la interfaz y no se tocan las 5 fixtures de tests de componentes que construyen `ReservationRow` completo. Las consultas existentes con `select('*')` devuelven `party_size` en runtime como propiedad extra inofensiva.
3. **`checkinsByHour` es disperso:** solo horas con al menos una persona, en orden ascendente (`[{ hour: 9, people: 3 }, { hour: 11, people: 2 }]`). El gráfico de PR 09 decide qué rango de horas pintar.
4. **`adminSearchReservations` lanza `Error('Invalid query')`** si la validación falla (igual que `adminListReservations` lanza `'Invalid date'`); la firma de §3.2 no tiene campo `ok`.
5. **`getWeekendBookedPeople` devuelve `null` también si la BD falla** (lo registra con `console.error`): es prueba social en la landing y nunca debe romper la página.
6. **Búsqueda multi-término:** `q` se parte en palabras (máx. 5) y **cada** palabra debe aparecer en alguno de `first_name`, `last_name`, `code`, `id_number` (así "Ana Pérez" funciona). No hay `unaccent`: "perez" no encuentra "Pérez".

**Preguntas abiertas / riesgos:**
- **Orden de migraciones con PR 01:** si PR 02 se mergea antes que PR 01, la BD de producción tendrá `0008` aplicada antes que `0005–0007`, y `npx supabase db push` pedirá `--include-all`. Recomendado: mergear PR 01 antes que PR 02, o desplegar ambas migraciones juntas.
- **Conflictos de merge con PR 01** en `src/app/admin/actions.ts` (imports) y `src/app/admin/actions.test.ts` (factory de `vi.mock('@/lib/db/reservations')`). Son conflictos de líneas contiguas, triviales de resolver. Este PR solo hace `await requireAdmin()` sin usar el valor de retorno.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/migrations/0008_party_size.sql` | Crear | Columna generada `party_size` |
| `src/lib/reservation-search.ts` | Crear | Lógica pura: schema zod de `ReservationQuery`, términos de búsqueda saneados, filtro `.or()`, whitelist de orden, rango de página |
| `src/lib/reservation-search.test.ts` | Crear | Unit tests de lo anterior |
| `src/lib/dates.ts` | Modificar | `caracasHour(iso)` y `upcomingWeekend(today)` |
| `src/lib/dates.test.ts` | Modificar | Unit tests de las dos funciones nuevas |
| `src/lib/day-stats.ts` | Crear | `bucketCheckinsByHour(rows)` |
| `src/lib/day-stats.test.ts` | Crear | Unit tests |
| `src/lib/db/reservations.ts` | Modificar | `ReservationQuery`, `searchReservations`, `sumPartySize` |
| `src/lib/db/reservation-search.integration.test.ts` | Crear | Integración: `party_size`, `searchReservations`, `sumPartySize` |
| `src/app/admin/actions.ts` | Modificar | `adminSearchReservations`, `DaySummary.checkinsByHour` |
| `src/app/admin/actions.test.ts` | Modificar | Gating, validación, reenvío de la consulta, `checkinsByHour` |
| `src/components/admin/metric-cards.test.tsx` | Modificar | Fixture de `DaySummary` con `checkinsByHour: []` (si no, `tsc`/`next build` fallan) |
| `src/app/actions/booking.ts` | Modificar | `getWeekendBookedPeople` |
| `src/app/actions/booking.test.ts` | Modificar | Unit tests con reloj falso |

---

### Task 1: Preparar el worktree y la línea base

**Files:** ninguno (solo entorno).

- [ ] **Step 1: Crear el worktree desde `develop`**

Desde la raíz del repo principal:

```bash
git fetch origin develop
git worktree add .worktrees/feat/backend-reservation-search -b feat/backend-reservation-search origin/develop
cd .worktrees/feat/backend-reservation-search
npm ci
cp ../../../.env.local .env.local
```

Si `git fetch` falla con `Permission denied (publickey)`, ejecutar una vez `gh auth setup-git && git remote set-url origin https://github.com/JoseSleiter/pool-pass.git` y repetir.

- [ ] **Step 2: Levantar Supabase local**

```bash
npx supabase start
npx supabase status
```

Expected: `API URL: http://127.0.0.1:54321` y `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Si ya estaba levantado desde el repo principal, `start` lo indica y basta (comparten `project_id`).

- [ ] **Step 3: Línea base verde**

```bash
npm test
npm run test:integration
```

Expected: ambos PASS. Si algo falla ya en la línea base, parar y avisar antes de seguir.

---

### Task 2: Migración `0008_party_size.sql`

**Files:**
- Create: `supabase/migrations/0008_party_size.sql`
- Create: `src/lib/db/reservation-search.integration.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

Crear `src/lib/db/reservation-search.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { ReservationRow } from './reservations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);

// Isolated window: nothing else in the suite books in 2031-04 / 2031-05.
const RANGE_FROM = '2031-04-01';
const RANGE_TO = '2031-05-31';
const MAIN_FROM = '2031-04-01';
const MAIN_TO = '2031-04-30';
const PAGE_DATE = '2031-05-10';

interface Seed {
  code: string; date: string; first: string; last: string; idNumber: string;
  adults: number; children: number; totalUsd: number; status: ReservationRow['status'];
}

const seedRow = (s: Seed) => ({
  code: s.code, date: s.date, first_name: s.first, last_name: s.last,
  email: 'seed@example.com', id_type: 'V', id_number: s.idNumber,
  adults: s.adults, children: s.children, total_usd: s.totalUsd, status: s.status,
  expires_at: s.status === 'pending_payment' ? '2099-01-01T00:00:00Z' : null,
  checked_in_at: s.status === 'checked_in' ? '2031-04-05T14:00:00Z' : null,
});

// Codes have 5 chars after "PP-" in production; these have 6, so they never collide.
const MAIN: Seed[] = [
  { code: 'PP-ZQ001', date: '2031-04-05', first: 'Ana', last: 'Pérez', idNumber: '11111111', adults: 1, children: 0, totalUsd: 15, status: 'confirmed' },
  { code: 'PP-ZQ002', date: '2031-04-05', first: 'Luis', last: 'Gómez', idNumber: '22222222', adults: 2, children: 1, totalUsd: 35, status: 'checked_in' },
  { code: 'PP-ZQ003', date: '2031-04-12', first: 'Maria', last: 'Garcia', idNumber: '33333333', adults: 0, children: 1, totalUsd: 5, status: 'pending_payment' },
  { code: 'PP-ZQ004', date: '2031-04-20', first: 'Pedro', last: 'Alvarez', idNumber: '44444444', adults: 3, children: 2, totalUsd: 55, status: 'failed' },
  { code: 'PP-ZQ005', date: '2031-04-20', first: 'Ana', last: 'Zamora', idNumber: '55555555', adults: 2, children: 0, totalUsd: 30, status: 'expired' },
];

// 12 rows on one date to exercise pagination; total_usd 1..12 gives a stable order.
const PAGED: Seed[] = Array.from({ length: 12 }, (_, i) => ({
  code: `PP-ZP${String(i + 1).padStart(3, '0')}`, date: PAGE_DATE, first: 'Pag', last: 'Ina',
  idNumber: String(90000000 + i), adults: 1, children: 0, totalUsd: i + 1, status: 'confirmed' as const,
}));

beforeAll(async () => {
  await supabase.from('reservations').delete().gte('date', RANGE_FROM).lte('date', RANGE_TO);
  const { error } = await supabase.from('reservations').insert([...MAIN, ...PAGED].map(seedRow));
  if (error) throw new Error(`seed failed: ${error.message}`);
});

afterAll(async () => {
  await supabase.from('reservations').delete().gte('date', RANGE_FROM).lte('date', RANGE_TO);
});

describe('party_size generated column', () => {
  it('equals adults + children for every row', async () => {
    const { data, error } = await supabase
      .from('reservations').select('code, party_size')
      .gte('date', MAIN_FROM).lte('date', MAIN_TO).order('code');
    expect(error).toBeNull();
    expect(data).toEqual([
      { code: 'PP-ZQ001', party_size: 1 },
      { code: 'PP-ZQ002', party_size: 3 },
      { code: 'PP-ZQ003', party_size: 1 },
      { code: 'PP-ZQ004', party_size: 5 },
      { code: 'PP-ZQ005', party_size: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservation-search.integration.test.ts`
Expected: FAIL — `error` no es `null` (`column reservations.party_size does not exist`).

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/0008_party_size.sql`:

```sql
-- 0008_party_size.sql
-- Total people per reservation (adults + children), maintained by Postgres.
-- Stored so the admin search can filter by guest type (individual = 1,
-- family >= 2) and sort by group size server-side through PostgREST, without
-- an RPC or a view. Nobody writes it: inserts/updates keep working unchanged.
-- Table-level grants from 0001/0003 already cover the new column.
alter table public.reservations
  add column party_size int generated always as (adults + children) stored;
```

- [ ] **Step 4: Aplicar la migración en local**

Run: `npx supabase migration up`
Expected: `Applying migration 0008_party_size.sql...` y `Local database is up to date.` (Si el CLI se queja del historial local, usar `npx supabase db reset`, que reaplica 0001–0008 desde cero.)

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservation-search.integration.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0008_party_size.sql src/lib/db/reservation-search.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(db): add generated party_size column

Lets PostgREST filter by guest type and sort by group size
without an RPC or a view.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Términos de búsqueda saneados y filtro `.or()`

**Files:**
- Create: `src/lib/reservation-search.ts`
- Create: `src/lib/reservation-search.test.ts`

Contexto de seguridad: `.or()` de supabase-js envía una cadena que PostgREST interpreta como árbol lógico; `,` `.` `(` `)` `:` `"` `\` son sintaxis, y en un patrón `ilike` `%` `_` son comodines y PostgREST traduce `*` a `%`. La defensa es doble: (1) **lista blanca** — solo sobreviven letras Unicode, dígitos, espacios, `'` y `-`; todo lo demás se convierte en espacio; (2) el valor va **entre comillas dobles** con `\` y `"` escapados, por si la lista blanca se amplía en el futuro.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/reservation-search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { searchTerms, termOrFilter } from './reservation-search';

describe('searchTerms', () => {
  it('returns no terms for empty / whitespace / undefined input', () => {
    expect(searchTerms(undefined)).toEqual([]);
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('splits on whitespace and keeps accents', () => {
    expect(searchTerms('  Ana   Pérez ')).toEqual(['Ana', 'Pérez']);
  });

  it('keeps reservation codes and apostrophes intact', () => {
    expect(searchTerms('PP-AB12C')).toEqual(['PP-AB12C']);
    expect(searchTerms("O'Brien")).toEqual(["O'Brien"]);
  });

  it('collapses dotted id numbers and drops a V-/E-/P-/J- prefix', () => {
    expect(searchTerms('12.345.678')).toEqual(['12345678']);
    expect(searchTerms('V-12345678')).toEqual(['12345678']);
    expect(searchTerms('j-1234567')).toEqual(['1234567']);
  });

  it('turns PostgREST and LIKE metacharacters into separators', () => {
    expect(searchTerms('a,status.eq.failed')).toEqual(['a', 'status', 'eq', 'failed']);
    expect(searchTerms('x)or(y')).toEqual(['x', 'or', 'y']);
    expect(searchTerms('100%_*"\\:')).toEqual(['100']);
  });

  it('drops terms made only of punctuation', () => {
    expect(searchTerms("Ana - ' Pérez")).toEqual(['Ana', 'Pérez']);
  });

  it('keeps at most 5 terms', () => {
    expect(searchTerms('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('termOrFilter', () => {
  it('ORs a quoted ilike pattern over name, code and id number', () => {
    expect(termOrFilter('Ana')).toBe(
      'first_name.ilike."%Ana%",last_name.ilike."%Ana%",code.ilike."%Ana%",id_number.ilike."%Ana%"'
    );
  });

  it('escapes double quotes and backslashes inside the quoted value', () => {
    expect(termOrFilter('a"b\\c')).toBe(
      [
        'first_name.ilike."%a\\"b\\\\c%"',
        'last_name.ilike."%a\\"b\\\\c%"',
        'code.ilike."%a\\"b\\\\c%"',
        'id_number.ilike."%a\\"b\\\\c%"',
      ].join(',')
    );
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/reservation-search.test.ts`
Expected: FAIL — `Failed to resolve import "./reservation-search"`.

- [ ] **Step 3: Implementación mínima**

Crear `src/lib/reservation-search.ts`:

```ts
/**
 * Pure helpers for the admin reservation search. No `server-only` here so the
 * logic is unit-testable; the DB call lives in src/lib/db/reservations.ts.
 */

/** Columns a free-text term is matched against (ilike, substring). */
export const SEARCH_COLUMNS = ['first_name', 'last_name', 'code', 'id_number'] as const;

const MAX_TERMS = 5;

/**
 * Splits a free-text query into safe search terms.
 * Allow-list: Unicode letters, digits, whitespace, apostrophe and hyphen. Every
 * other character (PostgREST syntax `, . ( ) : " \`, LIKE wildcards `% _`,
 * PostgREST's `*` wildcard) becomes a separator, so a term can never alter the
 * filter tree or widen the ilike pattern.
 */
export function searchTerms(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .normalize('NFC')
    .replace(/(\d)\.(?=\d)/g, '$1')        // 12.345.678 -> 12345678
    .replace(/(^|\s)[VEPJ]-(?=\d)/gi, '$1') // V-12345678 -> 12345678
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .slice(0, MAX_TERMS);
}

/** Double-quotes a PostgREST filter value, escaping `\` and `"`. */
function quoteValue(v: string): string {
  return `"${v.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** PostgREST `.or()` body: the term appears (case-insensitive) in any SEARCH_COLUMNS. */
export function termOrFilter(term: string): string {
  const pattern = quoteValue(`%${term}%`);
  return SEARCH_COLUMNS.map((c) => `${c}.ilike.${pattern}`).join(',');
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/reservation-search.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservation-search.ts src/lib/reservation-search.test.ts
git commit -m "$(cat <<'EOF'
feat(search): sanitize reservation search terms

Allow-list characters and quote the ilike value so user input
cannot reshape the PostgREST or() filter.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Tipo `ReservationQuery`, schema zod, orden y paginación

**Files:**
- Modify: `src/lib/db/reservations.ts` (añadir la interfaz justo después de `ReservationRow`)
- Modify: `src/lib/reservation-search.ts`
- Modify: `src/lib/reservation-search.test.ts`

- [ ] **Step 1: Añadir la interfaz `ReservationQuery` (contrato §3.2)**

En `src/lib/db/reservations.ts`, inmediatamente después del cierre de `export interface ReservationRow { ... }`, añadir:

```ts
export interface ReservationQuery {
  dateFrom?: string; dateTo?: string;           // YYYY-MM-DD, inclusive
  statuses?: ReservationRow['status'][];
  q?: string;                                    // nombre, apellido, código PP-XXXX o número de documento
  guestType?: 'individual' | 'family';
  sort?: { by: 'date' | 'code' | 'name' | 'guests' | 'total_usd' | 'status'; dir: 'asc' | 'desc' };
  page: number;                                  // 1-based
  pageSize: 10 | 25 | 50;
}
```

- [ ] **Step 2: Escribir los tests que fallan**

En `src/lib/reservation-search.test.ts`, cambiar la línea de import por:

```ts
import {
  searchTerms, termOrFilter, parseReservationQuery, pageRange, SORT_COLUMNS, DEFAULT_SORT,
} from './reservation-search';
```

y añadir al final del archivo:

```ts
describe('parseReservationQuery', () => {
  const base = { page: 1, pageSize: 10 };

  it('accepts the minimal query', () => {
    expect(parseReservationQuery(base)).toEqual({ page: 1, pageSize: 10 });
  });

  it('accepts a full query and dedupes statuses', () => {
    expect(parseReservationQuery({
      dateFrom: '2030-01-01', dateTo: '2030-01-31',
      statuses: ['failed', 'expired', 'failed'],
      q: '  Ana  ', guestType: 'family',
      sort: { by: 'name', dir: 'asc' },
      page: 3, pageSize: 50,
    })).toEqual({
      dateFrom: '2030-01-01', dateTo: '2030-01-31',
      statuses: ['failed', 'expired'],
      q: 'Ana', guestType: 'family',
      sort: { by: 'name', dir: 'asc' },
      page: 3, pageSize: 50,
    });
  });

  it('coerces numeric strings coming from URL params', () => {
    expect(parseReservationQuery({ page: '2', pageSize: '25' })).toEqual({ page: 2, pageSize: 25 });
  });

  it('normalizes a blank q and an empty statuses list to undefined', () => {
    const r = parseReservationQuery({ ...base, q: '   ', statuses: [] });
    expect(r?.q).toBeUndefined();
    expect(r?.statuses).toBeUndefined();
  });

  it.each([
    ['missing page', { pageSize: 10 }],
    ['page 0', { page: 0, pageSize: 10 }],
    ['fractional page', { page: 1.5, pageSize: 10 }],
    ['pageSize not in 10/25/50', { page: 1, pageSize: 20 }],
    ['malformed date', { ...base, dateFrom: '2030-1-5' }],
    ['impossible date', { ...base, dateTo: '2030-02-30' }],
    ['dateFrom after dateTo', { ...base, dateFrom: '2030-02-01', dateTo: '2030-01-01' }],
    ['unknown status', { ...base, statuses: ['cancelled'] }],
    ['unknown guestType', { ...base, guestType: 'group' }],
    ['sort column outside whitelist', { ...base, sort: { by: 'email', dir: 'asc' } }],
    ['sort dir outside whitelist', { ...base, sort: { by: 'date', dir: 'up' } }],
    ['q longer than 100 chars', { ...base, q: 'a'.repeat(101) }],
    ['not an object', 'page=1'],
    ['null', null],
  ])('rejects %s', (_label, raw) => {
    expect(parseReservationQuery(raw)).toBeNull();
  });
});

describe('pageRange', () => {
  it('maps a 1-based page to an inclusive row range', () => {
    expect(pageRange(1, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(3, 25)).toEqual({ from: 50, to: 74 });
  });
});

describe('sort whitelist', () => {
  it('maps every sort key to real columns', () => {
    expect(SORT_COLUMNS).toEqual({
      date: ['date', 'created_at'],
      code: ['code'],
      name: ['last_name', 'first_name'],
      guests: ['party_size'],
      total_usd: ['total_usd'],
      status: ['status'],
    });
  });

  it('defaults to newest visit date first', () => {
    expect(DEFAULT_SORT).toEqual({ by: 'date', dir: 'desc' });
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/reservation-search.test.ts`
Expected: FAIL — `parseReservationQuery is not a function` (y equivalentes para `pageRange`, `SORT_COLUMNS`, `DEFAULT_SORT`).

- [ ] **Step 4: Implementación**

En `src/lib/reservation-search.ts`, añadir arriba del todo (antes del comentario de `SEARCH_COLUMNS`):

```ts
import { z } from 'zod';
import type { ReservationQuery, ReservationRow } from '@/lib/db/reservations';
```

y al final del archivo:

```ts
type Sort = NonNullable<ReservationQuery['sort']>;

/** Whitelisted ORDER BY columns per sort key; `dir` applies to each of them. */
export const SORT_COLUMNS: Record<Sort['by'], readonly string[]> = {
  date: ['date', 'created_at'],
  code: ['code'],
  name: ['last_name', 'first_name'],
  guests: ['party_size'],
  total_usd: ['total_usd'],
  status: ['status'],
};

export const DEFAULT_SORT: Sort = { by: 'date', dir: 'desc' };

/** Inclusive row range for a 1-based page (PostgREST `.range(from, to)`). */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

const STATUSES = [
  'pending_payment', 'confirmed', 'failed', 'expired', 'checked_in',
] as const satisfies readonly ReservationRow['status'][];

function isRealDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate);

const reservationQuerySchema = z
  .object({
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    statuses: z
      .array(z.enum(STATUSES))
      .max(STATUSES.length)
      .optional()
      .transform((s) => (s && s.length > 0 ? [...new Set(s)] : undefined)),
    q: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((s) => (s ? s : undefined)),
    guestType: z.enum(['individual', 'family']).optional(),
    sort: z
      .object({
        by: z.enum(['date', 'code', 'name', 'guests', 'total_usd', 'status']),
        dir: z.enum(['asc', 'desc']),
      })
      .optional(),
    page: z.coerce.number().int().min(1).max(10000),
    pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])),
  })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
    message: 'dateFrom must be on or before dateTo',
    path: ['dateTo'],
  });

/** Validates untrusted input (server action args / URL params). null = invalid. */
export function parseReservationQuery(raw: unknown): ReservationQuery | null {
  const parsed = reservationQuerySchema.safeParse(raw);
  if (!parsed.success) return null;
  const { statuses, q, ...rest } = parsed.data;
  // Drop keys that normalized to undefined so callers (and toEqual) see a clean object.
  return {
    ...rest,
    ...(statuses ? { statuses } : {}),
    ...(q ? { q } : {}),
  };
}
```

Nota: `rest` puede traer `dateFrom`/`dateTo`/`guestType`/`sort` como claves ausentes (zod no añade claves opcionales que no venían), por eso solo `statuses` y `q` —que pasan por `transform`— necesitan limpieza explícita.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/reservation-search.test.ts`
Expected: PASS (todos los tests del archivo: 9 de Task 3 + 4 + 14 casos `rejects` + 1 + 2).

Si `accepts the minimal query` falla porque el resultado incluye `dateFrom: undefined` (o similar), cambiar el `return` por un filtrado explícito:

```ts
  return Object.fromEntries(
    Object.entries({ ...rest, statuses, q }).filter(([, v]) => v !== undefined)
  ) as unknown as ReservationQuery;
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/reservations.ts src/lib/reservation-search.ts src/lib/reservation-search.test.ts
git commit -m "$(cat <<'EOF'
feat(search): validate reservation queries with zod

Adds the ReservationQuery contract, a sort whitelist and 1-based
page ranges.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `searchReservations` en la capa de datos

**Files:**
- Modify: `src/lib/db/reservations.ts`
- Modify: `src/lib/db/reservation-search.integration.test.ts`

- [ ] **Step 1: Escribir los tests de integración que fallan**

En `src/lib/db/reservation-search.integration.test.ts`, cambiar la línea `import type { ReservationRow } from './reservations';` por:

```ts
import { searchReservations, type ReservationRow, type ReservationQuery } from './reservations';
```

y añadir al final del archivo:

```ts
const codes = (rows: ReservationRow[]) => rows.map((r) => r.code);
const inMain = (q: Partial<ReservationQuery> = {}): ReservationQuery => ({
  dateFrom: MAIN_FROM, dateTo: MAIN_TO, page: 1, pageSize: 10, ...q,
});

describe('searchReservations', () => {
  it('returns every row in range, newest visit date first, with an exact total', async () => {
    const res = await searchReservations(inMain());
    expect(res.total).toBe(5);
    expect(res.rows.map((r) => r.date)).toEqual([
      '2031-04-20', '2031-04-20', '2031-04-12', '2031-04-05', '2031-04-05',
    ]);
  });

  it('returns rows shaped like ReservationRow (no party_size leak)', async () => {
    const { rows } = await searchReservations(inMain({ q: 'ZQ002' }));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'adults', 'bcv_rate', 'checked_in_at', 'children', 'code', 'created_at', 'date',
      'email', 'expires_at', 'first_name', 'id', 'id_number', 'id_type', 'last_name',
      'payment_ref', 'status', 'total_usd', 'total_ves',
    ]);
  });

  it('filters by inclusive date range', async () => {
    const res = await searchReservations(inMain({
      dateFrom: '2031-04-05', dateTo: '2031-04-12', sort: { by: 'code', dir: 'asc' },
    }));
    expect(codes(res.rows)).toEqual(['PP-ZQ001', 'PP-ZQ002', 'PP-ZQ003']);
    expect(res.total).toBe(3);
  });

  it('filters by statuses', async () => {
    const res = await searchReservations(inMain({
      statuses: ['failed', 'expired'], sort: { by: 'code', dir: 'asc' },
    }));
    expect(codes(res.rows)).toEqual(['PP-ZQ004', 'PP-ZQ005']);
  });

  it('filters by guest type derived from adults + children', async () => {
    const solo = await searchReservations(inMain({ guestType: 'individual', sort: { by: 'code', dir: 'asc' } }));
    expect(codes(solo.rows)).toEqual(['PP-ZQ001', 'PP-ZQ003']);
    const family = await searchReservations(inMain({ guestType: 'family', sort: { by: 'code', dir: 'asc' } }));
    expect(codes(family.rows)).toEqual(['PP-ZQ002', 'PP-ZQ004', 'PP-ZQ005']);
  });

  it.each([
    ['first name, case-insensitive', 'ana', ['PP-ZQ001', 'PP-ZQ005']],
    ['last name with accent', 'PÉREZ', ['PP-ZQ001']],
    ['every term must match (AND across terms)', 'ana pérez', ['PP-ZQ001']],
    ['reservation code fragment', 'zq003', ['PP-ZQ003']],
    ['id number fragment', '3333', ['PP-ZQ003']],
    ['dotted id number', '33.333.333', ['PP-ZQ003']],
    ['id number with type prefix', 'V-33333333', ['PP-ZQ003']],
  ])('q matches %s', async (_label, q, expected) => {
    const res = await searchReservations(inMain({ q, sort: { by: 'code', dir: 'asc' } }));
    expect(codes(res.rows)).toEqual(expected);
  });

  it('treats PostgREST syntax in q as plain text (no injection, no error)', async () => {
    const res = await searchReservations(inMain({ q: 'x,status.eq.failed)' }));
    expect(res).toEqual({ rows: [], total: 0 });
  });

  it('sorts by name as last_name, first_name', async () => {
    const res = await searchReservations(inMain({ sort: { by: 'name', dir: 'asc' } }));
    expect(res.rows.map((r) => r.last_name)).toEqual(['Alvarez', 'Garcia', 'Gómez', 'Pérez', 'Zamora']);
  });

  it('sorts by guests as adults + children', async () => {
    const res = await searchReservations(inMain({ sort: { by: 'guests', dir: 'desc' } }));
    expect(codes(res.rows).slice(0, 3)).toEqual(['PP-ZQ004', 'PP-ZQ002', 'PP-ZQ005']);
  });

  it('sorts by total_usd', async () => {
    const res = await searchReservations(inMain({ sort: { by: 'total_usd', dir: 'asc' } }));
    expect(codes(res.rows)).toEqual(['PP-ZQ003', 'PP-ZQ001', 'PP-ZQ005', 'PP-ZQ002', 'PP-ZQ004']);
  });

  it('paginates with an exact total', async () => {
    const q = (page: number): ReservationQuery => ({
      dateFrom: PAGE_DATE, dateTo: PAGE_DATE, sort: { by: 'total_usd', dir: 'asc' }, page, pageSize: 10,
    });
    const p1 = await searchReservations(q(1));
    expect(p1.total).toBe(12);
    expect(p1.rows).toHaveLength(10);
    expect(p1.rows[0].code).toBe('PP-ZP001');
    const p2 = await searchReservations(q(2));
    expect(codes(p2.rows)).toEqual(['PP-ZP011', 'PP-ZP012']);
    expect(p2.total).toBe(12);
  });

  it('returns no rows but the real total for a page past the end', async () => {
    const res = await searchReservations({
      dateFrom: PAGE_DATE, dateTo: PAGE_DATE, page: 3, pageSize: 10,
    });
    expect(res).toEqual({ rows: [], total: 12 });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservation-search.integration.test.ts`
Expected: FAIL — `searchReservations is not a function` (el test de `party_size` sigue en PASS).

- [ ] **Step 3: Implementación**

En `src/lib/db/reservations.ts`, cambiar la primera línea por:

```ts
import { serviceClient } from './service-client';
import {
  DEFAULT_SORT, SORT_COLUMNS, pageRange, searchTerms, termOrFilter,
} from '@/lib/reservation-search';
```

y añadir después de `listReservationsByDate`:

```ts
/** Explicit list (not '*') so rows match ReservationRow exactly — party_size stays server-side. */
const RESERVATION_COLUMNS =
  'id, code, date, first_name, last_name, email, id_type, id_number, adults, children, ' +
  'total_usd, bcv_rate, total_ves, status, payment_ref, expires_at, checked_in_at, created_at';

function filteredReservations(q: ReservationQuery, head: boolean) {
  let query = serviceClient()
    .from('reservations')
    .select(RESERVATION_COLUMNS, { count: 'exact', head });
  if (q.dateFrom) query = query.gte('date', q.dateFrom);
  if (q.dateTo) query = query.lte('date', q.dateTo);
  if (q.statuses && q.statuses.length > 0) query = query.in('status', q.statuses);
  if (q.guestType === 'individual') query = query.eq('party_size', 1);
  if (q.guestType === 'family') query = query.gte('party_size', 2);
  // One or() per term; PostgREST ANDs repeated logic params, so every term must match.
  for (const term of searchTerms(q.q)) query = query.or(termOrFilter(term));
  return query;
}

/**
 * Server-side filtered, sorted, paginated reservation search for the admin.
 * Caller must validate `q` (see parseReservationQuery) and gate on requireAdmin().
 */
export async function searchReservations(
  q: ReservationQuery,
): Promise<{ rows: ReservationRow[]; total: number }> {
  const sort = q.sort ?? DEFAULT_SORT;
  const { from, to } = pageRange(q.page, q.pageSize);

  let query = filteredReservations(q, false);
  for (const col of SORT_COLUMNS[sort.by]) {
    query = query.order(col, { ascending: sort.dir === 'asc' });
  }
  // Unique tiebreaker keeps pagination stable when the sort keys tie.
  const { data, count, error } = await query.order('id', { ascending: true }).range(from, to);

  // PostgREST answers 416 / PGRST103 when the offset is past the last row.
  if (error?.code === 'PGRST103') {
    const { count: total, error: countError } = await filteredReservations(q, true);
    if (countError) throw new Error(countError.message);
    return { rows: [], total: total ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ReservationRow[], total: count ?? 0 };
}
```

Si `tsc` se queja de la conversión en `(data ?? []) as ReservationRow[]` ("neither type sufficiently overlaps"), usar `as unknown as ReservationRow[]`.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservation-search.integration.test.ts`
Expected: PASS (todos).

Diagnóstico si falla `every term must match (AND across terms)` devolviendo también `PP-ZQ005`: la versión de PostgREST no está aplicando los `or` repetidos. Sustituir el bucle `for (const term ...)` de `filteredReservations` por un único `and(...)` anidado:

```ts
  const terms = searchTerms(q.q);
  if (terms.length > 0) {
    query = query.or(`and(${terms.map((t) => `or(${termOrFilter(t)})`).join(',')})`);
  }
```

y volver a ejecutar.

- [ ] **Step 5: Unit tests y typecheck siguen verdes**

Run: `npm test && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/reservations.ts src/lib/db/reservation-search.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(db): add paginated server-side reservation search

Filters by date range, statuses, guest type and free text;
whitelisted sort with stable tiebreaker and exact count.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Acción `adminSearchReservations`

**Files:**
- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/app/admin/actions.test.ts`:

1. En la factory de `vi.mock('@/lib/db/reservations', () => ({ ... }))`, añadir una entrada después de `deleteOverride: vi.fn(),`:

```ts
  searchReservations: vi.fn(),
```

2. Cambiar el import de `./actions` por:

```ts
import {
  adminListReservations, adminGetDaySummary, adminCheckIn, adminResendVoucher,
  adminGetSettings, adminUpdateSettings, adminUpsertOverride, adminDeleteOverride,
  adminSearchReservations,
} from './actions';
```

3. Cambiar el import de `@/lib/db/reservations` por:

```ts
import {
  listReservationsByDate, getReservation, checkInReservation, getSettings,
  updateSettings, listOverrides, upsertOverride, deleteOverride, searchReservations,
} from '@/lib/db/reservations';
```

4. Añadir al final del archivo:

```ts
describe('adminSearchReservations', () => {
  const valid = { q: '  Ana ', statuses: ['confirmed'], page: '2', pageSize: 25 };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchReservations).mockResolvedValue({ rows: [], total: 0 });
  });

  it('rejects with Unauthorized when there is no session and never queries', async () => {
    mockUser = null;
    await expect(adminSearchReservations(valid)).rejects.toThrow('Unauthorized');
    expect(searchReservations).not.toHaveBeenCalled();
  });

  it('rejects a logged-in non-admin and never queries', async () => {
    mockUser = { id: 'user-9', email: 'intruder@evil.com' };
    await expect(adminSearchReservations(valid)).rejects.toThrow('Unauthorized');
    expect(searchReservations).not.toHaveBeenCalled();
  });

  it('throws Invalid query on bad input without hitting the data layer', async () => {
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
    await expect(
      adminSearchReservations({ page: 1, pageSize: 10, sort: { by: 'email', dir: 'asc' } })
    ).rejects.toThrow('Invalid query');
    expect(searchReservations).not.toHaveBeenCalled();
  });

  it('forwards the normalized query and returns the data layer result', async () => {
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
    const result = { rows: [], total: 42 };
    vi.mocked(searchReservations).mockResolvedValue(result);
    await expect(adminSearchReservations(valid)).resolves.toBe(result);
    expect(searchReservations).toHaveBeenCalledWith({
      q: 'Ana', statuses: ['confirmed'], page: 2, pageSize: 25,
    });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — `adminSearchReservations is not a function`.

- [ ] **Step 3: Implementación**

En `src/app/admin/actions.ts`:

1. Cambiar el import de `@/lib/db/reservations` por:

```ts
import {
  listReservationsByDate, getReservation, checkInReservation,
  getSettings, updateSettings, listOverrides, upsertOverride, deleteOverride,
  searchReservations,
  type ReservationRow,
} from '@/lib/db/reservations';
import { parseReservationQuery } from '@/lib/reservation-search';
```

2. Añadir al final del archivo:

```ts
export async function adminSearchReservations(
  raw: unknown,
): Promise<{ rows: ReservationRow[]; total: number }> {
  await requireAdmin();
  const query = parseReservationQuery(raw);
  if (!query) throw new Error('Invalid query');
  return searchReservations(query);
}
```

(Solo `await requireAdmin()`, sin usar su retorno: PR 01 cambia ese tipo de `void` a `{ email, role }` y así ambos PRs mergean sin tocarse.)

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: PASS (todos, incluidos los 4 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add adminSearchReservations action

Admin-gated and zod-validated entry point for the paginated
reservation search.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `caracasHour` y `upcomingWeekend` en `dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/dates.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/lib/dates.test.ts`, cambiar el import por:

```ts
import { shortDateEs, longDateEs, visitLabelEs, caracasHour, upcomingWeekend } from './dates';
```

y añadir al final:

```ts
describe('caracasHour (UTC-4, no DST)', () => {
  it.each([
    ['2030-01-15T13:05:00Z', 9],
    ['2030-01-15T03:59:00Z', 23], // previous Caracas day, still late evening
    ['2030-01-15T04:30:00Z', 0],  // just after Caracas midnight
    ['2030-01-15T16:00:00-04:00', 16],
  ])('%s -> %i', (iso, hour) => {
    expect(caracasHour(iso)).toBe(hour);
  });
});

describe('upcomingWeekend', () => {
  it.each([
    ['2026-10-07', '2026-10-10', '2026-10-11'], // Wednesday -> next weekend
    ['2026-10-09', '2026-10-10', '2026-10-11'], // Friday
    ['2026-10-10', '2026-10-10', '2026-10-11'], // Saturday -> current weekend
    ['2026-10-11', '2026-10-10', '2026-10-11'], // Sunday -> current weekend
    ['2026-10-12', '2026-10-17', '2026-10-18'], // Monday -> following weekend
    ['2026-12-31', '2027-01-02', '2027-01-03'], // year rollover
  ])('%s -> %s / %s', (today, saturday, sunday) => {
    expect(upcomingWeekend(today)).toEqual({ saturday, sunday });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `caracasHour is not a function`.

- [ ] **Step 3: Implementación**

En `src/lib/dates.ts`, añadir después de `caracasTime`:

```ts
/** Hour of day (0–23) in Venezuela time for an ISO timestamp. */
export function caracasHour(iso: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'hour');
  return Number(hour?.value ?? 0) % 24;
}

/**
 * Saturday + Sunday (YYYY-MM-DD) of the weekend to advertise, given today's
 * Caracas date. On a Saturday or Sunday it is the current weekend.
 */
export function upcomingWeekend(today: string): { saturday: string; sunday: string } {
  const base = new Date(`${today}T12:00:00Z`);
  const dow = base.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const toSaturday = dow === 0 ? -1 : 6 - dow;
  const shift = (days: number) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return { saturday: shift(toSaturday), sunday: shift(toSaturday + 1) };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS (3 existentes + 4 + 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "$(cat <<'EOF'
feat(dates): add caracasHour and upcomingWeekend helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `checkinsByHour` en `DaySummary`

**Files:**
- Create: `src/lib/day-stats.ts`
- Create: `src/lib/day-stats.test.ts`
- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/actions.test.ts`
- Modify: `src/components/admin/metric-cards.test.tsx:7-10`

- [ ] **Step 1: Escribir el test unitario que falla**

Crear `src/lib/day-stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bucketCheckinsByHour } from './day-stats';

type Row = Parameters<typeof bucketCheckinsByHour>[0][number];
const r = (over: Partial<Row>): Row => ({
  status: 'checked_in', checked_in_at: '2030-01-15T13:05:00Z', adults: 1, children: 0, ...over,
});

describe('bucketCheckinsByHour', () => {
  it('returns an empty list when nobody checked in', () => {
    expect(bucketCheckinsByHour([])).toEqual([]);
    expect(bucketCheckinsByHour([r({ status: 'confirmed', checked_in_at: null })])).toEqual([]);
  });

  it('sums people (adults + children) per Caracas hour, ascending, skipping empty hours', () => {
    expect(bucketCheckinsByHour([
      r({ checked_in_at: '2030-01-15T15:40:00Z', adults: 2, children: 1 }), // 11:40 Caracas
      r({ checked_in_at: '2030-01-15T13:05:00Z', adults: 2, children: 0 }), // 09:05
      r({ checked_in_at: '2030-01-15T13:55:00Z', adults: 0, children: 1 }), // 09:55
    ])).toEqual([
      { hour: 9, people: 3 },
      { hour: 11, people: 3 },
    ]);
  });

  it('ignores rows that are not checked_in or lack a timestamp', () => {
    expect(bucketCheckinsByHour([
      r({ status: 'confirmed' }),
      r({ checked_in_at: null }),
      r({ adults: 4 }),
    ])).toEqual([{ hour: 9, people: 4 }]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/day-stats.test.ts`
Expected: FAIL — `Failed to resolve import "./day-stats"`.

- [ ] **Step 3: Implementación**

Crear `src/lib/day-stats.ts`:

```ts
import { caracasHour } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

type CheckinRow = Pick<ReservationRow, 'status' | 'checked_in_at' | 'adults' | 'children'>;

/**
 * People checked in per hour of the day (Caracas, 0–23), ascending.
 * Sparse: hours with no check-ins are omitted.
 */
export function bucketCheckinsByHour(rows: CheckinRow[]): { hour: number; people: number }[] {
  const buckets = new Map<number, number>();
  for (const r of rows) {
    if (r.status !== 'checked_in' || !r.checked_in_at) continue;
    const hour = caracasHour(r.checked_in_at);
    buckets.set(hour, (buckets.get(hour) ?? 0) + r.adults + r.children);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, people]) => ({ hour, people }));
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/day-stats.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Actualizar el test de `adminGetDaySummary` (falla)**

En `src/app/admin/actions.test.ts`, dentro de `describe('adminGetDaySummary aggregates (authorized user)', ...)`:

1. En el test existente `computes occupancy, revenue and pending counts from the day rows`, añadir `checkinsByHour: [],` al objeto esperado, después de `pendingCount: 1,` (la fila `checked_in` de ese test tiene `checked_in_at: null`, así que no cuenta).

2. Añadir este test dentro del mismo `describe`, después del existente:

```ts
  it('buckets checked-in people by Caracas hour', async () => {
    const row = (over: Record<string, unknown>) => ({
      id: 'x', code: 'PP-00000', date: '2030-01-15', first_name: 'A', last_name: 'B',
      email: 'a@b.c', id_type: 'V', id_number: '1', adults: 1, children: 0,
      total_usd: 15, bcv_rate: 36.5, total_ves: 547.5, status: 'checked_in',
      payment_ref: null, expires_at: null, checked_in_at: null, created_at: '', ...over,
    });
    vi.mocked(listReservationsByDate).mockResolvedValue([
      row({ checked_in_at: '2030-01-15T13:10:00Z', adults: 2, children: 1 }), // 09:10 Caracas
      row({ checked_in_at: '2030-01-15T13:50:00Z' }),                          // 09:50
      row({ checked_in_at: '2030-01-15T18:00:00Z' }),                          // 14:00
      row({ status: 'confirmed' }),
    ] as never);
    vi.mocked(getSettings).mockResolvedValue({
      daily_capacity: 100, adult_price_usd: 15, child_price_usd: 5,
      last_bcv_rate: null, last_bcv_rate_at: null,
    } as never);

    const s = await adminGetDaySummary('2030-01-15');
    expect(s.checkinsByHour).toEqual([
      { hour: 9, people: 4 },
      { hour: 14, people: 1 },
    ]);
  });
```

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — el objeto devuelto no tiene `checkinsByHour`.

- [ ] **Step 6: Extender `DaySummary` y `adminGetDaySummary`**

En `src/app/admin/actions.ts`:

1. Añadir el import (debajo del de `@/lib/reservation-search`):

```ts
import { bucketCheckinsByHour } from '@/lib/day-stats';
```

2. En `export interface DaySummary`, añadir como último campo:

```ts
  /** People checked in per Caracas hour (0–23), ascending; empty hours omitted. */
  checkinsByHour: { hour: number; people: number }[];
```

3. En el objeto que devuelve `adminGetDaySummary`, añadir como última propiedad (después de `pendingCount: ...,`):

```ts
    checkinsByHour: bucketCheckinsByHour(rows),
```

- [ ] **Step 7: Actualizar la fixture de `metric-cards.test.tsx`**

En `src/components/admin/metric-cards.test.tsx`, reemplazar:

```ts
const summary: DaySummary = {
  capacity: 100, confirmedPeople: 5, checkedInParties: 1, checkedInPeople: 1,
  revenueUsd: 65, revenueVes: 2390.05, paidCount: 2, pendingCount: 0,
};
```

por:

```ts
const summary: DaySummary = {
  capacity: 100, confirmedPeople: 5, checkedInParties: 1, checkedInPeople: 1,
  revenueUsd: 65, revenueVes: 2390.05, paidCount: 2, pendingCount: 0,
  checkinsByHour: [],
};
```

- [ ] **Step 8: Ejecutar y verificar que pasa**

Run: `npm test && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 9: Commit**

```bash
git add src/lib/day-stats.ts src/lib/day-stats.test.ts src/app/admin/actions.ts src/app/admin/actions.test.ts src/components/admin/metric-cards.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add check-ins per Caracas hour to DaySummary

Feeds the check-in velocity chart planned for the metrics PR.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `sumPartySize` en la capa de datos

**Files:**
- Modify: `src/lib/db/reservations.ts`
- Modify: `src/lib/db/reservation-search.integration.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

En `src/lib/db/reservation-search.integration.test.ts`, cambiar el import de `./reservations` por:

```ts
import {
  searchReservations, sumPartySize, type ReservationRow, type ReservationQuery,
} from './reservations';
```

y añadir al final:

```ts
describe('sumPartySize', () => {
  it('sums adults + children for the given statuses in an inclusive date range', async () => {
    // ZQ001 (1, confirmed) + ZQ002 (3, checked_in); ZQ003 is pending -> excluded
    await expect(sumPartySize({
      dateFrom: '2031-04-05', dateTo: '2031-04-12', statuses: ['confirmed', 'checked_in'],
    })).resolves.toBe(4);
  });

  it('returns 0 when nothing matches', async () => {
    await expect(sumPartySize({
      dateFrom: '2031-04-21', dateTo: '2031-04-22', statuses: ['confirmed', 'checked_in'],
    })).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservation-search.integration.test.ts`
Expected: FAIL — `sumPartySize is not a function`.

- [ ] **Step 3: Implementación**

En `src/lib/db/reservations.ts`, añadir después de `searchReservations`:

```ts
/** Total people (adults + children) across reservations in [dateFrom, dateTo] with the given statuses. */
export async function sumPartySize(p: {
  dateFrom: string; dateTo: string; statuses: ReservationRow['status'][];
}): Promise<number> {
  const { data, error } = await serviceClient()
    .from('reservations')
    .select('adults, children')
    .gte('date', p.dateFrom)
    .lte('date', p.dateTo)
    .in('status', p.statuses);
  if (error) throw new Error(error.message);
  return data.reduce((sum, r) => sum + r.adults + r.children, 0);
}
```

(Se suma en JS porque los agregados de PostgREST — `.select('party_size.sum()')` — están desactivados por defecto en Supabase. Dos días a capacidad ~100 son a lo sumo unos cientos de filas, lejos de `max_rows = 1000`.)

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservation-search.integration.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/reservations.ts src/lib/db/reservation-search.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(db): add sumPartySize helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Acción pública `getWeekendBookedPeople`

**Files:**
- Modify: `src/app/actions/booking.ts`
- Modify: `src/app/actions/booking.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/app/actions/booking.test.ts`:

1. Cambiar la primera línea por:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

2. Añadir, después del `vi.mock('@/lib/booking/process', ...)` existente:

```ts
vi.mock('@/lib/db/reservations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/reservations')>()),
  sumPartySize: vi.fn(),
}));
```

(Se conserva el resto del módulo real porque `submitBookingAndPay` lee `reserveSlots`, `confirmReservation`, etc. al construir sus dependencias.)

3. Cambiar `import { submitBookingAndPay } from './booking';` por:

```ts
import { submitBookingAndPay, getWeekendBookedPeople } from './booking';
import { sumPartySize } from '@/lib/db/reservations';
```

4. Añadir al final del archivo:

```ts
describe('getWeekendBookedPeople', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00Z')); // Wednesday 11:00 Caracas
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sums confirmed + checked_in people for the upcoming Saturday and Sunday', async () => {
    vi.mocked(sumPartySize).mockResolvedValue(24);
    await expect(getWeekendBookedPeople()).resolves.toBe(24);
    expect(sumPartySize).toHaveBeenCalledWith({
      dateFrom: '2026-10-10', dateTo: '2026-10-11', statuses: ['confirmed', 'checked_in'],
    });
  });

  it('returns exactly 10 (threshold is inclusive)', async () => {
    vi.mocked(sumPartySize).mockResolvedValue(10);
    await expect(getWeekendBookedPeople()).resolves.toBe(10);
  });

  it('returns null below 10 people', async () => {
    vi.mocked(sumPartySize).mockResolvedValue(9);
    await expect(getWeekendBookedPeople()).resolves.toBeNull();
  });

  it('anchors "today" to Caracas: Sunday 22:00 Caracas is still the current weekend', async () => {
    vi.setSystemTime(new Date('2026-10-12T02:00:00Z')); // Monday in UTC, Sunday in Caracas
    vi.mocked(sumPartySize).mockResolvedValue(30);
    await getWeekendBookedPeople();
    expect(sumPartySize).toHaveBeenCalledWith({
      dateFrom: '2026-10-10', dateTo: '2026-10-11', statuses: ['confirmed', 'checked_in'],
    });
  });

  it('returns null (and logs) when the database fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(sumPartySize).mockRejectedValue(new Error('db down'));
    await expect(getWeekendBookedPeople()).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/app/actions/booking.test.ts`
Expected: FAIL — `getWeekendBookedPeople is not a function` (los 2 tests de rate limiting siguen en PASS).

- [ ] **Step 3: Implementación**

En `src/app/actions/booking.ts`:

1. Cambiar los imports de `@/lib/db/reservations` y `@/lib/dates` por:

```ts
import {
  reserveSlots, confirmReservation, failReservation,
  getSettings, readRateCache, writeRateCache, monthAvailability, sumPartySize,
} from '@/lib/db/reservations';
```

```ts
import { todayCaracas, upcomingWeekend } from '@/lib/dates';
```

2. Añadir debajo de `const BOOKING_MAX_PER_MINUTE = 8;`:

```ts

// Social proof on the landing ("🔥 N personas reservadas este fin de semana")
// is shown only with real numbers, and hidden below this many people.
const WEEKEND_SOCIAL_PROOF_MIN = 10;
```

3. Añadir al final del archivo:

```ts
/**
 * People (adults + children) with a confirmed or checked-in booking for the
 * upcoming Saturday + Sunday in Caracas time (the current weekend on Sat/Sun).
 * null when below WEEKEND_SOCIAL_PROOF_MIN or on any error — the landing must
 * never break or show a made-up number because of this.
 */
export async function getWeekendBookedPeople(): Promise<number | null> {
  try {
    const { saturday, sunday } = upcomingWeekend(todayCaracas());
    const people = await sumPartySize({
      dateFrom: saturday, dateTo: sunday, statuses: ['confirmed', 'checked_in'],
    });
    return people >= WEEKEND_SOCIAL_PROOF_MIN ? people : null;
  } catch (e) {
    console.error('getWeekendBookedPeople failed', e);
    return null;
  }
}
```

(`'use server'` solo permite exportar funciones async; la constante queda sin exportar.)

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/app/actions/booking.test.ts`
Expected: PASS (2 + 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/booking.ts src/app/actions/booking.test.ts
git commit -m "$(cat <<'EOF'
feat(booking): add getWeekendBookedPeople for landing social proof

Real confirmed + checked-in headcount for the upcoming weekend in
Caracas time; null below 10 people or on failure.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Verificación final y PR

**Files:** ninguno.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: sin errores (exit 0).

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: PASS, 0 fallos.

- [ ] **Step 3: Integration tests (requiere `npx supabase start` y la migración 0008 aplicada)**

Run: `npm run test:integration`
Expected: PASS, 0 fallos (incluye `reservation-search.integration.test.ts` y los suites existentes).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully` y typecheck sin errores.

- [ ] **Step 5: Revisar el diff completo**

Run: `git diff origin/develop --stat && git log --oneline origin/develop..HEAD`
Expected: solo los archivos del mapa de archivos; 9 commits (Tasks 2–10).

- [ ] **Step 6: Push**

```bash
git push -u origin feat/backend-reservation-search
```

(Si falla por SSH: `gh auth setup-git && git remote set-url origin https://github.com/JoseSleiter/pool-pass.git` y repetir.)

- [ ] **Step 7: Crear el PR**

```bash
gh pr create --base develop --assignee JoseSleiter --label "area:backend,enhancement" \
  --title "feat(backend): búsqueda paginada de reservas, check-ins por hora y prueba social del fin de semana" \
  --body "$(cat <<'EOF'
## Resumen

Backend del PR 02 del roadmap UX (`docs/superpowers/plans/2026-10-04-ux-overhaul-roadmap.md`, §3.2).

- **Migración `0008_party_size.sql`**: columna generada `party_size = adults + children` (nadie la escribe). Permite filtrar por tipo de grupo (individual = 1, familia ≥ 2) y ordenar por número de personas desde PostgREST, sin RPC ni vista.
- **`searchReservations(ReservationQuery)`** (`src/lib/db/reservations.ts`): filtros por rango de fechas, estados, tipo de grupo y texto libre (nombre, apellido, código `PP-…`, número de documento; varias palabras = todas deben coincidir). Orden con lista blanca (`name` = apellido, nombre; `guests` = adultos + niños), desempate estable por `id`, paginación 10/25/50 con conteo exacto. Una página más allá del final devuelve `rows: []` con el total real.
- **Seguridad de la búsqueda**: el texto pasa por una lista blanca de caracteres y va entre comillas en el filtro `.or()`, así no puede alterar el árbol de filtros de PostgREST ni meter comodines de `ilike`.
- **`adminSearchReservations(raw)`** (`src/app/admin/actions.ts`): `requireAdmin()` + validación zod (`parseReservationQuery`); lanza `Invalid query` si la entrada no es válida.
- **`DaySummary.checkinsByHour`**: personas con check-in por hora de Caracas (0–23), en orden ascendente; las horas vacías se omiten.
- **`getWeekendBookedPeople()`** (`src/app/actions/booking.ts`): personas `confirmed` + `checked_in` del próximo sábado y domingo en hora Caracas (el fin de semana en curso si hoy es sábado o domingo). Devuelve `null` si son menos de 10 o si la BD falla.

## Notas para el merge

- Solo hace `await requireAdmin()` sin usar el valor de retorno: es compatible con el cambio de firma de PR 01.
- **Orden de migraciones:** si este PR entra antes que PR 01 (0005–0007), `supabase db push` en producción va a pedir `--include-all`. Lo recomendado es mergear PR 01 primero.
- `ReservationRow` no cambia: la búsqueda pide columnas explícitas.

## Pruebas

- Unit: `src/lib/reservation-search.test.ts`, `src/lib/day-stats.test.ts`, `src/lib/dates.test.ts`, `src/app/admin/actions.test.ts`, `src/app/actions/booking.test.ts`.
- Integración (Supabase local): `src/lib/db/reservation-search.integration.test.ts`.
- `npm run lint`, `npm test`, `npm run test:integration` y `npm run build` en verde.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: imprime la URL del PR.

---

## Self-review

**Cobertura del spec:**
- `searchReservations` con rango de fechas, estados, `q` sobre first_name/last_name/code/id_number escapado de forma segura, `guestType` derivado, orden con lista blanca (incl. `name` y `guests`) y paginación con conteo exacto → Tasks 2, 3, 4, 5.
- `adminSearchReservations(raw: unknown)` con zod + `await requireAdmin()` sin usar el retorno → Task 6.
- `DaySummary.checkinsByHour` en hora Caracas desde `checked_in_at` → Tasks 7, 8.
- `getWeekendBookedPeople()` (confirmed + checked_in, sáb + dom Caracas, fin de semana en curso si es sáb/dom, null si < 10) → Tasks 7, 9, 10.
- Unit tests de la lógica pura (cálculo del fin de semana, agrupación por hora, validación de la consulta, saneado) + integración de la BD → Tasks 3, 4, 7, 8 (unit) y 2, 5, 9 (integración).
- Verificación final + PR con labels/assignee/base indicados → Task 11.

**Placeholders:** ninguno; cada paso de código trae el código completo. Los dos bloques "si falla…" (Task 4 Step 5, Task 5 Step 4) son alternativas concretas con código, no TODOs.

**Consistencia de tipos/nombres:** `ReservationQuery` (Task 4) se usa igual en Tasks 5, 6; `parseReservationQuery`, `searchTerms`, `termOrFilter`, `pageRange`, `SORT_COLUMNS`, `DEFAULT_SORT` (Tasks 3–4) coinciden con sus imports en Tasks 5–6; `caracasHour`/`upcomingWeekend` (Task 7) con Tasks 8 y 10; `bucketCheckinsByHour` (Task 8) con `actions.ts`; `sumPartySize({ dateFrom, dateTo, statuses })` (Task 9) con Task 10.
