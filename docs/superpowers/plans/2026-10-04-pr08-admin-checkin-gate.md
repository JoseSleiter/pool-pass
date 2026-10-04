# PR 08 — Pantalla de puerta para check-in (`/admin/checkin/[id]`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/admin/checkin/[id]` (la URL que abre la cámara del teléfono del operador al escanear el QR del voucher) en una vista de puerta a pantalla completa, de altísimo contraste para uso a pleno sol, con cuatro estados (válida / otra fecha / ya ingresó / no válida) más un estado de éxito, y un botón de 60 px "Registrar entrada".

**Architecture:** La lógica de clasificación sale de `checkin-card.tsx` a un módulo puro nuevo `checkin-state.ts` (`classifyCheckin`, textos de motivo y formateadores de fecha/hora en Caracas), probado en entorno `node`. `CheckinCard` pasa a ser la vista completa (fondo de color a sangre, icono + texto por estado, datos del titular, botón, éxito, háptica, animación sólo con `motion-safe`). `page.tsx` conserva `requireAdmin()` + validación de UUID y delega también el caso "no encontrada" a `CheckinCard` (recibe `reservation: null`).

**Tech Stack:** Next.js 16 App Router (server component + client component), React 19, TypeScript, Tailwind v4 (paleta por defecto + tokens de `globals.css`), shadcn `Button` sobre base-ui, lucide-react 1.23, Vitest + Testing Library + user-event.

---

## Contexto y reglas (léelo antes de empezar)

- **Worktree:** `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-checkin-gate` (rama `feat/admin-checkin-gate`, basada en `develop`). Todos los comandos se ejecutan desde ahí. No crees worktree, no hagas push, no abras PR.
- **Node:** el Node por defecto es v16. TODO comando npm/npx va prefijado con `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null &&`.
- **Supabase local** ya corre y es compartido: prohibido `supabase start/stop/db reset/migration`. Este PR no necesita migraciones ni tests de integración.
- **Propiedad de archivos (ola 2):** este PR posee `src/components/admin/checkin-card.tsx` (+test) y `src/app/admin/checkin/[id]/page.tsx`. Crea además archivos NUEVOS dentro de ese ámbito (`checkin-state.ts` + test, `page.test.tsx`). No toques `src/lib/dates.ts`, `globals.css`, `layout.tsx` ni el shell del admin (PR 07).
- **Admin = español en duro**, sin diccionario i18n.
- **Zona horaria:** siempre `America/Caracas` mediante los helpers de `src/lib/dates.ts` (`caracasTime`, `todayCaracas`).
- **Etiqueta del botón:** "Registrar entrada" (roadmap §2 gana sobre "Aprobar Ingreso" del gemini md2 y sobre "REGISTRAR ENTRADA" en mayúsculas del md1).
- **Commits:** Conventional Commits, terminando con línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Lógica de clasificación (se conserva la actual)

Orden actual en `checkin-card.tsx`: `checked_in` → ya ingresó; cualquier estado ≠ `confirmed` → no válida; fecha ≠ hoy → otra fecha; si no → válida. Se mantiene idéntico, sólo se añade el caso `null` (no encontrada) y el motivo concreto de "no válida" (`pending` / `failed` / `expired`).

### Colores por estado y contraste (WCAG 2.x)

Los colores de la paleta Tailwind v4 están definidos en OKLCH; se convirtieron a sRGB (recortado a gama) y se calculó la razón de contraste con la fórmula WCAG de luminancia relativa. Los paneles internos (`bg-black/25` o `bg-white/40`) se mezclaron en sRGB sobre el fondo, como hace el navegador. Todo el texto queda por encima de AAA (7:1) excepto el verde válido, que queda en 7.09:1 (AAA justo); el resto supera holgadamente AA (4.5:1) incluso para texto pequeño.

| Estado | Fondo | Texto | Contraste texto/fondo | Panel interno | Contraste texto/panel |
|---|---|---|---|---|---|
| Válida | `green-800` ≈ `#016630` | blanco | **7.09:1** | `bg-black/25` | 10.08:1 |
| Éxito (entrada registrada) | `green-900` ≈ `#0d542b` | blanco | **9.07:1** | `bg-black/25` | 12.05:1 |
| Otra fecha | `amber-400` ≈ `#ffb900` | `navy-deep` `#081b33` (token) | **10.07:1** | `bg-white/40` | 12.34:1 |
| Ya ingresó | `red-800` ≈ `#9f0712` | blanco | **8.37:1** | `bg-black/25` | 11.58:1 |
| No válida | `red-900` ≈ `#82181a` | blanco | **10.06:1** | `bg-black/25` | 13.07:1 |

Otros pares:
- Botón "Registrar entrada": fondo blanco, texto `green-900` → **9.07:1**; borde del botón contra el fondo `green-800` → 7.09:1 (≥ 3:1 exigido a componentes no textuales).
- Mensaje de error dentro del estado válido: fondo blanco, texto `red-900` → **10.06:1**.
- Descartado: blanco sobre `amber-400` (1.72:1) — por eso el ámbar usa texto `navy-deep`.
- En estado de carga el botón usa `disabled:opacity-100` para no perder contraste (la variante por defecto aplica `opacity-50`).

Nunca se usa color solo: cada estado tiene icono distinto (`CircleCheckBig`, `CalendarX2`, `OctagonX`, `CircleX`) + titular en texto + `data-state`.

### Comportamiento de háptica

`navigator.vibrate` no existe en iOS Safari ni en escritorio, y Chrome ignora la llamada sin activación de usuario previa. Por eso se protege con `typeof … === 'function'` + `try/catch`. Patrones (ms): válida `80`; éxito `[60, 40, 60]`; otra fecha `[150, 100, 150]`; ya ingresó / no válida `[400, 120, 400]`; error al registrar `[200, 80, 200]`. La vibración al montar la página probablemente sea ignorada por Chrome (la navegación vino de la cámara, sin gesto en la página); la del éxito/error tras pulsar el botón sí funciona.

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/admin/checkin-state.ts` | Crear | Lógica pura: `classifyCheckin`, `INVALID_REASON_TEXT`, `caracasTime12`, `reservationDateEs`. |
| `src/components/admin/checkin-state.test.ts` | Crear | Tests unitarios (entorno node) de lo anterior. |
| `src/components/admin/checkin-card.tsx` | Reescribir | Vista de puerta a pantalla completa (client component). |
| `src/components/admin/checkin-card.test.tsx` | Reescribir | Tests de cada estado, flujo del botón, háptica y movimiento reducido. |
| `src/app/admin/checkin/[id]/page.tsx` | Modificar | Mantiene `requireAdmin` + UUID; layout a sangre; delega "no encontrada" al card; metadata. |
| `src/app/admin/checkin/[id]/page.test.tsx` | Crear | Tests del server component con módulos mockeados. |

---

### Task 0: Preparar el entorno

**Files:** ninguno.

- [ ] **Step 1: Verificar rama y dependencias**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-checkin-gate
git branch --show-current
[ -d node_modules ] || (source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci)
```

Expected: imprime `feat/admin-checkin-gate`; si no había `node_modules`, `npm ci` termina sin errores (al escribir este plan el worktree NO tenía `node_modules`).

- [ ] **Step 2: Línea base de tests**

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-card.test.tsx
```

Expected: PASS (7 tests del card actual).

---

### Task 1: `classifyCheckin` puro + textos de motivo

**Files:**
- Create: `src/components/admin/checkin-state.ts`
- Test: `src/components/admin/checkin-state.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/admin/checkin-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyCheckin, INVALID_REASON_TEXT } from './checkin-state';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

describe('classifyCheckin', () => {
  it('confirmed reservation for today is valid', () => {
    expect(classifyCheckin(row(), TODAY)).toEqual({ kind: 'valid' });
  });

  it('confirmed reservation for another date is wrong-date and carries the real date', () => {
    expect(classifyCheckin(row({ date: '2030-01-20' }), TODAY)).toEqual({
      kind: 'wrong-date',
      date: '2030-01-20',
    });
  });

  it('checked-in reservation is already-in with its timestamp', () => {
    expect(
      classifyCheckin(row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' }), TODAY)
    ).toEqual({ kind: 'already-in', checkedInAt: '2030-01-15T14:00:00Z' });
  });

  it('already-in wins over wrong date', () => {
    expect(
      classifyCheckin(
        row({ status: 'checked_in', date: '2030-01-20', checked_in_at: '2030-01-20T14:00:00Z' }),
        TODAY
      )
    ).toEqual({ kind: 'already-in', checkedInAt: '2030-01-20T14:00:00Z' });
  });

  it('checked-in without timestamp keeps checkedInAt null', () => {
    expect(classifyCheckin(row({ status: 'checked_in' }), TODAY)).toEqual({
      kind: 'already-in',
      checkedInAt: null,
    });
  });

  it('missing reservation is invalid/not-found', () => {
    expect(classifyCheckin(null, TODAY)).toEqual({ kind: 'invalid', reason: 'not-found' });
  });

  it.each([
    ['pending_payment', 'pending'],
    ['failed', 'failed'],
    ['expired', 'expired'],
  ] as const)('status %s is invalid with reason %s (even on another date)', (status, reason) => {
    expect(classifyCheckin(row({ status }), TODAY)).toEqual({ kind: 'invalid', reason });
    expect(classifyCheckin(row({ status, date: '2030-01-20' }), TODAY)).toEqual({ kind: 'invalid', reason });
  });
});

describe('INVALID_REASON_TEXT', () => {
  it('has a distinct, non-empty line for every reason', () => {
    const lines = Object.values(INVALID_REASON_TEXT);
    expect(lines).toHaveLength(4);
    expect(new Set(lines).size).toBe(4);
    lines.forEach((l) => expect(l.length).toBeGreaterThan(10));
  });

  it('pending payment is called out explicitly', () => {
    expect(INVALID_REASON_TEXT.pending).toMatch(/^Pago pendiente/);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-state.test.ts`
Expected: FAIL — `Failed to resolve import "./checkin-state"`.

- [ ] **Step 3: Implementación mínima**

Crear `src/components/admin/checkin-state.ts`:

```ts
import type { ReservationRow } from '@/lib/db/reservations';

export type InvalidReason = 'not-found' | 'pending' | 'failed' | 'expired';

export type CheckinState =
  | { kind: 'valid' }
  | { kind: 'wrong-date'; date: string }
  | { kind: 'already-in'; checkedInAt: string | null }
  | { kind: 'invalid'; reason: InvalidReason };

/**
 * Gate verdict for a scanned reservation. Order matters: a ticket that was
 * already used is reported as such even if its date is also wrong, and any
 * non-confirmed status is invalid regardless of date.
 */
export function classifyCheckin(r: ReservationRow | null, today: string): CheckinState {
  if (!r) return { kind: 'invalid', reason: 'not-found' };
  if (r.status === 'checked_in') return { kind: 'already-in', checkedInAt: r.checked_in_at };
  if (r.status === 'pending_payment') return { kind: 'invalid', reason: 'pending' };
  if (r.status === 'failed') return { kind: 'invalid', reason: 'failed' };
  if (r.status === 'expired') return { kind: 'invalid', reason: 'expired' };
  if (r.date !== today) return { kind: 'wrong-date', date: r.date };
  return { kind: 'valid' };
}

/** Reason line under "Reserva no encontrada o no válida". */
export const INVALID_REASON_TEXT: Record<InvalidReason, string> = {
  'not-found': 'Este código QR no corresponde a ninguna reserva.',
  pending: 'Pago pendiente de verificación: la reserva aún no está confirmada.',
  failed: 'El pago fue rechazado: la reserva no está confirmada.',
  expired: 'La reserva expiró sin completar el pago.',
};
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-state.test.ts`
Expected: PASS (todos los tests de `classifyCheckin` e `INVALID_REASON_TEXT`).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/checkin-state.ts src/components/admin/checkin-state.test.ts
git commit -m "$(cat <<'EOF'
refactor(admin): extract pure classifyCheckin for the gate view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Formateadores de hora (12 h) y fecha larga en Caracas

**Files:**
- Modify: `src/components/admin/checkin-state.ts`
- Test: `src/components/admin/checkin-state.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/components/admin/checkin-state.test.ts`, reemplazar la línea de import

```ts
import { classifyCheckin, INVALID_REASON_TEXT } from './checkin-state';
```

por

```ts
import { classifyCheckin, INVALID_REASON_TEXT, caracasTime12, reservationDateEs } from './checkin-state';
```

y añadir al final del archivo:

```ts
describe('caracasTime12', () => {
  it.each([
    ['2030-01-15T14:00:00Z', '10:00 a. m.'], // UTC-4
    ['2030-01-15T23:05:00Z', '7:05 p. m.'],
    ['2030-01-15T16:30:00Z', '12:30 p. m.'], // noon is p. m.
    ['2030-01-15T04:15:00Z', '12:15 a. m.'], // midnight is 12, not 0
  ])('%s → %s', (iso, expected) => {
    expect(caracasTime12(iso)).toBe(expected);
  });
});

describe('reservationDateEs', () => {
  it('long Spanish date with weekday and year', () => {
    expect(reservationDateEs('2030-01-20')).toBe('domingo, 20 de enero de 2030');
  });

  it('does not shift the day near year end', () => {
    expect(reservationDateEs('2030-12-31')).toBe('martes, 31 de diciembre de 2030');
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-state.test.ts`
Expected: FAIL — `caracasTime12 is not a function` / `reservationDateEs is not a function`.

- [ ] **Step 3: Implementación mínima**

En `src/components/admin/checkin-state.ts`, reemplazar la primera línea

```ts
import type { ReservationRow } from '@/lib/db/reservations';
```

por

```ts
import { caracasTime } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';
```

y añadir al final del archivo:

```ts
/**
 * "10:00 a. m." — 12h clock in Caracas. Built on caracasTime (h23) instead of
 * Intl hour12 output, whose spacing/period glyphs vary across ICU versions.
 */
export function caracasTime12(iso: string): string {
  const [hh, mm] = caracasTime(iso).split(':');
  const h = Number(hh);
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "domingo, 20 de enero de 2030" — includes the year so an old ticket is obvious. */
export function reservationDateEs(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00-04:00`));
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/checkin-state.ts src/components/admin/checkin-state.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add Caracas 12h time and long date formatters for the gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Vista de puerta a pantalla completa (estados + flujo del botón)

**Files:**
- Modify (reescritura completa): `src/components/admin/checkin-card.tsx`
- Test (reescritura completa): `src/components/admin/checkin-card.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar TODO el contenido de `src/components/admin/checkin-card.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckinCard } from './checkin-card';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: ID, code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

const okAction = () => vi.fn(async () => ({ ok: true }));
const gate = () => screen.getByTestId('gate');
const title = () => screen.getByRole('heading', { level: 1 });
const registerButton = () => screen.queryByRole('button', { name: 'Registrar entrada' });

describe('CheckinCard — states', () => {
  it('valid: green gate with guest data and the 60px "Registrar entrada" button', () => {
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'valid');
    expect(gate()).toHaveClass('bg-green-800', 'text-white');
    expect(title()).toHaveTextContent('Reserva válida para hoy');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('V-12345678')).toBeInTheDocument();
    expect(screen.getByTestId('gate-adults')).toHaveTextContent('2');
    expect(screen.getByTestId('gate-children')).toHaveTextContent('1');
    const btn = registerButton();
    expect(btn).toBeEnabled();
    expect(btn).toHaveClass('h-[60px]', 'w-full');
  });

  it('valid: child-only booking shows 0 adults and the children count', () => {
    render(<CheckinCard reservation={row({ adults: 0, children: 2 })} today={TODAY} onCheckIn={okAction()} />);
    expect(screen.getByTestId('gate-adults')).toHaveTextContent('0');
    expect(screen.getByTestId('gate-children')).toHaveTextContent('2');
  });

  it('wrong date: amber gate with the real date in long Spanish and no button', () => {
    render(<CheckinCard reservation={row({ date: '2030-01-20' })} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'wrong-date');
    expect(gate()).toHaveClass('bg-amber-400', 'text-navy-deep');
    expect(title()).toHaveTextContent('Reserva para otra fecha');
    expect(screen.getByText('Fecha de la reserva: domingo, 20 de enero de 2030')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(registerButton()).toBeNull();
  });

  it('already in: red gate with the entry time in Caracas 12h and no button', () => {
    render(
      <CheckinCard
        reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' })}
        today={TODAY}
        onCheckIn={okAction()}
      />
    );
    expect(gate()).toHaveAttribute('data-state', 'already-in');
    expect(gate()).toHaveClass('bg-red-800', 'text-white');
    // 14:00 UTC = 10:00 a. m. in America/Caracas (UTC-4)
    expect(title()).toHaveTextContent('Entrada ya registrada a las 10:00 a. m.');
    expect(registerButton()).toBeNull();
  });

  it('already in without timestamp still reads as already registered', () => {
    render(<CheckinCard reservation={row({ status: 'checked_in' })} today={TODAY} onCheckIn={okAction()} />);
    expect(title()).toHaveTextContent(/^Entrada ya registrada$/);
  });

  it('already in wins over wrong date', () => {
    render(
      <CheckinCard
        reservation={row({ status: 'checked_in', date: '2030-01-20', checked_in_at: '2030-01-20T14:00:00Z' })}
        today={TODAY}
        onCheckIn={okAction()}
      />
    );
    expect(gate()).toHaveAttribute('data-state', 'already-in');
    expect(registerButton()).toBeNull();
  });

  it('pending payment: red invalid gate with a pending-payment reason line', () => {
    render(<CheckinCard reservation={row({ status: 'pending_payment' })} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'invalid');
    expect(gate()).toHaveClass('bg-red-900', 'text-white');
    expect(title()).toHaveTextContent('Reserva no encontrada o no válida');
    expect(screen.getByText(/^Pago pendiente de verificación/)).toBeInTheDocument();
    expect(registerButton()).toBeNull();
  });

  it.each([
    ['failed', /pago fue rechazado/i],
    ['expired', /expiró sin completar el pago/i],
  ] as const)('status %s: invalid gate with its own reason', (status, reason) => {
    render(<CheckinCard reservation={row({ status })} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText(/pago pendiente/i)).toBeNull();
  });

  it('not found: invalid gate, no guest details, placeholder code', () => {
    render(<CheckinCard reservation={null} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'invalid');
    expect(title()).toHaveTextContent('Reserva no encontrada o no válida');
    expect(screen.getByText(/no corresponde a ninguna reserva/i)).toBeInTheDocument();
    expect(screen.queryByTestId('gate-details')).toBeNull();
    expect(screen.getByTestId('gate-code')).toHaveTextContent('Sin código');
  });

  it.each([
    ['valid', row()],
    ['wrong-date', row({ date: '2030-01-20' })],
    ['already-in', row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' })],
    ['invalid', row({ status: 'expired' })],
  ] as const)('%s: back link, reservation code and a state icon are always visible', (_state, r) => {
    render(<CheckinCard reservation={r} today={TODAY} onCheckIn={okAction()} />);
    expect(screen.getByRole('link', { name: /volver al panel/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByTestId('gate-code')).toHaveTextContent('PP-AAAAA');
    expect(screen.getByTestId('gate-icon').tagName.toLowerCase()).toBe('svg');
  });
});

describe('CheckinCard — register flow', () => {
  it('success: calls the action, shows the entry time in Caracas and hides the button', async () => {
    const onCheckIn = okAction();
    render(
      <CheckinCard
        reservation={row()}
        today={TODAY}
        onCheckIn={onCheckIn}
        now={() => new Date('2030-01-15T14:05:00Z')}
      />
    );
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' })).toBeInTheDocument();
    expect(onCheckIn).toHaveBeenCalledWith(ID);
    expect(gate()).toHaveAttribute('data-state', 'success');
    expect(gate()).toHaveClass('bg-green-900');
    expect(screen.getByText('Hora de entrada: 10:05 a. m.')).toBeInTheDocument();
    expect(registerButton()).toBeNull();
    expect(screen.getByRole('link', { name: /volver al panel/i })).toBeInTheDocument();
    expect(screen.getByTestId('gate-code')).toHaveTextContent('PP-AAAAA');
  });

  it('loading: button shows "Registrando…", is disabled and cannot fire twice', async () => {
    let resolve!: (v: { ok: boolean }) => void;
    const onCheckIn = vi.fn(() => new Promise<{ ok: boolean }>((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await user.click(registerButton()!);
    const busy = screen.getByRole('button', { name: /registrando/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy);
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' })).toBeInTheDocument();
  });

  it('failure: shows the returned message and lets the operator retry', async () => {
    const onCheckIn = vi.fn(async () => ({ ok: false, message: 'La reserva no está en estado confirmado.' }));
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent('La reserva no está en estado confirmado.');
    expect(gate()).toHaveAttribute('data-state', 'valid');
    expect(registerButton()).toBeEnabled();
  });

  it('failure without message uses a generic one', async () => {
    const onCheckIn = vi.fn(async () => ({ ok: false }));
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar la entrada.');
  });

  it('thrown action (network/server error) shows a connection hint and re-enables the button', async () => {
    const onCheckIn = vi.fn(async () => { throw new Error('fetch failed'); });
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/revisa la conexión/i);
    expect(registerButton()).toBeEnabled();
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-card.test.tsx`
Expected: FAIL — p. ej. `Unable to find an element by: [data-testid="gate"]` (el card actual usa `data-testid="banner"`) y errores de TS/props para `reservation={null}` y `now`.

- [ ] **Step 3: Implementación**

Reemplazar TODO el contenido de `src/components/admin/checkin-card.tsx` por:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarX2,
  CircleCheckBig,
  CircleX,
  LoaderCircle,
  OctagonX,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReservationRow } from '@/lib/db/reservations';
import {
  INVALID_REASON_TEXT,
  caracasTime12,
  classifyCheckin,
  reservationDateEs,
  type CheckinState,
} from './checkin-state';

type View = CheckinState['kind'] | 'success';

interface Tone {
  /** Full-bleed background + text color of the whole gate view. */
  surface: string;
  /** Inner panels (code chip, guest data); they never lower text contrast. */
  panel: string;
  icon: LucideIcon;
}

// WCAG 2.x contrast, Tailwind v4 OKLCH palette converted to sRGB
// (details in docs/superpowers/plans/2026-10-04-pr08-admin-checkin-gate.md):
//   valid      white on green-800 #016630      7.09:1 · panel black/25 10.08:1
//   success    white on green-900 #0d542b      9.07:1 · panel black/25 12.05:1
//   wrong-date navy-deep on amber-400 #ffb900 10.07:1 · panel white/40 12.34:1
//   already-in white on red-800 #9f0712        8.37:1 · panel black/25 11.58:1
//   invalid    white on red-900 #82181a       10.06:1 · panel black/25 13.07:1
//   button     green-900 on white              9.07:1
const TONE: Record<View, Tone> = {
  valid: { surface: 'bg-green-800 text-white', panel: 'bg-black/25', icon: CircleCheckBig },
  success: { surface: 'bg-green-900 text-white', panel: 'bg-black/25', icon: CircleCheckBig },
  'wrong-date': { surface: 'bg-amber-400 text-navy-deep', panel: 'bg-white/40', icon: CalendarX2 },
  'already-in': { surface: 'bg-red-800 text-white', panel: 'bg-black/25', icon: OctagonX },
  invalid: { surface: 'bg-red-900 text-white', panel: 'bg-black/25', icon: CircleX },
};

function copy(state: CheckinState, enteredAt: string | null): { title: string; detail: string | null } {
  if (enteredAt) {
    return { title: 'Entrada registrada', detail: `Hora de entrada: ${caracasTime12(enteredAt)}` };
  }
  switch (state.kind) {
    case 'valid':
      return { title: 'Reserva válida para hoy', detail: null };
    case 'wrong-date':
      return {
        title: 'Reserva para otra fecha',
        detail: `Fecha de la reserva: ${reservationDateEs(state.date)}`,
      };
    case 'already-in':
      return {
        title: state.checkedInAt
          ? `Entrada ya registrada a las ${caracasTime12(state.checkedInAt)}`
          : 'Entrada ya registrada',
        detail: null,
      };
    case 'invalid':
      return { title: 'Reserva no encontrada o no válida', detail: INVALID_REASON_TEXT[state.reason] };
  }
}

/**
 * Full-screen gate view opened by the operator's phone camera from the voucher
 * QR. Designed for outdoor sunlight: full-bleed state color, huge type, icon +
 * text per state (never color alone).
 */
export function CheckinCard({
  reservation,
  today,
  onCheckIn,
  now = () => new Date(),
}: {
  reservation: ReservationRow | null;
  today: string;
  onCheckIn: (id: string) => Promise<{ ok: boolean; message?: string }>;
  /** Clock for the success timestamp; injectable for tests. */
  now?: () => Date;
}) {
  const state = classifyCheckin(reservation, today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enteredAt, setEnteredAt] = useState<string | null>(null);

  const view: View = enteredAt ? 'success' : state.kind;
  const tone = TONE[view];
  const Icon = tone.icon;
  const { title, detail } = copy(state, enteredAt);

  async function register() {
    if (!reservation || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onCheckIn(reservation.id);
      if (!res.ok) {
        setError(res.message ?? 'No se pudo registrar la entrada.');
        return;
      }
      setEnteredAt(now().toISOString());
    } catch {
      setError('No se pudo registrar la entrada. Revisa la conexión e intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="gate"
      data-state={view}
      aria-labelledby="gate-title"
      className={cn('flex min-h-dvh flex-1 flex-col', tone.surface)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-lg font-semibold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-current"
        >
          <ArrowLeft aria-hidden className="size-6" />
          Volver al panel
        </Link>
        <p
          data-testid="gate-code"
          className={cn('rounded-lg px-3 py-2 font-mono text-2xl font-bold tracking-wider', tone.panel)}
        >
          <span className="sr-only">Código de reserva: </span>
          {reservation?.code ?? 'Sin código'}
        </p>
      </header>

      <div
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center"
      >
        <Icon data-testid="gate-icon" aria-hidden className="size-24 sm:size-32" strokeWidth={2.5} />
        <h1
          id="gate-title"
          className="font-heading text-4xl leading-tight font-bold text-balance sm:text-6xl"
        >
          {title}
        </h1>
        {detail && <p className="text-2xl font-semibold text-balance sm:text-3xl">{detail}</p>}
      </div>

      {reservation && (
        <dl
          data-testid="gate-details"
          className={cn('mx-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl p-5', tone.panel)}
        >
          <div className="col-span-2">
            <dt className="text-sm font-semibold tracking-wide uppercase">Titular</dt>
            <dd className="text-3xl font-bold break-words">
              {`${reservation.first_name} ${reservation.last_name}`}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm font-semibold tracking-wide uppercase">Documento</dt>
            <dd className="font-mono text-2xl font-bold">
              {`${reservation.id_type}-${reservation.id_number}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold tracking-wide uppercase">Adultos</dt>
            <dd data-testid="gate-adults" className="text-5xl font-bold tabular-nums">
              {reservation.adults}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold tracking-wide uppercase">Niños</dt>
            <dd data-testid="gate-children" className="text-5xl font-bold tabular-nums">
              {reservation.children}
            </dd>
          </div>
        </dl>
      )}

      <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="rounded-xl bg-white p-4 text-lg font-semibold text-red-900">
            {error}
          </p>
        )}
        {view === 'valid' && (
          <Button
            type="button"
            onClick={register}
            disabled={busy}
            aria-busy={busy}
            className="h-[60px] w-full gap-3 rounded-2xl bg-white text-xl font-bold text-green-900 hover:bg-white/90 disabled:opacity-100"
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden className="size-6 motion-safe:animate-spin" />
                Registrando…
              </>
            ) : (
              'Registrar entrada'
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
```

Notas para el implementador:
- `cn` (tailwind-merge) hace que `bg-white`, `text-green-900`, `h-[60px]` y `disabled:opacity-100` reemplacen a `bg-primary`, `text-primary-foreground`, `h-8` y `disabled:opacity-50` de la variante por defecto del `Button`.
- `text-navy-deep` existe porque `globals.css` define `--color-navy-deep`.
- `page.tsx` todavía pasa `adminCheckIn` (que cumple la nueva firma) y no pasa `null`; compila igual. El cambio de la página va en la Task 5.

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-card.test.tsx src/components/admin/checkin-state.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Typecheck rápido**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/checkin-card.tsx src/components/admin/checkin-card.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): full-screen high-contrast gate view for QR check-in

Full-bleed state color, icon + text per state, guest data, 60px
"Registrar entrada" button with loading/error/success states.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Háptica (`navigator.vibrate`) y animación respetando movimiento reducido

**Files:**
- Modify: `src/components/admin/checkin-card.tsx`
- Test: `src/components/admin/checkin-card.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/components/admin/checkin-card.test.tsx`, reemplazar la línea

```tsx
import { describe, it, expect, vi } from 'vitest';
```

por

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
```

y añadir al final del archivo:

```tsx
describe('CheckinCard — haptics', () => {
  function stubVibrate(impl: (p: VibratePattern) => boolean = () => true) {
    const spy = vi.fn(impl);
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true, writable: true });
    return spy;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('short buzz when a valid ticket is shown', () => {
    const vibrate = stubVibrate();
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    expect(vibrate).toHaveBeenCalledWith(80);
  });

  it('long double buzz for an already-used ticket', () => {
    const vibrate = stubVibrate();
    render(
      <CheckinCard
        reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' })}
        today={TODAY}
        onCheckIn={okAction()}
      />
    );
    expect(vibrate).toHaveBeenCalledWith([400, 120, 400]);
  });

  it('success pattern after registering, error pattern after a failure', async () => {
    const vibrate = stubVibrate();
    const user = userEvent.setup();
    const { unmount } = render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    await user.click(registerButton()!);
    await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' });
    expect(vibrate).toHaveBeenLastCalledWith([60, 40, 60]);
    unmount();

    vibrate.mockClear();
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={vi.fn(async () => ({ ok: false }))} />);
    await user.click(registerButton()!);
    await screen.findByRole('alert');
    expect(vibrate).toHaveBeenLastCalledWith([200, 80, 200]);
  });

  it('works without navigator.vibrate (iOS Safari / desktop)', () => {
    expect('vibrate' in navigator).toBe(false);
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'valid');
  });

  it('a throwing navigator.vibrate never breaks the gate', () => {
    stubVibrate(() => { throw new Error('blocked'); });
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'valid');
  });
});

describe('CheckinCard — reduced motion', () => {
  it('state entrance animates only under motion-safe and no animation is unconditional', () => {
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    expect(screen.getByRole('status').className).toMatch(/\bmotion-safe:animate-in\b/);
    const tokens = Array.from(document.querySelectorAll('[class]')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/)
    );
    expect(tokens.filter((t) => /^animate-/.test(t))).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-card.test.tsx`
Expected: FAIL en `short buzz…`, `long double buzz…`, `success pattern…` (`expected "spy" to be called with arguments`) y en `reduced motion` (la clase no contiene `motion-safe:animate-in`). Los tests "works without…" y "a throwing…" ya pasan.

- [ ] **Step 3: Implementación**

En `src/components/admin/checkin-card.tsx`:

(a) Reemplazar

```tsx
import { useState } from 'react';
```

por

```tsx
import { useEffect, useState } from 'react';
```

(b) Reemplazar

```tsx
function copy(state: CheckinState, enteredAt: string | null): { title: string; detail: string | null } {
```

por

```tsx
// Vibration patterns (ms): distinct rhythms so the operator can tell states apart without looking.
const HAPTIC: Record<View, number | number[]> = {
  valid: 80,
  success: [60, 40, 60],
  'wrong-date': [150, 100, 150],
  'already-in': [400, 120, 400],
  invalid: [400, 120, 400],
};
const HAPTIC_ERROR = [200, 80, 200];

/**
 * navigator.vibrate is missing on iOS Safari and desktop, and browsers may
 * ignore or reject it without prior user activation (e.g. on page load right
 * after the camera opened the URL).
 */
function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are a nicety; never break the gate over them.
  }
}

function copy(state: CheckinState, enteredAt: string | null): { title: string; detail: string | null } {
```

(c) Reemplazar

```tsx
  const { title, detail } = copy(state, enteredAt);

  async function register() {
```

por

```tsx
  const { title, detail } = copy(state, enteredAt);

  useEffect(() => {
    buzz(HAPTIC[view]);
  }, [view]);

  async function register() {
```

(d) Reemplazar

```tsx
      if (!res.ok) {
        setError(res.message ?? 'No se pudo registrar la entrada.');
        return;
      }
      setEnteredAt(now().toISOString());
    } catch {
      setError('No se pudo registrar la entrada. Revisa la conexión e intenta de nuevo.');
    } finally {
```

por

```tsx
      if (!res.ok) {
        buzz(HAPTIC_ERROR);
        setError(res.message ?? 'No se pudo registrar la entrada.');
        return;
      }
      setEnteredAt(now().toISOString());
    } catch {
      buzz(HAPTIC_ERROR);
      setError('No se pudo registrar la entrada. Revisa la conexión e intenta de nuevo.');
    } finally {
```

(e) Reemplazar

```tsx
      <div
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center"
      >
```

por

```tsx
      <div
        key={view}
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300"
      >
```

(`key={view}` remonta el bloque al pasar a éxito para que la entrada se anime de nuevo; con `prefers-reduced-motion: reduce` no hay animación alguna. `tw-animate-css` ya está importado en `globals.css`.)

- [ ] **Step 4: Ejecutar los tests y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/checkin-card.test.tsx`
Expected: PASS (todos, incluidos los de la Task 3).

- [ ] **Step 5: Lint del archivo**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx eslint src/components/admin/checkin-card.tsx src/components/admin/checkin-card.test.tsx src/components/admin/checkin-state.ts`
Expected: sin errores (el efecto no llama a `setState`, así que la regla `react-hooks/set-state-in-effect` no aplica).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/checkin-card.tsx src/components/admin/checkin-card.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): haptic feedback and motion-safe entrance on the gate view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Página `/admin/checkin/[id]` a sangre (mantiene `requireAdmin` + UUID)

**Files:**
- Modify: `src/app/admin/checkin/[id]/page.tsx`
- Test: `src/app/admin/checkin/[id]/page.test.tsx` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/admin/checkin/[id]/page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReservationRow } from '@/lib/db/reservations';
import { todayCaracas } from '@/lib/dates';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getReservation: vi.fn(),
  adminCheckIn: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/reservations', () => ({ getReservation: mocks.getReservation }));
vi.mock('@/app/admin/actions', () => ({ adminCheckIn: mocks.adminCheckIn }));

import CheckinPage, { metadata } from './page';

const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: ID, code: 'PP-AAAAA', date: todayCaracas(),
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

async function renderPage(id: string) {
  render(await CheckinPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'admin@example.com', role: 'owner' });
});

describe('/admin/checkin/[id]', () => {
  it('re-verifies the admin and never reads PII when that fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(CheckinPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow('Unauthorized');
    expect(mocks.getReservation).not.toHaveBeenCalled();
  });

  it('a non-UUID id never hits the database and shows the invalid gate', async () => {
    await renderPage('not-a-uuid');
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getReservation).not.toHaveBeenCalled();
    expect(screen.getByTestId('gate')).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reserva no encontrada o no válida');
  });

  it('a lookup error renders the invalid gate instead of crashing', async () => {
    mocks.getReservation.mockRejectedValue(new Error('db down'));
    await renderPage(ID);
    expect(mocks.getReservation).toHaveBeenCalledWith(ID);
    expect(screen.getByTestId('gate')).toHaveAttribute('data-state', 'invalid');
  });

  it('a confirmed reservation for today renders the valid gate full-bleed', async () => {
    mocks.getReservation.mockResolvedValue(row());
    await renderPage(ID);
    expect(screen.getByTestId('gate')).toHaveAttribute('data-state', 'valid');
    expect(screen.getByRole('main')).toHaveClass('min-h-dvh');
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeInTheDocument();
  });

  it('is not indexable', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/checkin`
Expected: FAIL — en el caso no-UUID no existe `data-testid="gate"` (la página actual pinta su propio `<p>` "Reserva no encontrada"), `main` no tiene `min-h-dvh` y `metadata` es `undefined`.

- [ ] **Step 3: Implementación**

Reemplazar TODO el contenido de `src/app/admin/checkin/[id]/page.tsx` por:

```tsx
import type { Metadata } from 'next';
import { getReservation } from '@/lib/db/reservations';
import { adminCheckIn } from '@/app/admin/actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { CheckinCard } from '@/components/admin/checkin-card';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Control de entrada',
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gate screen opened by the operator's phone camera from the voucher QR.
 * Lives outside the admin shell on purpose: the whole viewport is the verdict.
 */
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Defense in depth: this page reads customer PII via the service role, so it
  // re-verifies the admin token here instead of trusting middleware alone.
  await requireAdmin();
  const { id } = await params;
  const reservation = UUID_RE.test(id) ? await getReservation(id).catch(() => null) : null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <CheckinCard reservation={reservation} today={todayCaracas()} onCheckIn={adminCheckIn} />
    </main>
  );
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/checkin src/components/admin`
Expected: PASS (página + card + state + el resto de tests de `src/components/admin`, p. ej. `checkin-dialog.test.tsx`, sin cambios).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/checkin/[id]/page.tsx" "src/app/admin/checkin/[id]/page.test.tsx"
git commit -m "$(cat <<'EOF'
feat(admin): render the check-in page as a full-bleed gate screen

Keeps requireAdmin + UUID validation; not-found now uses the gate's
invalid state. Adds noindex metadata.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificación final y prueba visual

**Files:** ninguno (sólo verificación; si algo falla, corregir en el archivo correspondiente y hacer commit `fix(admin): …`).

- [ ] **Step 1: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit`
Expected: sin salida (exit 0).

- [ ] **Step 2: Lint**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run lint`
Expected: exit 0, sin errores.

- [ ] **Step 3: Tests unitarios completos**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm test`
Expected: todos PASS.

- [ ] **Step 4: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run build`
Expected: build OK; la ruta `ƒ /admin/checkin/[id]` aparece como dinámica.

- [ ] **Step 5: E2E — no aplica**

Este PR no toca landing ni `/reservar`, y no hay spec e2e de check-in (`e2e/` sólo tiene `booking`, `i18n`, `landing`). No ejecutar `npm run test:e2e`.

- [ ] **Step 6: Prueba visual manual (recomendada)**

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx next dev -p 3108
```

Iniciar sesión en `http://localhost:3108/admin/login` con un email de `ADMIN_EMAILS`, copiar el `id` de una reserva desde el panel (o de la URL del QR de un voucher) y abrir `http://localhost:3108/admin/checkin/<id>` en DevTools con viewport 390×844. Comprobar:
- Cada estado ocupa toda la pantalla con su color, icono y titular; enlace "Volver al panel" y código visibles arriba.
- Botón de 60 px de alto a todo el ancho; al pulsar pasa a "Registrando…" y luego a "Entrada registrada · Hora de entrada: h:mm a. m./p. m.".
- `/admin/checkin/no-uuid` muestra "Reserva no encontrada o no válida".
- En DevTools > Rendering > "Emulate CSS prefers-reduced-motion: reduce" no hay animación de entrada ni giro del spinner.
Detener el servidor (Ctrl+C) al terminar.

- [ ] **Step 7: Estado final**

Run: `git status --short && git log --oneline develop..HEAD`
Expected: árbol limpio; 5 commits (Tasks 1–5) más cualquier `fix` de esta task. No hacer push ni abrir PR (lo hace el coordinador).

---

## Desviaciones y preguntas abiertas

1. **Archivos nuevos fuera de la tabla de propiedad:** `src/components/admin/checkin-state.ts` (+test) y `src/app/admin/checkin/[id]/page.test.tsx`. Son nuevos, exclusivos de este PR y no chocan con otros PRs.
2. **No se toca `src/lib/dates.ts`:** el formateador de 12 h y la fecha larga con año se quedan en `checkin-state.ts` para evitar conflictos. Si PR 09 ("Ingresó XX:XX AM") necesita el mismo formato, se puede mover a `dates.ts` en un PR posterior.
3. **Formato de hora:** "10:00 a. m." (hora sin cero a la izquierda, convención es-VE) en lugar de "HH:MM" literal. Se construye a partir de `caracasTime` (h23) para no depender de los glifos de ICU.
4. **"No encontrada" sin código:** cuando el id no existe no hay código que mostrar; se muestra "Sin código". Alternativa: mostrar los primeros 8 caracteres del UUID escaneado.
5. **Datos de pago eliminados de la vista:** la tarjeta antigua mostraba "Pagado: $… / Bs. …"; en la puerta no aporta y resta tamaño a lo importante. Pregunta: ¿se quiere conservar en letra pequeña?
6. **Háptica al cargar:** Chrome Android ignora `vibrate()` sin gesto previo del usuario en la página; en la práctica sólo vibrarán éxito y error (tras pulsar el botón). iOS no la soporta.
7. **`lang` del documento:** el root layout pone `lang` según la cookie de idioma; si el operador tenía EN, la página en español quedaría con `lang="en"`. Lo resuelve PR 07 (posee `src/app/layout.tsx`); aquí no se toca.
8. **Estado éxito vs. válido:** ambos verdes (`green-800` / `green-900`) con el mismo icono; se distinguen por el titular, la hora y la desaparición del botón. Si se quiere más diferencia, cambiar el icono de éxito a `DoorOpen`.

## Self-review

- **Cobertura del alcance:** pantalla completa a sangre (Task 3 + 5); alto contraste con ratios calculados (tabla + comentario en código); VALID con nombre, documento, adultos/niños y botón 60 px "Registrar entrada" con carga/error/éxito y hora Caracas (Task 3); OTRA FECHA ámbar con fecha larga en español (Tasks 2–3); YA INGRESÓ rojo con hora 12 h a. m./p. m. (Tasks 2–3); NO VÁLIDA roja con motivo que distingue pago pendiente (Tasks 1, 3); "Volver al panel" y código siempre visibles (Task 3, test `it.each`); icono + texto (Task 3); movimiento reducido (Task 4); háptica protegida (Task 4); `requireAdmin` + UUID conservados y probados (Task 5); `classifyCheckin` puro y testeado (Task 1); `checkin-card.test.tsx` reescrito con cada estado y el flujo del botón (Tasks 3–4).
- **Placeholders:** ninguno; todos los pasos de código tienen el código completo.
- **Consistencia de nombres:** `classifyCheckin`, `CheckinState`, `InvalidReason`, `INVALID_REASON_TEXT`, `caracasTime12`, `reservationDateEs`, `View`, `TONE`, `HAPTIC`, `HAPTIC_ERROR`, `buzz`, `copy`; testids `gate`, `gate-code`, `gate-icon`, `gate-details`, `gate-adults`, `gate-children`; prop `now`. Coinciden entre tareas.
