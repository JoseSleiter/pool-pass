# PR 04 · Landing hero (navy + glass, badge vivo, prueba social, wizard de 3 pasos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el hero de la landing (fondo navy con patrón acuático en SVG, tarjetas de vidrio esmerilado), con un badge de disponibilidad de HOY en vivo (abierta / últimos cupos / agotado), un chip de prueba social con datos reales y una `HeroBookingCard` en 3 pasos (fecha → personas → total USD + Bs.) con "Quedan N" bajo cada día del calendario y CTA coral "Reservar mi pase ahora".

**Architecture:** La página (`src/app/page.tsx`, Server Component) pide en paralelo precios, la nueva acción `getTodayCapacity()` (restantes + capacidad de hoy + capacidad por defecto), la disponibilidad del mes y `getWeekendBookedPeople()`. `Hero` (server) pinta el fondo, el badge (`TodayBadge`) y el chip (`WeekendChip`) a partir de funciones puras (`src/lib/availability.ts`). `HeroBookingCard` (client island) es una máquina de estados de 3 pasos que reutiliza `DatePickerPanel` (ahora con etiqueta "Quedan N" por día vía contexto) y `CountRow` (ahora con icono y límites configurables, para validar 1–20 personas en total), y pide la tasa BCV con `getCurrentRate()` al montar.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript, Tailwind v4 (tokens en `src/app/globals.css`), react-day-picker 10 vía `components/ui/calendar.tsx`, lucide-react, Vitest + Testing Library + user-event (jsdom), Playwright (proyecto `mobile-chrome`, Pixel 7).

---

## Entorno de ejecución (obligatorio, del brief de la ola 2)

- Directorio de trabajo: `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-hero` (rama `feat/landing-hero`, ya existe, ya tiene `.env.local`). **No** crear worktree, **no** hacer push, **no** abrir PR: eso lo hace el coordinador.
- Node por defecto es v16. **Todo** comando npm/npx va prefijado con:
  `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && `
  En este plan se abrevia como `$N20` — al ejecutar, escribe el prefijo completo.
- Supabase local ya corre y es compartido: **prohibido** `supabase start/stop/db reset/migration`. Este PR no necesita migraciones.
- Tests e2e serializados con lock:
  ```bash
  L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"
  ```
- Commits Conventional Commits, cuerpo terminando en línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Propiedad de archivos (ola 2): este PR posee `landing/hero.tsx`, `landing/hero-booking-card.tsx` (+test), `booking/date-picker-panel.tsx`, `booking/count-row.tsx`, `src/app/page.tsx`; en diccionarios los namespaces `hero`, nuevo `heroCard`, nuevo `datePicker`. Además puede editar `src/app/actions/booking.ts` (no es de nadie). Archivos nuevos que crea: `src/lib/availability.ts`, `src/lib/party-limits.ts`, `src/components/landing/hero-signals.tsx` y sus tests, `e2e/hero.spec.ts`. Ver "Desviaciones" para los 3 specs e2e existentes.
- `date-picker-panel.tsx` y `count-row.tsx` también los usa `/reservar` (`booking-card.tsx`, del PR 06). Sus props actuales **no cambian** (solo se añaden props opcionales), así que `/reservar` sigue compilando y funcionando sin tocar `booking-card.tsx`.

## Decisiones de diseño (frontend-design aplicado al brief)

- **Paleta:** solo tokens: `--navy-deep` (#081b33), `--navy` (#0b2a4a), `--chart-2` (#075e82, azul agua profundo), `--teal`/`--teal-soft` para el agua, `--primary` (= coral #ff7657) para el CTA, `--secondary` (mint) para el total. Estados del badge con la paleta de Tailwind (`emerald-400`, `amber-400`) y `--destructive` para rojo; no hay token verde/ámbar en `globals.css` y el brief prohíbe hex sueltos.
- **Fondo:** degradado navy-deep → navy → azul agua (por `var(--…)`), un brillo radial teal arriba a la derecha y un patrón SVG de ondas superpuestas al 12 % de opacidad. Estático: nada se mueve salvo el punto del badge (un único momento de movimiento, que comunica "en vivo").
- **Vidrio:** `border-white/20 bg-white/10 backdrop-blur-md` en el panel de la piscina, el badge, el chip y el marco de la tarjeta de reserva. El interior de la tarjeta queda blanco (`bg-card`) para que el calendario y los steppers tengan contraste AA.
- **Tipografía:** Fredoka (`font-heading`) en títulos y cifras (fecha, total); Rubik en el resto. Se quita el eyebrow en mayúsculas espaciadas del tagline (tic genérico); queda en `text-sm font-semibold text-teal-soft`.
- **Pasos numerados:** el contenido sí es una secuencia (fecha → personas → total), así que los números 1/2/3 están justificados.
- **Movimiento:** `motion-safe:animate-ping` en el punto verde; el CTA escala con `motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] motion-safe:transition-transform` (con `prefers-reduced-motion: reduce` no hay escala).
- **Touch targets:** steppers 44 px (`h-11 w-11`), botones de paso `min-h-11`, CTA `min-h-12`. Excepción documentada: celdas del calendario de 36 px por debajo de 640 px (7 columnas + chrome no caben a 44 px en 360 px); desde `sm` son 44 px.
- **Flecha del CTA:** el "→" del requisito se dibuja con el icono `ArrowRight`, no como carácter en el texto (accesible y sin depender de la fuente).

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/availability.ts` | Crear | `TodayCapacity` (tipo), `todayState()` (open/low/soldOut, umbral 20 %), `remainingOn()` |
| `src/lib/availability.test.ts` | Crear | Tests de umbrales y fallback |
| `src/lib/party-limits.ts` | Crear | `PARTY_MIN=1`, `PARTY_MAX=20`, `canAddGuest()`, `canRemoveGuest()` |
| `src/lib/party-limits.test.ts` | Crear | Tests de límites del grupo |
| `src/app/actions/booking.ts` | Modificar | Nueva acción pública `getTodayCapacity()` |
| `src/app/actions/booking.test.ts` | Modificar | Tests de `getTodayCapacity()` |
| `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts` | Modificar | Claves nuevas en `hero`; namespaces nuevos `heroCard` y `datePicker` al final |
| `src/components/booking/count-row.tsx` | Modificar | Icono opcional, `canDecrease`/`canIncrease` opcionales, botones 44 px |
| `src/components/booking/count-row.test.tsx` | Crear | Tests de límites por defecto y overrides |
| `src/components/booking/date-picker-panel.tsx` | Modificar | "Quedan N" bajo cada día disponible (y en el `aria-label`), prop opcional `defaultCapacity` |
| `src/components/booking/date-picker-panel.test.tsx` | Crear | Tests de la etiqueta por día |
| `src/components/landing/hero-signals.tsx` | Crear | `TodayBadge` y `WeekendChip` (server-safe, sin hooks) |
| `src/components/landing/hero-signals.test.tsx` | Crear | Tests de los 3 estados del badge y del chip |
| `src/components/landing/hero-booking-card.tsx` | Reescribir | Wizard de 3 pasos, total USD + Bs., CTA coral |
| `src/components/landing/hero-booking-card.test.tsx` | Reescribir | Tests del wizard, límites, tasa, CTA |
| `src/components/landing/hero.tsx` | Reescribir | Fondo navy + patrón, panel de vidrio con badge, chip, tarjeta |
| `src/components/landing/hero.test.tsx` | Crear | Cableado badge/chip en el hero |
| `src/app/page.tsx` | Modificar | Pide `getTodayCapacity()` y `getWeekendBookedPeople()` |
| `e2e/hero.spec.ts` | Crear | "Quedan N" en el calendario, wizard → `/reservar`, badge agotado/abierto |
| `e2e/landing.spec.ts`, `e2e/i18n.spec.ts`, `e2e/booking.spec.ts` | Modificar (1 línea c/u) | El CTA ya no se llama "Continuar"/"Continue" |

---

### Task 0: Preparación del worktree

**Files:** ninguno.

- [ ] **Step 1: Instalar dependencias si faltan**

El worktree se creó sin `node_modules`.

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-hero
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && { [ -d node_modules ] || npm ci; }
```

Expected: `added N packages` (o nada si ya existía `node_modules`).

- [ ] **Step 2: Línea base verde**

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm test
```

Expected: todos los tests pasan (`Test Files  N passed`). Si algo falla aquí, es previo a este PR: anótalo y no lo arregles en este plan.

---

### Task 1: Funciones puras de disponibilidad (`src/lib/availability.ts`)

**Files:**
- Create: `src/lib/availability.ts`
- Test: `src/lib/availability.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/availability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { todayState, remainingOn } from './availability';

describe('todayState', () => {
  it.each([
    [80, 100, 'open'],
    [20, 100, 'open'], // exactly 20 % is not "below 20 %"
    [19, 100, 'low'],
    [1, 100, 'low'],
    [1, 6, 'low'], // 1 < 1.2
    [1, 5, 'open'], // 1 < 1 is false
    [0, 100, 'soldOut'],
    [0, 0, 'soldOut'], // closed day (override capacity 0)
  ] as const)('remaining %i of %i → %s', (remaining, capacity, expected) => {
    expect(todayState(remaining, capacity)).toBe(expected);
  });
});

describe('remainingOn', () => {
  const availability = { '2030-01-10': 7, '2030-01-11': 0 };

  it('returns the computed remaining slots when the day is listed', () => {
    expect(remainingOn('2030-01-10', availability, 100)).toBe(7);
    expect(remainingOn('2030-01-11', availability, 100)).toBe(0);
  });

  it('falls back to the default capacity for untouched days', () => {
    expect(remainingOn('2030-01-12', availability, 100)).toBe(100);
  });

  it('is undefined for untouched days when the default capacity is unknown', () => {
    expect(remainingOn('2030-01-12', availability)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/availability.test.ts`
Expected: FAIL — `Failed to resolve import "./availability"`.

- [ ] **Step 3: Implementación mínima**

`src/lib/availability.ts`:

```ts
/** Live numbers for today (Caracas) that the landing hero shows. */
export interface TodayCapacity {
  /** Slots still free today. */
  remaining: number;
  /** Today's total capacity: the day's override if any, else the default. */
  capacity: number;
  /** Default daily capacity (settings): what an untouched day has free. */
  dailyCapacity: number;
}

export type TodayState = 'open' | 'low' | 'soldOut';

/** Below this percentage of today's capacity the badge switches to "Últimos cupos". */
export const LOW_AVAILABILITY_PERCENT = 20;

/**
 * Badge state for today. Integer math (remaining·100 < capacity·20) avoids
 * floating-point surprises right at the 20 % boundary.
 */
export function todayState(remaining: number, capacity: number): TodayState {
  if (remaining <= 0 || capacity <= 0) return 'soldOut';
  if (remaining * 100 < capacity * LOW_AVAILABILITY_PERCENT) return 'low';
  return 'open';
}

/**
 * Remaining slots on `date`. monthAvailability() omits days with no bookings
 * and no override, which still have the whole default capacity free.
 */
export function remainingOn(
  date: string,
  availability: Record<string, number>,
  defaultCapacity?: number
): number | undefined {
  return availability[date] ?? defaultCapacity;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/availability.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/availability.ts src/lib/availability.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add today availability state helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Límites del grupo (`src/lib/party-limits.ts`)

`bookingSchema` (`src/lib/schemas.ts`) permite 0–20 adultos y 0–20 niños con al menos 1 persona; **no** limita el total. El hero aplica el requisito "1–20 personas en total", que es un subconjunto estricto de lo que acepta el servidor (todo lo que el hero envía es válido en `/reservar` y en `processBooking`).

**Files:**
- Create: `src/lib/party-limits.ts`
- Test: `src/lib/party-limits.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/party-limits.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PARTY_MIN, PARTY_MAX, canAddGuest, canRemoveGuest } from './party-limits';

describe('party limits (hero card: 1–20 people in total)', () => {
  it('exposes the bounds', () => {
    expect(PARTY_MIN).toBe(1);
    expect(PARTY_MAX).toBe(20);
  });

  it('canAddGuest is false once the party reaches 20', () => {
    expect(canAddGuest(10, 9)).toBe(true);
    expect(canAddGuest(19, 0)).toBe(true);
    expect(canAddGuest(19, 1)).toBe(false);
    expect(canAddGuest(0, 20)).toBe(false);
  });

  it('canRemoveGuest needs someone in that group and keeps at least 1 person overall', () => {
    expect(canRemoveGuest(2, 2, 1)).toBe(true);
    expect(canRemoveGuest(1, 1, 1)).toBe(true);
    expect(canRemoveGuest(0, 0, 1)).toBe(false); // empty group
    expect(canRemoveGuest(1, 1, 0)).toBe(false); // last person
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/party-limits.test.ts`
Expected: FAIL — `Failed to resolve import "./party-limits"`.

- [ ] **Step 3: Implementación mínima**

`src/lib/party-limits.ts`:

```ts
/**
 * Whole-party rules for the landing hero card. bookingSchema allows 0–20 per
 * group and ≥ 1 in total; the hero is stricter (1–20 in total), so whatever it
 * sends is always valid for /reservar and processBooking.
 */
export const PARTY_MIN = 1;
export const PARTY_MAX = 20;

/** One more person (adult or child) fits in the party. */
export function canAddGuest(adults: number, children: number): boolean {
  return adults + children < PARTY_MAX;
}

/** `groupCount` is the group being decreased (adults or children). */
export function canRemoveGuest(groupCount: number, adults: number, children: number): boolean {
  return groupCount > 0 && adults + children > PARTY_MIN;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/party-limits.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/party-limits.ts src/lib/party-limits.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add 1-20 whole-party limits for the hero card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Acción pública `getTodayCapacity()`

Hoy la página solo conoce `getTodayRemaining()` (un número). El badge necesita además la capacidad total de hoy (override del día o la de `settings`) para calcular el 20 %, y el calendario necesita la capacidad por defecto para mostrar "Quedan N" en días sin reservas ni override. `getTodayRemaining()` se mantiene intacta porque la usa `src/app/reservar/page.tsx` (PR 06).

**Files:**
- Modify: `src/app/actions/booking.ts`
- Test: `src/app/actions/booking.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/app/actions/booking.test.ts`, reemplaza el mock de `@/lib/db/reservations`:

```ts
vi.mock('@/lib/db/reservations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/reservations')>()),
  sumPartySize: vi.fn(),
}));
```

por:

```ts
vi.mock('@/lib/db/reservations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/reservations')>()),
  sumPartySize: vi.fn(),
  monthAvailability: vi.fn(),
  getSettings: vi.fn(),
  listOverrides: vi.fn(),
}));
```

Reemplaza las dos líneas de import:

```ts
import { submitBookingAndPay, getCurrentRate, getWeekendBookedPeople } from './booking';
```
```ts
import { sumPartySize } from '@/lib/db/reservations';
```

por:

```ts
import { submitBookingAndPay, getCurrentRate, getWeekendBookedPeople, getTodayCapacity } from './booking';
```
```ts
import { sumPartySize, monthAvailability, getSettings, listOverrides } from '@/lib/db/reservations';
```

Y añade al final del archivo:

```ts
describe('getTodayCapacity', () => {
  const SETTINGS = {
    daily_capacity: 100, adult_price_usd: 15, child_price_usd: 5,
    last_bcv_rate: null, last_bcv_rate_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00Z')); // Wednesday 11:00 Caracas
    vi.mocked(getSettings).mockResolvedValue(SETTINGS);
    vi.mocked(listOverrides).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('an untouched day has the whole default capacity free', async () => {
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-08': 3 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 100, capacity: 100, dailyCapacity: 100 });
    expect(monthAvailability).toHaveBeenCalledWith('2026-10');
  });

  it('reports what bookings left against the default capacity', async () => {
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-07': 15 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 15, capacity: 100, dailyCapacity: 100 });
  });

  it("uses today's override as today's capacity", async () => {
    vi.mocked(listOverrides).mockResolvedValue([
      { date: '2026-10-06', capacity: 10, reason: null },
      { date: '2026-10-07', capacity: 40, reason: 'Evento' },
    ]);
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-07': 6 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 6, capacity: 40, dailyCapacity: 100 });
  });

  it('a closed day (override 0) has 0 remaining and 0 capacity', async () => {
    vi.mocked(listOverrides).mockResolvedValue([{ date: '2026-10-07', capacity: 0, reason: 'Cerrado' }]);
    vi.mocked(monthAvailability).mockResolvedValue({ '2026-10-07': 0 });
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 0, capacity: 0, dailyCapacity: 100 });
  });

  it('anchors "today" to Caracas: 22:00 on Oct 31 Caracas is still October', async () => {
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z')); // Nov 1 in UTC, Oct 31 in Caracas
    vi.mocked(listOverrides).mockResolvedValue([{ date: '2026-10-31', capacity: 50, reason: null }]);
    vi.mocked(monthAvailability).mockResolvedValue({});
    await expect(getTodayCapacity()).resolves.toEqual({ remaining: 50, capacity: 50, dailyCapacity: 100 });
    expect(monthAvailability).toHaveBeenCalledWith('2026-10');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/actions/booking.test.ts`
Expected: FAIL — `getTodayCapacity is not a function` (los tests existentes siguen pasando).

- [ ] **Step 3: Implementación mínima**

En `src/app/actions/booking.ts`, reemplaza:

```ts
import {
  reserveSlots, confirmReservation, failReservation,
  getSettings, readRateCache, writeRateCache, monthAvailability, sumPartySize,
} from '@/lib/db/reservations';
```

por:

```ts
import {
  reserveSlots, confirmReservation, failReservation,
  getSettings, readRateCache, writeRateCache, monthAvailability, sumPartySize,
  listOverrides,
} from '@/lib/db/reservations';
import type { TodayCapacity } from '@/lib/availability';
```

Y añade justo después de la función `getTodayRemaining()` (antes del comentario de `getWeekendBookedPeople`):

```ts
/**
 * Today's (Caracas) live numbers for the landing hero: remaining slots, today's
 * capacity (the day's override, else the default) and the default daily
 * capacity, which is what any day absent from monthAvailability has free.
 */
export async function getTodayCapacity(): Promise<TodayCapacity> {
  const today = todayCaracas();
  const [avail, settings, overrides] = await Promise.all([
    monthAvailability(today.slice(0, 7)),
    getSettings(),
    listOverrides(),
  ]);
  const dailyCapacity = settings.daily_capacity;
  const capacity = overrides.find((o) => o.date === today)?.capacity ?? dailyCapacity;
  return { remaining: avail[today] ?? capacity, capacity, dailyCapacity };
}
```

(`'use server'` solo admite exportar funciones async; `TodayCapacity` es un `import type`, se borra al compilar, así que es válido.)

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/actions/booking.test.ts`
Expected: PASS (todos, incluidos los 5 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/booking.ts src/app/actions/booking.test.ts
git commit -m "$(cat <<'EOF'
feat(booking): add getTodayCapacity public action

Returns today's remaining slots, today's capacity (override or default) and
the default daily capacity, so the landing badge can flag < 20 % left and
the calendar can label untouched days.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Textos nuevos (es / en)

`src/lib/i18n/dictionaries.test.ts` ya exige mismas claves, mismos `{placeholders}`, nada vacío y nada copiado igual de `es` a `en`; `tsc` exige que `en` cumpla `Dictionary`. Ese es el test de esta tarea.

**Files:**
- Modify: `src/lib/i18n/es.ts`
- Modify: `src/lib/i18n/en.ts`

- [ ] **Step 1: Añadir claves en `hero` (es)**

En `src/lib/i18n/es.ts` reemplaza:

```ts
    poolOpen: 'Piscina abierta',
    soldOutToday: 'Agotado hoy',
  },
```

por:

```ts
    poolOpen: 'Piscina abierta',
    soldOutToday: 'Agotado hoy',
    lastSpots: 'Últimos cupos',
    spotsLeftToday: 'Quedan {count} cupos hoy',
    weekendBooked: '🔥 {count} personas ya reservaron para este fin de semana',
  },
```

- [ ] **Step 2: Añadir namespaces `heroCard` y `datePicker` al final (es)**

En `src/lib/i18n/es.ts` reemplaza el final del archivo:

```ts
  party: {
    adultOne: '{count} adulto',
    adultOther: '{count} adultos',
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
};
```

por:

```ts
  party: {
    adultOne: '{count} adulto',
    adultOther: '{count} adultos',
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
  heroCard: {
    title: 'Reserva tu pase',
    subtitle: 'Elige fecha y personas, y ve el total al instante',
    securePayment: 'Pago seguro con Pago Móvil',
    stepOf: 'Paso {n} de 3',
    stepDate: 'Fecha',
    stepGuests: 'Personas',
    stepTotal: 'Total estimado',
    slotsOnDate: 'Quedan {count} cupos',
    noSlotsOnDate: 'Sin cupos para esta fecha',
    whenTitle: '¿Cuándo vienes?',
    whoTitle: '¿Quiénes van?',
    adults: 'Adultos',
    children: 'Niños',
    perPerson: '{price} por persona',
    partyLimit: 'De 1 a {max} personas por reserva',
    next: 'Siguiente',
    seeTotal: 'Ver total',
    rateLine: 'Bs. {ves} · tasa {rate}',
    rateUnavailable: 'Verás el monto en Bs. al pagar',
    cta: 'Reservar mi pase ahora',
  },
  datePicker: {
    slotsLeft: 'Quedan {count}',
  },
};
```

- [ ] **Step 3: Lo mismo en inglés**

En `src/lib/i18n/en.ts` reemplaza:

```ts
    poolOpen: 'Pool open',
    soldOutToday: 'Sold out today',
  },
```

por:

```ts
    poolOpen: 'Pool open',
    soldOutToday: 'Sold out today',
    lastSpots: 'Last spots left',
    spotsLeftToday: '{count} spots left today',
    weekendBooked: '🔥 {count} people already booked for this weekend',
  },
```

Y reemplaza el final del archivo:

```ts
  party: {
    adultOne: '{count} adult',
    adultOther: '{count} adults',
    childOne: '{count} child',
    childOther: '{count} children',
  },
};
```

por:

```ts
  party: {
    adultOne: '{count} adult',
    adultOther: '{count} adults',
    childOne: '{count} child',
    childOther: '{count} children',
  },
  heroCard: {
    title: 'Book your pass',
    subtitle: 'Pick a date and your group to see the total right away',
    securePayment: 'Secure payment with Pago Móvil',
    stepOf: 'Step {n} of 3',
    stepDate: 'Date',
    stepGuests: 'Guests',
    stepTotal: 'Estimated total',
    slotsOnDate: '{count} spots left',
    noSlotsOnDate: 'No spots left on this date',
    whenTitle: 'When are you coming?',
    whoTitle: "Who's coming?",
    adults: 'Adults',
    children: 'Kids',
    perPerson: '{price} per person',
    partyLimit: '1 to {max} people per booking',
    next: 'Next',
    seeTotal: 'See total',
    rateLine: 'Bs. {ves} · rate {rate}',
    rateUnavailable: "You'll see the Bs. amount at checkout",
    cta: 'Book my pass now',
  },
  datePicker: {
    slotsLeft: '{count} left',
  },
};
```

- [ ] **Step 4: Verificar**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/i18n && npx tsc --noEmit`
Expected: PASS en todos los tests de `src/lib/i18n` y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/es.ts src/lib/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(i18n): add hero badge, heroCard and datePicker copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `CountRow` con icono, límites configurables y 44 px

Props nuevas **opcionales**; sin ellas el comportamiento es el de hoy (0–20 por grupo), así que `booking-card.tsx` (PR 06) no cambia.

**Files:**
- Modify: `src/components/booking/count-row.tsx`
- Test: `src/components/booking/count-row.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

`src/components/booking/count-row.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';
import { CountRow } from './count-row';
import { renderWithI18n } from '@/test/i18n';

type Props = Parameters<typeof CountRow>[0];

function renderRow(over: Partial<Props> = {}) {
  const onChange = vi.fn();
  renderWithI18n(
    <CountRow label="Adultos" hint="$15 por persona" value={2} onChange={onChange} testId="row" {...over} />
  );
  return onChange;
}

describe('CountRow', () => {
  it('steps by one in both directions', async () => {
    const onChange = renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar adultos' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Disminuir adultos' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('keeps the default 0–20 bounds per group', () => {
    renderRow({ value: 0 });
    expect(screen.getByRole('button', { name: 'Disminuir adultos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar adultos' })).toBeEnabled();
  });

  it('disables increase at 20 by default', () => {
    renderRow({ value: 20 });
    expect(screen.getByRole('button', { name: 'Aumentar adultos' })).toBeDisabled();
  });

  it('honours canIncrease / canDecrease overrides (whole-party limits)', () => {
    renderRow({ value: 5, canIncrease: false, canDecrease: false });
    expect(screen.getByRole('button', { name: 'Aumentar adultos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disminuir adultos' })).toBeDisabled();
  });

  it('renders the optional icon', () => {
    renderRow({ icon: <User data-testid="row-icon" /> });
    expect(screen.getByTestId('row-icon')).toBeInTheDocument();
  });

  it('shows the value under the given test id', () => {
    renderRow({ value: 7 });
    expect(screen.getByTestId('row')).toHaveTextContent('7');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/count-row.test.tsx`
Expected: FAIL — el test de overrides (los botones siguen habilitados) y el del icono (`Unable to find an element by: [data-testid="row-icon"]`). Vitest no comprueba tipos, así que las props nuevas aún no dan error de compilación aquí.

- [ ] **Step 3: Implementación**

Reemplaza todo `src/components/booking/count-row.tsx` por:

```tsx
'use client';

import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { interpolate } from '@/lib/i18n/format';

/** Per-group upper bound from bookingSchema (0–20 adults, 0–20 children). */
const GROUP_MAX = 20;

const STEP_BUTTON =
  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border text-navy transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export function CountRow(props: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
  /** Optional leading icon (e.g. User / Baby) to tell the groups apart at a glance. */
  icon?: ReactNode;
  /** Override the default per-group bounds, e.g. to enforce a whole-party limit. */
  canDecrease?: boolean;
  canIncrease?: boolean;
}) {
  const t = useT();
  const label = props.label.toLowerCase();
  const canDecrease = props.canDecrease ?? props.value > 0;
  const canIncrease = props.canIncrease ?? props.value < GROUP_MAX;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        {props.icon && (
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            {props.icon}
          </span>
        )}
        <div>
          <p className="font-bold text-navy">{props.label}</p>
          <p className="text-xs text-muted-foreground">{props.hint}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={interpolate(t.booking.decrease, { label })}
          disabled={!canDecrease}
          onClick={() => props.onChange(Math.max(props.value - 1, 0))}
          className={STEP_BUTTON}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          data-testid={props.testId}
          aria-live="polite"
          className="w-7 text-center font-heading text-lg font-semibold"
        >
          {props.value}
        </span>
        <button
          type="button"
          aria-label={interpolate(t.booking.increase, { label })}
          disabled={!canIncrease}
          onClick={() => props.onChange(Math.min(props.value + 1, GROUP_MAX))}
          className={STEP_BUTTON}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa (y que `/reservar` sigue verde)**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking`
Expected: PASS en `count-row.test.tsx` y en `booking-card.test.tsx` (sin cambios).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/count-row.tsx src/components/booking/count-row.test.tsx
git commit -m "$(cat <<'EOF'
feat(booking): CountRow icon, configurable bounds and 44px steppers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: "Quedan N" bajo cada día en `DatePickerPanel`

react-day-picker pinta los botones de día, así que los números llegan por contexto a un `DayButton` definido a nivel de módulo (tipo estable: los botones no se remontan en cada render y el foco de teclado se conserva). La etiqueta se muestra siempre (no hover, para móvil) en días habilitados del mes visible y se añade al `aria-label`. Sin `defaultCapacity` (caso actual de `/reservar`) solo se etiquetan los días que vienen en `availability` (con reservas u override); la e2e de `/reservar` usa `td[data-day] button`, que no cambia.

**Files:**
- Modify: `src/components/booking/date-picker-panel.tsx`
- Test: `src/components/booking/date-picker-panel.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

`src/components/booking/date-picker-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { DatePickerPanel } from './date-picker-panel';
import { renderWithI18n } from '@/test/i18n';

// A month far in the future: no day is disabled for being in the past.
const base = {
  date: '2099-03-10',
  availability: { '2099-03-12': 7, '2099-03-13': 0 },
  onSelect: vi.fn(),
  onMonthChange: vi.fn(),
};

function cell(container: HTMLElement, day: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`td[data-day="${day}"]:not([data-outside])`);
  if (!el) throw new Error(`no cell for ${day}`);
  return el;
}

describe('DatePickerPanel "Quedan N"', () => {
  it('labels every available day, using the default capacity for untouched days', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />);
    expect(cell(container, '2099-03-12')).toHaveTextContent('Quedan 7');
    expect(cell(container, '2099-03-14')).toHaveTextContent('Quedan 100');
  });

  it('does not label sold-out (disabled) days', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />);
    expect(cell(container, '2099-03-13')).not.toHaveTextContent(/Quedan/);
  });

  it('without a default capacity only labels days it has numbers for (/reservar today)', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} />);
    expect(cell(container, '2099-03-12')).toHaveTextContent('Quedan 7');
    expect(cell(container, '2099-03-14')).not.toHaveTextContent(/Quedan/);
  });

  it('adds the remaining slots to the day button accessible name', () => {
    renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />);
    expect(screen.getByRole('button', { name: /Quedan 7$/ })).toBeInTheDocument();
  });

  it('speaks English', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />, { locale: 'en' });
    expect(cell(container, '2099-03-12')).toHaveTextContent('7 left');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/date-picker-panel.test.tsx`
Expected: FAIL — `expected element to have text content "Quedan 7"`.

- [ ] **Step 3: Implementación**

Reemplaza todo `src/components/booking/date-picker-panel.tsx` por:

```tsx
'use client';

import { createContext, useContext } from 'react';
import { format } from 'date-fns';
import type { DayButtonProps } from 'react-day-picker';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/lib/i18n/provider';
import { dateFnsLocale } from '@/lib/i18n/date-locale';
import { interpolate } from '@/lib/i18n/format';
import { remainingOn } from '@/lib/availability';

type SlotsInfo = {
  slotsFor: (isoDate: string) => number | undefined;
  label: (count: number) => string;
};

// react-day-picker renders the day buttons, so the per-day numbers reach them
// through context. A module-level component keeps a stable type, so the
// buttons are not remounted on every render (keyboard focus survives).
const SlotsContext = createContext<SlotsInfo>({ slotsFor: () => undefined, label: String });

function SlotDayButton({ children, className, ...props }: DayButtonProps) {
  const { slotsFor, label } = useContext(SlotsContext);
  const { day, modifiers } = props;
  // Outside days belong to another month whose availability is not loaded.
  const slots = modifiers.disabled || modifiers.outside ? undefined : slotsFor(day.isoDate);
  const text = slots !== undefined && slots > 0 ? label(slots) : null;
  return (
    <CalendarDayButton
      {...props}
      className={cn(className, 'gap-0.5')}
      aria-label={[props['aria-label'], text].filter(Boolean).join(', ')}
    >
      {children}
      {text && (
        <span
          data-slot="slots-left"
          className="whitespace-normal text-[9px]! leading-none! sm:text-[10px]!"
        >
          {text}
        </span>
      )}
    </CalendarDayButton>
  );
}

/**
 * Shared calendar editor. Reports the picked day as a `YYYY-MM-DD` string and the
 * viewed month as `YYYY-MM`. Disables past days and days with no availability,
 * and prints "Quedan N" under every available day (always visible, not on
 * hover, so it works on phones).
 *
 * `defaultCapacity` (settings.daily_capacity) labels days that are absent from
 * `availability` (no bookings, no override). Without it only listed days get
 * a label.
 *
 * Renders a bare, centered calendar with no surrounding chrome — callers wrap it
 * in their editor box. Month and weekday names follow the visitor's language.
 */
export function DatePickerPanel(props: {
  date: string;
  availability: Record<string, number>;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
  defaultCapacity?: number;
}) {
  const locale = useLocale();
  const t = useT();
  const anchor = new Date(`${props.date}T12:00:00`);
  const slots: SlotsInfo = {
    slotsFor: (isoDate) => remainingOn(isoDate, props.availability, props.defaultCapacity),
    label: (count) => interpolate(t.datePicker.slotsLeft, { count }),
  };
  return (
    <SlotsContext value={slots}>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          locale={dateFnsLocale(locale)}
          weekStartsOn={0}
          // 7 × 36px fits a 360px phone inside the cards; 44px touch targets from sm up.
          className="bg-transparent p-0 [--cell-size:2.25rem] sm:p-2 sm:[--cell-size:2.75rem]"
          selected={anchor}
          defaultMonth={anchor}
          components={{ DayButton: SlotDayButton }}
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
    </SlotsContext>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa (incluido `/reservar`)**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking && npx tsc --noEmit`
Expected: PASS en `date-picker-panel.test.tsx`, `count-row.test.tsx` y `booking-card.test.tsx`; `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/date-picker-panel.tsx src/components/booking/date-picker-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(booking): show "Quedan N" under each available calendar day

Always visible (not hover-only) so it works on phones, and part of the
day button's accessible name. Optional defaultCapacity labels untouched
days; /reservar keeps working unchanged without it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Badge en vivo y chip de prueba social (`hero-signals.tsx`)

**Files:**
- Create: `src/components/landing/hero-signals.tsx`
- Test: `src/components/landing/hero-signals.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

`src/components/landing/hero-signals.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodayBadge, WeekendChip } from './hero-signals';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('TodayBadge', () => {
  it('open: "Piscina abierta" with a pulsing dot and the remaining count', () => {
    const { container } = render(<TodayBadge t={es} remaining={80} capacity={100} />);
    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-state', 'open');
    expect(badge).toHaveTextContent('Piscina abierta');
    expect(badge).toHaveTextContent('Quedan 80 cupos hoy');
    expect(container.querySelector('[data-pulse]')).not.toBeNull();
  });

  it('pulses only under prefers-reduced-motion: no-preference', () => {
    const { container } = render(<TodayBadge t={es} remaining={80} capacity={100} />);
    expect(container.querySelector('[data-pulse]')?.className).toMatch(/motion-safe:animate-ping/);
  });

  it('low: "Últimos cupos" below 20 % of today\'s capacity, without the pulse', () => {
    const { container } = render(<TodayBadge t={es} remaining={19} capacity={100} />);
    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-state', 'low');
    expect(badge).toHaveTextContent('Últimos cupos');
    expect(badge).toHaveTextContent('Quedan 19 cupos hoy');
    expect(container.querySelector('[data-pulse]')).toBeNull();
  });

  it('exactly 20 % is still open', () => {
    render(<TodayBadge t={es} remaining={20} capacity={100} />);
    expect(screen.getByTestId('today-badge')).toHaveAttribute('data-state', 'open');
  });

  it('soldOut: "Agotado hoy" and no count', () => {
    render(<TodayBadge t={es} remaining={0} capacity={100} />);
    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-state', 'soldOut');
    expect(badge).toHaveTextContent('Agotado hoy');
    expect(badge).not.toHaveTextContent(/Quedan/);
  });

  it('a closed day (capacity 0) is sold out', () => {
    render(<TodayBadge t={es} remaining={0} capacity={0} />);
    expect(screen.getByTestId('today-badge')).toHaveAttribute('data-state', 'soldOut');
  });

  it('speaks English', () => {
    render(<TodayBadge t={en} remaining={10} capacity={100} />);
    expect(screen.getByTestId('today-badge')).toHaveTextContent('Last spots left');
    expect(screen.getByTestId('today-badge')).toHaveTextContent('10 spots left today');
  });
});

describe('WeekendChip', () => {
  it('shows the real weekend count', () => {
    render(<WeekendChip t={es} people={24} />);
    expect(screen.getByText('🔥 24 personas ya reservaron para este fin de semana')).toBeInTheDocument();
  });

  it('renders nothing when there is no real number (null)', () => {
    const { container } = render(<WeekendChip t={es} people={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('speaks English', () => {
    render(<WeekendChip t={en} people={12} />);
    expect(screen.getByText('🔥 12 people already booked for this weekend')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/hero-signals.test.tsx`
Expected: FAIL — `Failed to resolve import "./hero-signals"`.

- [ ] **Step 3: Implementación**

`src/components/landing/hero-signals.tsx`:

```tsx
import type { Dictionary } from '@/lib/i18n/types';
import { interpolate } from '@/lib/i18n/format';
import { todayState, type TodayState } from '@/lib/availability';
import { cn } from '@/lib/utils';

const GLASS = 'border border-white/20 bg-white/10 backdrop-blur-md';

const DOT: Record<TodayState, string> = {
  open: 'bg-emerald-400',
  low: 'bg-amber-400',
  soldOut: 'bg-destructive',
};

const RING: Record<TodayState, string> = {
  open: 'ring-emerald-300/30',
  low: 'ring-amber-300/60',
  soldOut: 'ring-destructive/60',
};

/**
 * Live availability for today (Caracas): green pulsing dot while there is room,
 * amber "Últimos cupos" below 20 % of today's capacity, red "Agotado hoy" at 0.
 * Server-safe (no hooks): the hero renders it on the server with fresh numbers.
 */
export function TodayBadge(props: { t: Dictionary; remaining: number; capacity: number }) {
  const { t } = props;
  const state = todayState(props.remaining, props.capacity);
  const label =
    state === 'open' ? t.hero.poolOpen : state === 'low' ? t.hero.lastSpots : t.hero.soldOutToday;
  return (
    <div
      role="status"
      data-testid="today-badge"
      data-state={state}
      className={cn('inline-flex items-center gap-3 rounded-full px-4 py-2 ring-1', GLASS, RING[state])}
    >
      <span aria-hidden className="relative flex h-2.5 w-2.5">
        {state === 'open' && (
          <span
            data-pulse
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping"
          />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', DOT[state])} />
      </span>
      <span className="text-sm font-semibold text-white">{label}</span>
      {state !== 'soldOut' && (
        <span className="text-xs text-white/75">
          {interpolate(t.hero.spotsLeftToday, { count: props.remaining })}
        </span>
      )}
    </div>
  );
}

/**
 * Social proof with real numbers only (roadmap §2): people with a confirmed or
 * checked-in booking for the upcoming weekend. `null` (below the threshold or
 * on error) renders nothing.
 */
export function WeekendChip(props: { t: Dictionary; people: number | null; className?: string }) {
  if (props.people === null) return null;
  return (
    <p
      data-testid="weekend-chip"
      className={cn('inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white', GLASS, props.className)}
    >
      {interpolate(props.t.hero.weekendBooked, { count: props.people })}
    </p>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/hero-signals.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/hero-signals.tsx src/components/landing/hero-signals.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): live today badge and real weekend social-proof chip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `HeroBookingCard` como wizard de 3 pasos

Comportamiento:
- Vista resumen (`step === null`): 3 tiles numerados. **1 Fecha** (botón, abre el paso 1; muestra "Quedan N cupos" del día elegido o "Sin cupos para esta fecha"), **2 Personas** (botón, abre el paso 2; "2 adultos, 1 niño" + iconos `User`/`Baby`), **3 Total estimado** (USD + "Bs. X · tasa Y", o "Verás el monto en Bs. al pagar" si la tasa es `null` o falla).
- Paso 1: calendario con "Quedan N" (pasa `defaultCapacity`) → botón "Siguiente" al paso 2.
- Paso 2: steppers con iconos, 1–20 personas en total → botón "Ver total" vuelve al resumen.
- El CTA coral "Reservar mi pase ahora" está siempre visible y navega a `/reservar?date=&adults=&children=&pay=1` (como hoy). Como el grupo nunca baja de 1, desaparece la rama "0 asistentes".
- La tasa se pide una vez al montar con `getCurrentRate()` (igual que `booking-card.tsx`); no bloquea el render del servidor.
- Al cambiar de mes, la disponibilidad nueva se **fusiona** con la anterior, para que el tile del día elegido no pierda su número si el usuario navega a otro mes sin elegir.

**Files:**
- Modify (reescritura): `src/components/landing/hero-booking-card.tsx`
- Test (reescritura): `src/components/landing/hero-booking-card.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

Reemplaza todo `src/components/landing/hero-booking-card.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroBookingCard } from './hero-booking-card';
import { renderWithI18n } from '@/test/i18n';
import { todayCaracas } from '@/lib/dates';

vi.mock('@/app/actions/booking', () => ({
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => 36.5),
}));

import { getCurrentRate } from '@/app/actions/booking';

const props = { prices: { adult: 15, child: 5 }, dailyCapacity: 100, initialAvailability: {} };
const user = userEvent.setup();

function cta(name: RegExp = /reservar mi pase ahora/i) {
  return screen.getByRole('link', { name });
}

describe('HeroBookingCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('summary: date with slots, party, total in USD and Bs., coral CTA to /reservar', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(screen.getByRole('heading', { name: 'Reserva tu pase' })).toBeInTheDocument();
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Quedan 100 cupos');
    expect(screen.getByTestId('hero-step-guests')).toHaveTextContent('2 adultos, 1 niño');
    expect(screen.getByTestId('hero-total-usd')).toHaveTextContent('$35 USD');
    expect(await screen.findByText('Bs. 1277.50 · tasa 36.50')).toBeInTheDocument();
    expect(cta()).toHaveAttribute(
      'href',
      `/reservar?date=${todayCaracas()}&adults=2&children=1&pay=1`
    );
  });

  it('renders in English', async () => {
    renderWithI18n(<HeroBookingCard {...props} />, { locale: 'en' });
    expect(screen.getByRole('heading', { name: 'Book your pass' })).toBeInTheDocument();
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('100 spots left');
    expect(screen.getByTestId('hero-step-guests')).toHaveTextContent('2 adults, 1 child');
    expect(await screen.findByText('Bs. 1277.50 · rate 36.50')).toBeInTheDocument();
    expect(cta(/book my pass now/i)).toBeInTheDocument();
  });

  it('uses the day\'s computed remaining slots and flags a sold-out day', () => {
    const today = todayCaracas();
    const { unmount } = renderWithI18n(
      <HeroBookingCard {...props} initialAvailability={{ [today]: 12 }} />
    );
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Quedan 12 cupos');
    unmount();
    renderWithI18n(<HeroBookingCard {...props} initialAvailability={{ [today]: 0 }} />);
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Sin cupos para esta fecha');
  });

  it('degrades gracefully when the BCV rate is unavailable', async () => {
    vi.mocked(getCurrentRate).mockResolvedValueOnce(null);
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(await screen.findByText('Verás el monto en Bs. al pagar')).toBeInTheDocument();
    expect(screen.getByTestId('hero-total-usd')).toHaveTextContent('$35 USD');
  });

  it('degrades gracefully when fetching the rate fails', async () => {
    vi.mocked(getCurrentRate).mockRejectedValueOnce(new Error('bcv down'));
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(await screen.findByText('Verás el monto en Bs. al pagar')).toBeInTheDocument();
  });

  it('walks the 3 steps: date → guests → total', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-date'));
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Cuándo vienes?' })).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument(); // the calendar

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Quiénes van?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver total' }));
    expect(screen.getByTestId('hero-total-usd')).toBeInTheDocument();
    // The CTA is reachable at every step.
    expect(cta()).toBeInTheDocument();
  });

  it('never lets the party drop below 1 person', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-guests'));
    await user.click(screen.getByRole('button', { name: 'Disminuir niños' }));
    await user.click(screen.getByRole('button', { name: 'Disminuir adultos' }));
    expect(screen.getByTestId('hero-adults-count')).toHaveTextContent('1');
    expect(screen.getByTestId('hero-children-count')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Disminuir adultos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disminuir niños' })).toBeDisabled();
    expect(cta()).toHaveAttribute('href', expect.stringContaining('&adults=1&children=0&pay=1'));
  });

  it('caps the whole party at 20 people', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-guests'));
    expect(screen.getByText('De 1 a 20 personas por reserva')).toBeInTheDocument();
    const addAdult = screen.getByRole('button', { name: 'Aumentar adultos' });
    for (let i = 0; i < 17; i++) await user.click(addAdult); // 19 adults + 1 child
    expect(screen.getByTestId('hero-adults-count')).toHaveTextContent('19');
    expect(addAdult).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar niños' })).toBeDisabled();
  });

  it('shows User / Baby icons on the guest rows', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-guests'));
    const adultsRow = screen.getByText('Adultos').closest('div.rounded-xl') as HTMLElement;
    const kidsRow = screen.getByText('Niños').closest('div.rounded-xl') as HTMLElement;
    expect(within(adultsRow).getByTestId('icon-adult')).toBeInTheDocument();
    expect(within(kidsRow).getByTestId('icon-child')).toBeInTheDocument();
  });

  it('CTA scales on hover/press only when motion is allowed', () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    const cls = cta().className;
    expect(cls).toMatch(/motion-safe:hover:scale-\[1\.02\]/);
    expect(cls).toMatch(/motion-safe:active:scale-\[0\.98\]/);
    expect(cls).not.toMatch(/(^|\s)hover:scale-/);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/hero-booking-card.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="hero-step-date"]` (y similares).

- [ ] **Step 3: Implementación**

Reemplaza todo `src/components/landing/hero-booking-card.tsx` por:

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Baby, CalendarCheck, ShieldCheck, User, Users, Wallet } from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import { getAvailability, getCurrentRate } from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import { visitLabel, todayCaracas } from '@/lib/dates';
import { PARTY_MAX, canAddGuest, canRemoveGuest } from '@/lib/party-limits';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';

type Step = null | 'date' | 'guests';

const TILE = 'h-full w-full rounded-2xl p-4 text-left';
const TILE_BUTTON = `${TILE} cursor-pointer bg-muted transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal`;
const STEP_BUTTON =
  'inline-flex min-h-11 cursor-pointer items-center rounded-full bg-navy px-6 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2';
const CTA =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/50 sm:w-auto motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]';

/** "$35" / "$37.50": never round a total that has cents. */
function usdLabel(n: number): string {
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
}

function StepHead(props: { n: number; label: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white"
        >
          {props.n}
        </span>
        {props.label}
      </span>
      <span aria-hidden className="text-teal">
        {props.icon}
      </span>
    </div>
  );
}

/**
 * Landing booking card as a 3-step wizard (date → guests → total). The CTA is
 * always reachable and carries the choice to /reservar in the payment view.
 */
export function HeroBookingCard(props: {
  prices: { adult: number; child: number };
  /** settings.daily_capacity: free slots on days absent from `initialAvailability`. */
  dailyCapacity: number;
  initialAvailability: Record<string, number>;
}) {
  const t = useT();
  const locale = useLocale();
  const [step, setStep] = useState<Step>(null);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [date, setDate] = useState(todayCaracas());
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  // undefined = still loading; null = BCV rate unavailable.
  const [rate, setRate] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getCurrentRate()
      .then((r) => {
        if (active) setRate(r);
      })
      .catch(() => {
        if (active) setRate(null);
      });
    return () => {
      active = false;
    };
  }, []);

  function loadMonth(month: string) {
    getAvailability(month)
      .then((next) => setAvailability((prev) => ({ ...prev, ...next })))
      .catch(() => {});
  }

  const usd = totalUsd(adults, children, props.prices);
  const remaining = availability[date] ?? props.dailyCapacity;
  const continueHref = `/reservar?date=${date}&adults=${adults}&children=${children}&pay=1`;

  return (
    <div className="mt-10 rounded-[28px] border border-white/20 bg-white/10 p-2 shadow-2xl shadow-navy-deep/40 backdrop-blur-md">
      <div className="rounded-[22px] bg-card p-4 text-navy sm:p-6">
        <h2 className="font-heading text-2xl font-semibold">{t.heroCard.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.heroCard.subtitle}</p>

        {/* ---- SUMMARY: the three steps ---- */}
        {step === null && (
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            <li>
              <button
                type="button"
                data-testid="hero-step-date"
                onClick={() => setStep('date')}
                className={TILE_BUTTON}
              >
                <StepHead n={1} label={t.heroCard.stepDate} icon={<CalendarCheck className="h-5 w-5" />} />
                <p className="mt-2 font-heading text-lg font-semibold">{visitLabel(date, locale)}</p>
                <p
                  className={`mt-0.5 text-xs font-semibold ${remaining > 0 ? 'text-secondary-foreground' : 'text-destructive'}`}
                >
                  {remaining > 0
                    ? interpolate(t.heroCard.slotsOnDate, { count: remaining })
                    : t.heroCard.noSlotsOnDate}
                </p>
              </button>
            </li>
            <li>
              <button
                type="button"
                data-testid="hero-step-guests"
                onClick={() => setStep('guests')}
                className={TILE_BUTTON}
              >
                <StepHead n={2} label={t.heroCard.stepGuests} icon={<Users className="h-5 w-5" />} />
                <p className="mt-2 font-heading text-lg font-semibold">
                  {formatParty(t.party, adults, children)}
                </p>
                <p aria-hidden className="mt-0.5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {adults}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Baby className="h-3.5 w-3.5" />
                    {children}
                  </span>
                </p>
              </button>
            </li>
            <li>
              <div className={`${TILE} bg-secondary`} aria-live="polite">
                <StepHead n={3} label={t.heroCard.stepTotal} icon={<Wallet className="h-5 w-5" />} />
                <p
                  data-testid="hero-total-usd"
                  className="mt-2 font-heading text-2xl font-semibold text-secondary-foreground"
                >
                  ${usdLabel(usd)} USD
                </p>
                <p className="mt-0.5 min-h-4 text-xs text-secondary-foreground/80">
                  {rate === undefined
                    ? null
                    : rate === null
                      ? t.heroCard.rateUnavailable
                      : interpolate(t.heroCard.rateLine, {
                          ves: usdToVes(usd, rate).toFixed(2),
                          rate: rate.toFixed(2),
                        })}
                </p>
              </div>
            </li>
          </ol>
        )}

        {/* ---- STEP 1: DATE ---- */}
        {step === 'date' && (
          <section aria-labelledby="hero-date-title" className="mt-5 rounded-2xl bg-muted p-2 sm:p-5">
            <div className="px-2 pt-2 sm:p-0">
              <p className="text-xs font-semibold text-muted-foreground">
                {interpolate(t.heroCard.stepOf, { n: 1 })}
              </p>
              <h3 id="hero-date-title" className="font-heading text-xl font-semibold">
                {t.heroCard.whenTitle}
              </h3>
            </div>
            <div className="mt-3">
              <DatePickerPanel
                date={date}
                availability={availability}
                defaultCapacity={props.dailyCapacity}
                onSelect={setDate}
                onMonthChange={loadMonth}
              />
            </div>
            <div className="mt-3 flex justify-end px-2 pb-2 sm:p-0">
              <button type="button" onClick={() => setStep('guests')} className={STEP_BUTTON}>
                {t.heroCard.next}
              </button>
            </div>
          </section>
        )}

        {/* ---- STEP 2: GUESTS ---- */}
        {step === 'guests' && (
          <section aria-labelledby="hero-guests-title" className="mt-5 rounded-2xl bg-muted p-3 sm:p-5">
            <p className="text-xs font-semibold text-muted-foreground">
              {interpolate(t.heroCard.stepOf, { n: 2 })}
            </p>
            <h3 id="hero-guests-title" className="font-heading text-xl font-semibold">
              {t.heroCard.whoTitle}
            </h3>
            <div className="mt-4 space-y-3">
              <CountRow
                label={t.heroCard.adults}
                hint={interpolate(t.heroCard.perPerson, { price: `$${usdLabel(props.prices.adult)}` })}
                icon={<User data-testid="icon-adult" className="h-5 w-5" />}
                value={adults}
                onChange={setAdults}
                canDecrease={canRemoveGuest(adults, adults, children)}
                canIncrease={canAddGuest(adults, children)}
                testId="hero-adults-count"
              />
              <CountRow
                label={t.heroCard.children}
                hint={interpolate(t.heroCard.perPerson, { price: `$${usdLabel(props.prices.child)}` })}
                icon={<Baby data-testid="icon-child" className="h-5 w-5" />}
                value={children}
                onChange={setChildren}
                canDecrease={canRemoveGuest(children, adults, children)}
                canIncrease={canAddGuest(adults, children)}
                testId="hero-children-count"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-secondary-foreground">
                {interpolate(t.heroCard.partyLimit, { max: PARTY_MAX })}
              </p>
              <button type="button" onClick={() => setStep(null)} className={STEP_BUTTON}>
                {t.heroCard.seeTotal}
              </button>
            </div>
          </section>
        )}

        {/* ---- CTA (always reachable) ---- */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground">
            <ShieldCheck aria-hidden className="h-4 w-4" />
            {t.heroCard.securePayment}
          </p>
          <Link href={continueHref} className={CTA}>
            {t.heroCard.cta}
            <ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/hero-booking-card.test.tsx`
Expected: PASS (10 tests). Nota: `hero.tsx` aún pasa `remaining` (prop que ya no existe), así que `tsc` falla hasta la Task 9; no ejecutes `tsc` en esta tarea.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/hero-booking-card.tsx src/components/landing/hero-booking-card.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): HeroBookingCard as a 3-step wizard

Date with "Quedan N" per day, guests with User/Baby steppers limited to
1-20 people, live total in USD plus Bs. at the BCV rate (graceful when
unavailable) and a coral "Reservar mi pase ahora" CTA that keeps the
/reservar?date=&adults=&children=&pay=1 navigation.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `Hero` (navy + patrón acuático + vidrio) y `page.tsx`

**Files:**
- Modify (reescritura): `src/components/landing/hero.tsx`
- Test: `src/components/landing/hero.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Escribir el test que falla**

`src/components/landing/hero.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Hero } from './hero';
import { renderWithI18n } from '@/test/i18n';
import { es } from '@/lib/i18n/es';

vi.mock('@/app/actions/booking', () => ({
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => null),
}));

const base = {
  t: es,
  today: { remaining: 80, capacity: 100, dailyCapacity: 100 },
  weekendPeople: null as number | null,
  prices: { adult: 15, child: 5 },
  initialAvailability: {},
};

describe('Hero', () => {
  it('keeps the headline and prices', () => {
    renderWithI18n(<Hero {...base} />);
    expect(screen.getByRole('heading', { level: 1, name: /disfruta el agua/i })).toBeInTheDocument();
    expect(screen.getByText(/adultos desde/i)).toHaveTextContent('$15');
  });

  it("wires today's numbers into the live badge", () => {
    renderWithI18n(<Hero {...base} today={{ remaining: 15, capacity: 100, dailyCapacity: 100 }} />);
    expect(screen.getByTestId('today-badge')).toHaveAttribute('data-state', 'low');
  });

  it('hides the social proof chip without a real number', () => {
    renderWithI18n(<Hero {...base} />);
    expect(screen.queryByTestId('weekend-chip')).toBeNull();
  });

  it('shows the social proof chip with the real weekend count', () => {
    renderWithI18n(<Hero {...base} weekendPeople={24} />);
    expect(screen.getByTestId('weekend-chip')).toHaveTextContent(
      '🔥 24 personas ya reservaron para este fin de semana'
    );
  });

  it('passes the default capacity to the booking card', () => {
    renderWithI18n(<Hero {...base} today={{ remaining: 80, capacity: 100, dailyCapacity: 60 }} />);
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Quedan 60 cupos');
  });
});
```

(El último test usa un día de hoy sin entrada en `initialAvailability`, así que el tile muestra `dailyCapacity`.)

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/hero.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="today-badge"]`.

- [ ] **Step 3: Implementar `hero.tsx`**

Reemplaza todo `src/components/landing/hero.tsx` por:

```tsx
import { HeroBookingCard } from '@/components/landing/hero-booking-card';
import { TodayBadge, WeekendChip } from '@/components/landing/hero-signals';
import type { Dictionary } from '@/lib/i18n/types';
import type { TodayCapacity } from '@/lib/availability';

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

/** Low-contrast water: two tiled rows of waves. Static, pure SVG, no image request. */
function WaterPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-teal opacity-[0.12]"
    >
      <defs>
        <pattern id="hero-waves" width="160" height="48" patternUnits="userSpaceOnUse">
          <path
            d="M0 20c20 0 20-10 40-10s20 10 40 10 20-10 40-10 20 10 40 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M0 42c20 0 20-6 40-6s20 6 40 6 20-6 40-6 20 6 40 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hero-waves)" />
    </svg>
  );
}

const BACKGROUND =
  'linear-gradient(165deg, var(--navy-deep) 0%, var(--navy) 50%, var(--chart-2) 100%)';
const GLOW =
  'radial-gradient(55% 45% at 88% 8%, color-mix(in oklab, var(--teal) 32%, transparent), transparent 70%)';

export function Hero(props: {
  t: Dictionary;
  today: TodayCapacity;
  weekendPeople: number | null;
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
}) {
  const { t } = props;
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: BACKGROUND }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: GLOW }} />
      <WaterPattern />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-14">
        <div className="grid items-start gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
          <div>
            <p className="text-sm font-semibold text-teal-soft">{t.content.tagline}</p>
            <h1 className="mt-4 font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLine2}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">{t.hero.body}</p>
            <p className="mt-6 text-sm font-semibold text-white/90">
              {t.hero.adultsFrom}&nbsp;
              <span className="text-white">${props.prices.adult.toFixed(0)}</span>
              <span aria-hidden className="mx-3 text-white/40">·</span>
              {t.hero.kids}&nbsp;
              <span className="text-white">${props.prices.child.toFixed(0)}</span>
            </p>
            <WeekendChip t={t} people={props.weekendPeople} className="mt-6" />
          </div>

          <div className="flex min-h-[260px] flex-col items-center justify-center gap-6 rounded-[28px] border border-white/20 bg-white/10 p-8 backdrop-blur-md">
            <div className="text-teal-soft">
              <PoolMark />
            </div>
            <TodayBadge t={t} remaining={props.today.remaining} capacity={props.today.capacity} />
          </div>
        </div>

        <HeroBookingCard
          prices={props.prices}
          dailyCapacity={props.today.dailyCapacity}
          initialAvailability={props.initialAvailability}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Cablear `page.tsx`**

Reemplaza todo `src/app/page.tsx` por:

```tsx
import {
  getPublicPrices,
  getTodayCapacity,
  getAvailability,
  getWeekendBookedPeople,
} from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { getDictionary, getLocale } from '@/lib/i18n';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Features, HowItWorks, FinalCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = todayCaracas().slice(0, 7);
  const [prices, today, availability, weekendPeople, locale] = await Promise.all([
    getPublicPrices(),
    getTodayCapacity(),
    getAvailability(month),
    getWeekendBookedPeople(), // never throws: null hides the chip
    getLocale(),
  ]);
  const t = getDictionary(locale);
  return (
    <>
      <SiteHeader t={t} />
      <main>
        <Hero
          t={t}
          today={today}
          weekendPeople={weekendPeople}
          prices={prices}
          initialAvailability={availability}
        />
        <Features t={t} />
        <HowItWorks t={t} />
        <FinalCta t={t} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing && npx tsc --noEmit`
Expected: PASS en todos los tests de `src/components/landing` (incluidos `sections.test.tsx` y `locale-toggle.test.tsx`, sin cambios); `tsc` sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/hero.tsx src/components/landing/hero.test.tsx src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(landing): navy hero with aquatic pattern, glass panels and live signals

The page now fetches today's capacity and the real weekend count; the hero
renders the live badge, the social-proof chip (hidden when null) and the
3-step booking card.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: E2E — selectores del CTA y spec nuevo del hero

El CTA del hero pasa de "Continuar"/"Continue" a "Reservar mi pase ahora"/"Book my pass now". Es un cambio de comportamiento visible (copy pedida), así que los tres specs que lo pulsan se actualizan con role + nombre accesible (skill e2e-selector-coupling: no se vuelve al texto viejo). Comprobación previa de acoplamiento:

```bash
grep -rn "continuar\|continue" e2e/
```

Expected: exactamente 3 apariciones del link del hero (`booking.spec.ts`, `landing.spec.ts`, `i18n.spec.ts`).

**Files:**
- Modify: `e2e/booking.spec.ts` (función `openBooking`)
- Modify: `e2e/landing.spec.ts`
- Modify: `e2e/i18n.spec.ts`
- Create: `e2e/hero.spec.ts`

- [ ] **Step 1: Actualizar `e2e/booking.spec.ts`**

Reemplaza:

```ts
  // The hero "Continuar" opens /reservar directly in the payment view (pay=1).
  await page.getByRole('link', { name: /continuar/i }).click();
```

por:

```ts
  // The hero CTA opens /reservar directly in the payment view (pay=1).
  await page.getByRole('link', { name: /reservar mi pase ahora/i }).click();
```

- [ ] **Step 2: Actualizar `e2e/landing.spec.ts`**

Reemplaza:

```ts
  await page.getByRole('link', { name: /continuar/i }).click();
```

por:

```ts
  await page.getByRole('link', { name: /reservar mi pase ahora/i }).click();
```

- [ ] **Step 3: Actualizar `e2e/i18n.spec.ts`**

Reemplaza:

```ts
  await page.getByRole('link', { name: /continue/i }).click();
```

por:

```ts
  await page.getByRole('link', { name: /book my pass now/i }).click();
```

- [ ] **Step 4: Crear `e2e/hero.spec.ts`**

Los tests del badge cambian el override de HOY y lo restauran en `finally`. La e2e corre bajo el lock global, así que ningún otro worktree la ve; dentro de esta misma corrida, los otros specs eligen fechas a +21/+22/+23 días y no dependen del cupo de hoy. El estado "low" se cubre solo con unit tests (Tasks 1, 7, 9): forzarlo en e2e exige insertar reservas en la BD compartida.

```ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);

/** Today in Caracas as YYYY-MM-DD (the app's "today"). */
function todayCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sets today's capacity override for the duration of `fn`, then restores the previous one. */
async function withTodayCapacity(capacity: number, fn: () => Promise<void>) {
  const today = todayCaracas();
  const { data: prev } = await supabase
    .from('capacity_overrides').select('date, capacity, reason').eq('date', today).maybeSingle();
  await supabase.from('capacity_overrides').upsert({ date: today, capacity });
  try {
    await fn();
  } finally {
    if (prev) await supabase.from('capacity_overrides').upsert(prev);
    else await supabase.from('capacity_overrides').delete().eq('date', today);
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('landing hero', () => {
  test('live badge: "Agotado hoy" when today is closed', async ({ page }) => {
    await withTodayCapacity(0, async () => {
      await page.goto('/');
      const badge = page.getByTestId('today-badge');
      await expect(badge).toHaveAttribute('data-state', 'soldOut');
      await expect(badge).toContainText('Agotado hoy');
    });
  });

  test('live badge: "Piscina abierta" with a pulsing dot when there is room', async ({ page }) => {
    // Far above any real occupancy, so today's bookings can't push it under 20 %.
    await withTodayCapacity(10_000, async () => {
      await page.goto('/');
      const badge = page.getByTestId('today-badge');
      await expect(badge).toHaveAttribute('data-state', 'open');
      await expect(badge).toContainText('Piscina abierta');
      await expect(badge.locator('[data-pulse]')).toBeAttached();
    });
  });

  test('wizard: "Quedan N" under each day, then the CTA carries the choice to /reservar', async ({ page }) => {
    const DAY = addDays(todayCaracas(), 30);
    await supabase.from('reservations').delete().eq('date', DAY);
    await supabase.from('capacity_overrides').upsert({ date: DAY, capacity: 7 });
    try {
      await page.goto('/');

      // Step 1: the calendar labels every available day (no hover needed on mobile).
      await page.getByTestId('hero-step-date').click();
      await expect(page.getByText('Paso 1 de 3')).toBeVisible();
      const cell = page.locator(`td[data-day="${DAY}"]:not([data-outside])`);
      for (let i = 0; i < 3 && (await cell.count()) === 0; i++) {
        await page.getByRole('button', { name: /next month|mes siguiente/i }).click();
      }
      await expect(cell).toContainText('Quedan 7');
      await cell.getByRole('button').click();

      // Step 2: one more child.
      await page.getByRole('button', { name: /^siguiente$/i }).click();
      await page.getByRole('button', { name: 'Aumentar niños' }).click();
      await expect(page.getByTestId('hero-children-count')).toHaveText('2');

      // Step 3: back to the summary, which reflects the chosen day.
      await page.getByRole('button', { name: /ver total/i }).click();
      await expect(page.getByTestId('hero-step-date')).toContainText('Quedan 7 cupos');

      await page.getByRole('link', { name: /reservar mi pase ahora/i }).click();
      await expect(page).toHaveURL(new RegExp(`/reservar\\?date=${DAY}&adults=2&children=2&pay=1`));
    } finally {
      await supabase.from('capacity_overrides').delete().eq('date', DAY);
    }
  });
});
```

- [ ] **Step 5: Ejecutar toda la e2e (bajo lock)**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-hero
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx playwright test; rmdir "$L"
```

Expected: `8 passed` (3 booking + 1 i18n + 1 landing + 3 hero). Si falla por un puerto 3100 ocupado por un dev server viejo de otro worktree, ciérralo (`lsof -ti:3100 | xargs kill`) y repite (siempre dentro del lock).

- [ ] **Step 6: Commit**

```bash
git add e2e/booking.spec.ts e2e/landing.spec.ts e2e/i18n.spec.ts e2e/hero.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover the hero badge, "Quedan N" days and the new CTA

The hero CTA is now "Reservar mi pase ahora" / "Book my pass now"; the
three specs that open /reservar from the landing follow the new name.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Verificación final

**Files:** ninguno (solo si algo falla).

- [ ] **Step 1: Tipos**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit`
Expected: sin salida, exit 0.

- [ ] **Step 2: Lint**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Unit tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm test`
Expected: todos pasan (los de la Task 0 + los nuevos).

- [ ] **Step 4: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run build`
Expected: `✓ Compiled successfully`, rutas `/` y `/reservar` presentes (ƒ dinámicas).

- [ ] **Step 5: E2E completa (bajo lock)** — mismo comando que la Task 10, Step 5. Expected: `8 passed`.

- [ ] **Step 6: Revisión visual rápida (recomendada)**

Con el dev server de la e2e o `npm run dev -- --port 3100` (dentro del lock), abre `/` a 360 px y a 1280 px: el calendario del paso 1 no desborda la tarjeta a 360 px, los textos "Quedan N" se leen, el badge y el chip se ven sobre el vidrio, y con "Emulate prefers-reduced-motion: reduce" ni el punto pulsa ni el CTA escala. Si hay que retocar estilos, commit aparte `style(landing): …`.

- [ ] **Step 7: Estado limpio**

Run: `git status --short`
Expected: vacío (todo commiteado). No hacer push ni abrir PR.

---

## Desviaciones y preguntas abiertas

1. **Specs e2e compartidos:** se cambia una línea en `e2e/booking.spec.ts` (`openBooking`), `e2e/landing.spec.ts` y `e2e/i18n.spec.ts` (nombre del CTA). No figuran en la tabla de propiedad, pero el PR 06 probablemente toque `booking.spec.ts` (`fillPaymentStep`); el conflicto, si aparece, es de una línea y en otra función.
2. **Límite de 20 en total:** el hero aplica 1–20 personas en total (requisito de Gemini). `bookingSchema` y `/reservar` permiten hasta 20 + 20. No se cambia el schema (fuera del alcance de este PR); conviene decidir si el servidor/`/reservar` (PR 06) deben adoptar el mismo tope.
3. **"Quedan N" en `/reservar`:** sin `defaultCapacity`, `/reservar` solo etiqueta los días con reservas u override. Para etiquetar todos, el PR 06 puede pasar `defaultCapacity` (p. ej. `getTodayCapacity().dailyCapacity`) a `DatePickerPanel`; no se toca `booking-card.tsx` aquí.
4. **Touch target del calendario:** celdas de 36 px por debajo de 640 px (7 columnas + chrome no caben a 44 px en 360 px); 44 px desde `sm`. El resto de controles nuevos cumple ≥ 44 px.
5. **Estado "low" del badge:** cubierto con unit tests (umbral exacto 20 %); en e2e solo "soldOut" y "open", porque forzar "low" requiere insertar reservas reales en la BD compartida.
6. **Colores verde/ámbar:** no existen tokens en `globals.css` (archivo fuera de la propiedad de este PR); se usan `emerald-400`/`amber-400` de Tailwind, sin hex sueltos.
7. **CTA:** coral sólido (`bg-primary` = `--coral`) en lugar de degradado, y la flecha "→" como icono `ArrowRight`.
8. **`booking` namespace:** `CountRow` sigue leyendo `t.booking.decrease/increase` (solo lectura; si el PR 06 los renombra, `tsc` lo detecta).
