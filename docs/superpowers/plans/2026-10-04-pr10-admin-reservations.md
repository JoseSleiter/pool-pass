# PR 10 — Admin Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva página `/admin/reservations` (estado en la URL) con buscador tipo command-bar, chips de estado, filtros avanzados en drawer, chips de filtros activos descartables, tabla ordenable (escritorio) / tarjetas (móvil), acciones por fila, drawer de detalle, paginación compartida y búsqueda global ⌘K / Ctrl+K desde el shell admin.

**Architecture:** La página es un server component: lee `searchParams` (Promise en Next 16), los normaliza con un parser tolerante (`_lib/search-params.ts`, cada valor inválido cae a su default) y luego pasa por el parser zod de PR 02 (`parseReservationQuery`) vía la acción existente `adminSearchReservations`. Toda la interacción (buscar, filtrar, ordenar, paginar) produce **enlaces/navegaciones a una nueva URL**; el servidor vuelve a renderizar. Los componentes cliente sólo guardan estado efímero (texto en escritura, diálogos abiertos, toast). Las acciones por fila reutilizan `adminResendVoucher` / `adminCheckIn` sin acciones nuevas.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript, Tailwind v4, base-ui (`@base-ui/react/dialog`), lucide-react 1.23, zod 4, Vitest 4 + Testing Library, Playwright.

---

## Entorno de ejecución (vinculante)

- Directorio de trabajo: `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations` (rama `feat/admin-reservations`, ya creada). **No** crear worktree, **no** push, **no** PR (lo hace el coordinador).
- Node por defecto es v16: **todo** `npm`/`npx` va precedido de `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null &&`.
- Supabase local compartido y corriendo: prohibido `supabase start/stop/db reset/migration`. Este PR **no** necesita migraciones (si alguna vez hiciera falta: `0010_*.sql`, idempotente, aplicada con `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f`).
- e2e / integración serializados con el lock:
  `L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"` y, dentro del lock, comprobar que nada escucha en :3100 (`lsof -nP -iTCP:3100 -sTCP:LISTEN`) antes del e2e.
- Credenciales admin locales: `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt` (formato `email: …` / `password: …`). El spec e2e las lee en runtime (variable `ADMIN_CREDENTIALS_FILE` o `supabase/.local-admin-credentials.txt` del cwd) y hace `test.skip` si no existen. Nunca se copian al repo.
- Commits: conventional, línea en blanco y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Admin = español en duro (sin diccionarios). Touch targets ≥ 44px (`ADMIN_ICON_ACTION`, `ADMIN_ACTION`, `ADMIN_INPUT`, `min-h-11`). Hora/fecha siempre `America/Caracas`. `prefers-reduced-motion` respetado (`motion-safe:` / `motion-reduce:`). Fechas largas con `first-letter:uppercase`, nunca `capitalize`.
- Las rutas con paréntesis (`(dashboard)`) van **entre comillas** en la shell. Para filtrar en Vitest usa un fragmento sin paréntesis (p. ej. `reservations/_lib/search-params`).

## Propiedad de archivos y desviaciones anotadas

Archivos que este PR crea o modifica (todos dentro de su propiedad, salvo lo anotado):

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/reservation-status.ts` | Modificar | Paleta de estados (nueva), `STATUS_ORDER`, `STATUS_NAME_ES`, hora 12h Caracas, etiqueta "Ingresó 10:15 a. m." |
| `src/lib/reservation-status.test.ts` | Crear | Unit tests de lo anterior |
| `src/components/admin/status-pill.tsx` (+test) | Crear (**archivo nuevo no listado**) | Píldora de estado compartida (tabla, tarjeta, drawer) |
| `src/components/admin/slide-over.tsx` (+test) | Crear (**archivo nuevo no listado**) | Panel lateral derecho base-ui (detalle y filtros) |
| `src/components/admin/reservation-card.tsx` (+test) | Modificar | Tarjeta móvil: píldora, fecha, "Reenviar voucher", "Verificar" |
| `src/components/admin/reservation-detail-dialog.tsx` (+test) | Modificar | Slide-over con todos los datos; fix `capitalize` |
| `src/components/admin/reservations-table.tsx` | Modificar (1 línea) | Pasar `onResend` al drawer de detalle (lista del día) |
| `src/app/admin/(dashboard)/reservations/_lib/search-params.ts` (+test) | Crear | URL ⇄ estado, query zod, hrefs, orden, chips, filtros activos |
| `src/app/admin/(dashboard)/reservations/_components/*.tsx` (+tests) | Crear | `search-box`, `filter-chips`, `filters-drawer`, `reservations-data-table`, `reservations-view` |
| `src/app/admin/(dashboard)/reservations/page.tsx` (+test) | Crear | Server page |
| `src/components/admin/command-search.tsx` (+test) | Crear | Diálogo ⌘K + botón disparador |
| `src/components/admin/admin-shell.tsx` (+test) | Modificar | Sólo montar ⌘K y sus botones |
| `src/components/admin/topbar.tsx` (+test) | Modificar | Sólo `PENDING_HREF` |
| `src/components/admin/nav-config.ts` (+test) | Modificar | Sólo `ready: true` en Reservas |
| `e2e/admin-reservations.spec.ts` | Crear | e2e con credenciales locales |

Desviaciones (para el informe del PR):
1. **No** se crea `src/app/admin/reservations-actions.ts`: no hace falta ninguna acción nueva (lectura vía `adminSearchReservations`; filas vía `adminResendVoucher`/`adminCheckIn`). `src/app/admin/actions.ts` y `src/lib/audit.ts` quedan intactos.
2. `adminCheckIn` sólo hace `revalidatePath('/admin')`; la página llama `router.refresh()` tras un check-in exitoso en lugar de tocar `actions.ts`.
3. Dos archivos nuevos fuera de la lista (`status-pill.tsx`, `slide-over.tsx`) para no meter componentes JSX en `reservation-status.ts`; ningún otro PR los toca.
4. Los helpers de hora 12h (`caracasTime12`, `caracasDateTime12`) viven en `reservation-status.ts` (de este PR) y no en `src/lib/dates.ts` (compartido) para evitar conflictos.
5. `STATUS_CHIP_CLASS` y `statusLabelEs` conservan nombre y firma (otros PRs pueden importarlos); cambian los colores y el `checked_in` pasa a 12h ("Ingresó 10:15 a. m.").
6. `admin-shell.test.tsx` y `nav-config.test.ts` cambian la lista de ítems no listos; PR 12 tocará las mismas líneas → conflicto trivial esperado al fusionar.
7. Los chips de estado **no** muestran conteos (requeriría 5 consultas extra por render). La "auditoría" en el drawer de detalle (md2 §4) queda fuera de alcance.

---

### Task 0: Preparación y baseline

**Files:** ninguno.

- [ ] **Step 1: Instalar dependencias**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci
```
Expected: termina sin errores (`added N packages`).

- [ ] **Step 2: Baseline de tests y tipos**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm test && npx tsc --noEmit
```
Expected: todos los tests PASS y `tsc` sin salida. Si algo falla en el baseline, detente y repórtalo (no es de este PR).

---

### Task 1: Paleta y etiquetas de estado (`reservation-status.ts`)

**Files:**
- Modify: `src/lib/reservation-status.ts` (archivo completo)
- Create: `src/lib/reservation-status.test.ts`

- [ ] **Step 1: Write the failing test**

Crea `src/lib/reservation-status.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  STATUS_CHIP_CLASS, STATUS_NAME_ES, STATUS_ORDER, caracasDateTime12, caracasTime12, statusLabelEs,
} from './reservation-status';

describe('caracasTime12', () => {
  it('formats Caracas time on a 12-hour clock with plain spaces', () => {
    expect(caracasTime12('2030-01-15T14:15:00Z')).toBe('10:15 a. m.');
    expect(caracasTime12('2030-01-15T20:05:00Z')).toBe('4:05 p. m.');
  });
});

describe('caracasDateTime12', () => {
  it('formats date and 12-hour time in Caracas', () => {
    expect(caracasDateTime12('2030-01-10T10:00:00Z')).toMatch(/^10 ene\.? 2030, 6:00 a\. m\.$/);
  });
});

describe('statusLabelEs', () => {
  it('shows the 12-hour entry time for checked-in reservations', () => {
    expect(statusLabelEs({ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' })).toBe('Ingresó 10:15 a. m.');
    expect(statusLabelEs({ status: 'checked_in', checked_in_at: null })).toBe('Ingresó');
  });

  it('labels the other statuses', () => {
    expect(statusLabelEs({ status: 'pending_payment', checked_in_at: null })).toBe('Pago en verificación');
    expect(statusLabelEs({ status: 'confirmed', checked_in_at: null })).toBe('Confirmada');
    expect(statusLabelEs({ status: 'failed', checked_in_at: null })).toBe('Fallida');
    expect(statusLabelEs({ status: 'expired', checked_in_at: null })).toBe('Expirada');
  });
});

describe('status palette (md2 §4)', () => {
  it('confirmed is solid emerald, checked_in a soft blue outline, pending amber, failed/expired muted gray', () => {
    expect(STATUS_CHIP_CLASS.confirmed).toContain('bg-emerald-700');
    expect(STATUS_CHIP_CLASS.confirmed).toContain('text-white');
    expect(STATUS_CHIP_CLASS.checked_in).toContain('border-sky-300');
    expect(STATUS_CHIP_CLASS.checked_in).toContain('bg-sky-50');
    expect(STATUS_CHIP_CLASS.pending_payment).toContain('bg-amber-50');
    expect(STATUS_CHIP_CLASS.failed).toContain('bg-slate-100');
    expect(STATUS_CHIP_CLASS.failed).toBe(STATUS_CHIP_CLASS.expired);
  });

  it('has one canonical order and a short name for every status', () => {
    expect(STATUS_ORDER).toEqual(['pending_payment', 'confirmed', 'checked_in', 'failed', 'expired']);
    expect(STATUS_ORDER.map((s) => STATUS_NAME_ES[s])).toEqual(['Pendiente', 'Confirmada', 'Ingresó', 'Fallida', 'Expirada']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/reservation-status`
Expected: FAIL (`caracasTime12 is not a function` / exports ausentes).

- [ ] **Step 3: Write minimal implementation**

Reemplaza **todo** `src/lib/reservation-status.ts` por:
```ts
import type { ReservationRow } from '@/lib/db/reservations';

export type ReservationStatus = ReservationRow['status'];

/** Canonical status order for filters, URLs and chips. "Canceladas" = failed + expired, last. */
export const STATUS_ORDER = [
  'pending_payment', 'confirmed', 'checked_in', 'failed', 'expired',
] as const satisfies readonly ReservationStatus[];

/** Short singular name for filter chips: "Estado: Confirmada". */
export const STATUS_NAME_ES: Record<ReservationStatus, string> = {
  pending_payment: 'Pendiente',
  confirmed: 'Confirmada',
  checked_in: 'Ingresó',
  failed: 'Fallida',
  expired: 'Expirada',
};

// ICU separates "a. m." with no-break spaces; normalize so labels are predictable.
const ANY_SPACE = /\s/g;

/** "10:15 a. m." — 12-hour time in Venezuela for an ISO timestamp. */
export function caracasTime12(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)).replace(ANY_SPACE, ' ');
}

/** "10 ene. 2030, 6:00 a. m." — Caracas date + 12-hour time (created_at, checked_in_at…). */
export function caracasDateTime12(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)).replace(ANY_SPACE, ' ');
}

export function statusLabelEs(r: Pick<ReservationRow, 'status' | 'checked_in_at'>): string {
  switch (r.status) {
    case 'checked_in': return `Ingresó ${r.checked_in_at ? caracasTime12(r.checked_in_at) : ''}`.trim();
    case 'pending_payment': return 'Pago en verificación';
    case 'confirmed': return 'Confirmada';
    case 'failed': return 'Fallida';
    case 'expired': return 'Expirada';
  }
}

/**
 * Status badge colors (md2 §4), the single source for every admin surface:
 * confirmed = solid emerald, checked_in = soft blue outline, pending = amber
 * (the pill adds a motion-safe pulse), failed/expired = muted gray.
 */
export const STATUS_CHIP_CLASS: Record<ReservationStatus, string> = {
  confirmed: 'border-transparent bg-emerald-700 text-white',
  checked_in: 'border-sky-300 bg-sky-50 text-sky-800',
  pending_payment: 'border-amber-300 bg-amber-50 text-amber-900',
  failed: 'border-slate-200 bg-slate-100 text-slate-600',
  expired: 'border-slate-200 bg-slate-100 text-slate-600',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/reservation-status src/components/admin`
Expected: PASS (los tests existentes de `components/admin` siguen verdes: ninguno afirmaba la hora 24h ni los colores viejos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reservation-status.ts src/lib/reservation-status.test.ts
git commit -m "feat(admin): status palette and 12h Caracas entry time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `StatusPill` compartida

**Files:**
- Create: `src/components/admin/status-pill.tsx`
- Test: `src/components/admin/status-pill.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  it('confirmed: solid emerald with an icon', () => {
    render(<StatusPill reservation={{ status: 'confirmed', checked_in_at: null }} />);
    const pill = screen.getByText('Confirmada');
    expect(pill).toHaveClass('bg-emerald-700', 'text-white');
    expect(pill.querySelector('svg')).not.toBeNull();
  });

  it('checked_in: soft blue outline with the 12h Caracas entry time', () => {
    render(<StatusPill reservation={{ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' }} />);
    expect(screen.getByText('Ingresó 10:15 a. m.')).toHaveClass('border-sky-300', 'bg-sky-50');
  });

  it('pending_payment: amber with a motion-safe pulse', () => {
    render(<StatusPill reservation={{ status: 'pending_payment', checked_in_at: null }} />);
    expect(screen.getByText('Pago en verificación')).toHaveClass('bg-amber-50');
    const ping = screen.getByTestId('pending-pulse').firstElementChild;
    expect(ping).toHaveClass('motion-safe:animate-ping');
    expect(ping?.className).not.toMatch(/(^|\s)animate-ping/);
  });

  it('failed / expired: muted gray', () => {
    render(<StatusPill reservation={{ status: 'expired', checked_in_at: null }} />);
    expect(screen.getByText('Expirada')).toHaveClass('bg-slate-100', 'text-slate-600');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/status-pill`
Expected: FAIL (`Failed to resolve import "./status-pill"`).

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Ban, CircleCheck, LogIn } from 'lucide-react';
import type { ReservationRow } from '@/lib/db/reservations';
import { STATUS_CHIP_CLASS, statusLabelEs } from '@/lib/reservation-status';
import { cn } from '@/lib/utils';

type Status = ReservationRow['status'];

function StatusIcon(props: { status: Status }) {
  switch (props.status) {
    case 'pending_payment':
      return (
        <span aria-hidden data-testid="pending-pulse" className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-amber-500 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
      );
    case 'confirmed':
      return <CircleCheck aria-hidden className="size-3.5" />;
    case 'checked_in':
      return <LogIn aria-hidden className="size-3.5" />;
    default:
      return <Ban aria-hidden className="size-3.5" />;
  }
}

/** Reservation status badge (md2 §4). Colors come from STATUS_CHIP_CLASS. */
export function StatusPill(props: {
  reservation: Pick<ReservationRow, 'status' | 'checked_in_at'>;
  className?: string;
}) {
  const { status } = props.reservation;
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        STATUS_CHIP_CLASS[status],
        props.className,
      )}
    >
      <StatusIcon status={status} />
      {statusLabelEs(props.reservation)}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/status-pill`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/status-pill.tsx src/components/admin/status-pill.test.tsx
git commit -m "feat(admin): shared reservation StatusPill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `ReservationCard` (tarjeta móvil)

**Files:**
- Modify: `src/components/admin/reservation-card.tsx` (archivo completo)
- Test: `src/components/admin/reservation-card.test.tsx` (añadir tests al `describe`)

- [ ] **Step 1: Write the failing test**

Añade dentro de `describe('ReservationCard', …)` en `src/components/admin/reservation-card.test.tsx`:
```tsx
  it('offers "Reenviar voucher" for confirmed and calls onResend', async () => {
    const onResend = vi.fn();
    render(<ReservationCard reservation={row()} onCheckin={vi.fn()} onResend={onResend} onDetail={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Reenviar voucher/i }));
    expect(onResend).toHaveBeenCalledWith(row().id);
  });
  it('shows "Verificar" for pending payments, which opens the detail', async () => {
    const onDetail = vi.fn();
    render(<ReservationCard reservation={row({ status: 'pending_payment' })} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={onDetail} />);
    expect(screen.queryByRole('button', { name: /Reenviar voucher/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onDetail).toHaveBeenCalledWith(row().id);
  });
  it('uses the shared status pill', () => {
    render(<ReservationCard reservation={row()} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={vi.fn()} />);
    expect(screen.getByText('Confirmada')).toHaveClass('bg-emerald-700');
  });
  it('shows the visit date with only its first letter capitalized', () => {
    render(<ReservationCard reservation={row()} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={vi.fn()} />);
    const line = screen.getByText(/15 ene/);
    expect(line).toHaveClass('first-letter:uppercase');
    expect(line).not.toHaveClass('capitalize');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/reservation-card`
Expected: FAIL (no hay botón "Reenviar voucher" ni "Verificar"; no hay fecha).

- [ ] **Step 3: Write minimal implementation**

Reemplaza **todo** `src/components/admin/reservation-card.tsx`:
```tsx
'use client';

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReservationRow } from '@/lib/db/reservations';
import { shortDateEs } from '@/lib/dates';
import { partyLabel } from '@/lib/party';
import { cn } from '@/lib/utils';
import { StatusPill } from './status-pill';
import { ADMIN_ACTION } from './ui-constants';

/** Stacked reservation card: the mobile layout of every admin reservation list. */
export function ReservationCard(props: {
  reservation: ReservationRow;
  onCheckin: (id: string) => void;
  onResend: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  const r = props.reservation;
  const resendable = r.status === 'confirmed' || r.status === 'checked_in';
  return (
    <div data-testid="res-row" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold">{r.code}</span>
        <StatusPill reservation={r} />
      </div>
      <p className="mt-1 text-sm font-medium">{r.first_name} {r.last_name}</p>
      <p className="text-sm text-muted-foreground">{r.id_type}-{r.id_number}</p>
      <p className="text-sm text-muted-foreground first-letter:uppercase">
        {shortDateEs(r.date)} · {partyLabel(r.adults, r.children)} · ${Number(r.total_usd).toFixed(2)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="secondary" className={ADMIN_ACTION} onClick={() => props.onDetail(r.id)}>Ver detalle</Button>
        {resendable && (
          <Button variant="outline" className={cn(ADMIN_ACTION, 'gap-2')} onClick={() => props.onResend(r.id)}>
            <Mail aria-hidden className="size-4" />
            Reenviar voucher
          </Button>
        )}
        <div className="ml-auto">
          {r.status === 'confirmed' ? (
            <Button className={ADMIN_ACTION} onClick={() => props.onCheckin(r.id)}>Check-in</Button>
          ) : r.status === 'pending_payment' ? (
            <Button
              variant="outline"
              className={cn(ADMIN_ACTION, 'border-amber-300 text-amber-900 hover:bg-amber-50')}
              onClick={() => props.onDetail(r.id)}
            >
              Verificar
            </Button>
          ) : r.status === 'checked_in' ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
              Ingreso registrado
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/reservation-card src/components/admin/reservations-table`
Expected: PASS (incluye los tests previos de la tarjeta y de la lista del día).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/reservation-card.tsx src/components/admin/reservation-card.test.tsx
git commit -m "feat(admin): reservation card with status pill, resend and verify

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `SlideOver` (panel lateral base-ui)

**Files:**
- Create: `src/components/admin/slide-over.tsx`
- Test: `src/components/admin/slide-over.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlideOver } from './slide-over';

describe('SlideOver', () => {
  it('is a named modal dialog with body and footer', () => {
    render(
      <SlideOver open onOpenChange={vi.fn()} title="Detalle" footer={<button type="button">Acción</button>}>
        <p>cuerpo</p>
      </SlideOver>,
    );
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toBeInTheDocument();
    expect(screen.getByText('cuerpo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
  });

  it('closes from a 44px close button', async () => {
    const onOpenChange = vi.fn();
    render(<SlideOver open onOpenChange={onOpenChange} title="Detalle"><p>cuerpo</p></SlideOver>);
    const close = screen.getByRole('button', { name: 'Cerrar panel' });
    expect(close).toHaveClass('size-11');
    await userEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing while closed', () => {
    render(<SlideOver open={false} onOpenChange={vi.fn()} title="Detalle"><p>cuerpo</p></SlideOver>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/slide-over`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION } from './ui-constants';

/** Right-hand slide-over panel (base-ui Dialog: focus trap, Escape, focus return). */
export function SlideOver(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={props.open} onOpenChange={(open) => props.onOpenChange(open)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-navy-deep/40 transition-opacity duration-200 motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl outline-none',
            'transition-transform duration-200 motion-reduce:transition-none',
            'data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
            <DialogPrimitive.Title className="font-heading text-lg font-extrabold text-navy">
              {props.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Cerrar panel"
              className={cn(
                ADMIN_ICON_ACTION,
                'grid cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors motion-reduce:transition-none',
                'hover:bg-slate-100 hover:text-navy focus-visible:outline-2 focus-visible:outline-teal',
              )}
            >
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{props.children}</div>
          {props.footer && <div className="border-t border-slate-200 px-5 py-3">{props.footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/slide-over`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/slide-over.tsx src/components/admin/slide-over.test.tsx
git commit -m "feat(admin): base-ui slide-over panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Drawer de detalle (`ReservationDetailDialog`) + fix `capitalize`

**Files:**
- Modify: `src/components/admin/reservation-detail-dialog.tsx` (archivo completo)
- Modify: `src/components/admin/reservations-table.tsx` (bloque `<ReservationDetailDialog …/>`)
- Test: `src/components/admin/reservation-detail-dialog.test.tsx`, `src/components/admin/reservations-table.test.tsx`

- [ ] **Step 1: Write the failing tests**

En `src/components/admin/reservation-detail-dialog.test.tsx`, cambia la línea de imports de testing-library a:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { longDateEs } from '@/lib/dates';
```
y añade dentro del `describe`:
```tsx
  it('is a slide-over dialog named "Detalle de la reserva"', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Detalle de la reserva' })).toBeInTheDocument();
  });
  it('shows payment and audit data: C2P ref, BCV rate, Bs. total, created and check-in times', () => {
    render(
      <ReservationDetailDialog
        reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z', payment_ref: 'C2P-998877' })}
        open onOpenChange={() => {}} onStartCheckin={vi.fn()}
      />,
    );
    expect(screen.getByText('C2P-998877')).toBeInTheDocument();
    expect(screen.getByText('Bs. 36.50 / USD')).toBeInTheDocument();
    expect(screen.getByText('Bs. 547.50')).toBeInTheDocument();
    expect(screen.getByText('j@e.com')).toBeInTheDocument();
    expect(screen.getByText(/^10 ene\.? 2030, 6:00 a\. m\.$/)).toBeInTheDocument();
    expect(screen.getByText(/^15 ene\.? 2030, 10:15 a\. m\.$/)).toBeInTheDocument();
  });
  it('uses first-letter:uppercase (not capitalize) for the long date', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    const date = screen.getByText(longDateEs('2030-01-15'));
    expect(date).toHaveClass('first-letter:uppercase');
    expect(date).not.toHaveClass('capitalize');
  });
  it('shows dashes for missing payment data and the expiry of pending payments', () => {
    render(
      <ReservationDetailDialog
        reservation={row({ status: 'pending_payment', payment_ref: null, bcv_rate: null, total_ves: null, expires_at: '2030-01-15T15:00:00Z' })}
        open onOpenChange={() => {}} onStartCheckin={vi.fn()}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Expira')).toBeInTheDocument();
  });
  it('resends the voucher when onResend is provided', async () => {
    const onResend = vi.fn();
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} onResend={onResend} />);
    await userEvent.click(screen.getByRole('button', { name: /Reenviar voucher/i }));
    expect(onResend).toHaveBeenCalledWith(row().id);
  });
```

En `src/components/admin/reservations-table.test.tsx`, cambia el import a:
```tsx
import { render, screen, within } from '@testing-library/react';
```
y añade dentro del `describe`:
```tsx
  it('resends the voucher from the detail drawer', async () => {
    const onResend = vi.fn();
    render(<ReservationsTable rows={[rows[0]]} today={TODAY} onCheckIn={vi.fn()} onResend={onResend} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Detalle de la reserva' });
    await userEvent.click(within(drawer).getByRole('button', { name: /Reenviar voucher/i }));
    expect(onResend).toHaveBeenCalledWith(rows[0].id);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/reservation-detail-dialog src/components/admin/reservations-table`
Expected: FAIL (no hay referencia C2P, tasa, `first-letter:uppercase`, ni botón de reenvío en el drawer).

- [ ] **Step 3: Write minimal implementation**

Reemplaza **todo** `src/components/admin/reservation-detail-dialog.tsx`:
```tsx
'use client';

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReservationRow } from '@/lib/db/reservations';
import { longDateEs } from '@/lib/dates';
import { partyLabel } from '@/lib/party';
import { caracasDateTime12 } from '@/lib/reservation-status';
import { cn } from '@/lib/utils';
import { SlideOver } from './slide-over';
import { StatusPill } from './status-pill';
import { DIALOG_ACTION } from './ui-constants';

const DASH = '—';

function Field(props: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className={cn('min-w-0 break-words font-medium text-slate-900', props.mono && 'font-mono')}>
        {props.children}
      </dd>
    </div>
  );
}

/** Full reservation data in a right-hand slide-over (md2 §4 "Full Detail Drawer"). */
export function ReservationDetailDialog(props: {
  reservation: ReservationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartCheckin: () => void;
  onResend?: (id: string) => void;
}) {
  const r = props.reservation;
  const canResend = Boolean(props.onResend) && (r.status === 'confirmed' || r.status === 'checked_in');
  const canCheckin = r.status === 'confirmed';

  const footer = canResend || canCheckin ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {canResend && (
        <Button variant="outline" className={cn(DIALOG_ACTION, 'gap-2')} onClick={() => props.onResend?.(r.id)}>
          <Mail aria-hidden className="size-4" />
          Reenviar voucher
        </Button>
      )}
      {canCheckin && (
        <Button className={DIALOG_ACTION} onClick={props.onStartCheckin}>Iniciar check-in</Button>
      )}
    </div>
  ) : undefined;

  return (
    <SlideOver open={props.open} onOpenChange={props.onOpenChange} title="Detalle de la reserva" footer={footer}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xl font-bold">{r.code}</p>
        <StatusPill reservation={r} />
      </div>
      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        <Field label="Visita">
          <span className="block first-letter:uppercase">{longDateEs(r.date)}</span>
        </Field>
        <Field label="Cliente">{r.first_name} {r.last_name}</Field>
        <Field label="Documento">{r.id_type}-{r.id_number}</Field>
        <Field label="Correo">{r.email}</Field>
        <Field label="Personas">{partyLabel(r.adults, r.children)}</Field>
        <Field label="Total USD">${Number(r.total_usd).toFixed(2)}</Field>
        <Field label="Tasa BCV">{r.bcv_rate == null ? DASH : `Bs. ${Number(r.bcv_rate).toFixed(2)} / USD`}</Field>
        <Field label="Total Bs.">{r.total_ves == null ? DASH : `Bs. ${Number(r.total_ves).toFixed(2)}`}</Field>
        <Field label="Referencia C2P" mono>{r.payment_ref ?? DASH}</Field>
        <Field label="Creada">{caracasDateTime12(r.created_at)}</Field>
        <Field label="Ingreso">{r.checked_in_at ? caracasDateTime12(r.checked_in_at) : DASH}</Field>
        {r.status === 'pending_payment' && r.expires_at && (
          <Field label="Expira">{caracasDateTime12(r.expires_at)}</Field>
        )}
      </dl>
    </SlideOver>
  );
}
```

En `src/components/admin/reservations-table.tsx`, reemplaza el bloque del drawer de detalle:
```tsx
        <ReservationDetailDialog
          reservation={detail}
          open={detailId !== null}
          onOpenChange={(o) => { if (!o) setDetailId(null); }}
          onStartCheckin={() => { setDetailId(null); setCheckinId(detail.id); }}
        />
```
por:
```tsx
        <ReservationDetailDialog
          reservation={detail}
          open={detailId !== null}
          onOpenChange={(o) => { if (!o) setDetailId(null); }}
          onStartCheckin={() => { setDetailId(null); setCheckinId(detail.id); }}
          onResend={props.onResend}
        />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin`
Expected: PASS (incluye los 3 tests originales del detalle: `PP-KAV8W`, `Jose Rios`, `V-262626262`, `$15.00`, "Iniciar check-in").

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/reservation-detail-dialog.tsx src/components/admin/reservation-detail-dialog.test.tsx src/components/admin/reservations-table.tsx src/components/admin/reservations-table.test.tsx
git commit -m "feat(admin): reservation detail slide-over with payment data

Fixes the capitalize bug on the long date (first-letter:uppercase).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Parser de URL (`search-params.ts` — parte 1: estado y query)

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/_lib/search-params.ts`
- Test: `src/app/admin/(dashboard)/reservations/_lib/search-params.test.ts`

Nota: `_lib` y `_components` son carpetas privadas de App Router (no generan rutas). Este módulo **no** es `'use client'`: lo usan la página (servidor) y los componentes cliente. No importes nada de `pagination.tsx` aquí (es `'use client'`; llamar sus funciones desde el servidor falla).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE, parseReservationsParams, parseReservationsState, type ReservationsState,
} from './search-params';

const S = (over: Partial<ReservationsState> = {}): ReservationsState => ({ ...DEFAULT_STATE, ...over });

describe('parseReservationsState', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseReservationsState({})).toEqual(DEFAULT_STATE);
    expect(DEFAULT_STATE).toEqual({
      q: '', statuses: [], from: '', to: '', guest: '', sort: 'date', dir: 'desc', page: 1, pageSize: 10,
    });
  });

  it('reads every supported param', () => {
    expect(parseReservationsState({
      q: '  ana  ', status: 'confirmed', from: '2030-01-01', to: '2030-01-31', guest: 'family',
      sort: 'total_usd', dir: 'desc', page: '3', pageSize: '25',
    })).toEqual(S({
      q: 'ana', statuses: ['confirmed'], from: '2030-01-01', to: '2030-01-31', guest: 'family',
      sort: 'total_usd', dir: 'desc', page: 3, pageSize: 25,
    }));
  });

  it('accepts status as csv or repeated, deduped in canonical order', () => {
    expect(parseReservationsState({ status: 'expired,failed' }).statuses).toEqual(['failed', 'expired']);
    expect(parseReservationsState({ status: ['checked_in', 'pending_payment', 'checked_in'] }).statuses)
      .toEqual(['pending_payment', 'checked_in']);
  });

  it('drops unknown statuses', () => {
    expect(parseReservationsState({ status: 'confirmed,bogus' }).statuses).toEqual(['confirmed']);
  });

  it('falls back to defaults for every invalid value', () => {
    expect(parseReservationsState({
      from: '2030-02-30', to: 'mañana', guest: 'vip', sort: 'email', dir: 'up', page: '-2', pageSize: '30',
    })).toEqual(DEFAULT_STATE);
  });

  it('ignores a reversed date range', () => {
    const s = parseReservationsState({ from: '2030-02-01', to: '2030-01-01' });
    expect([s.from, s.to]).toEqual(['', '']);
  });

  it('rejects non-integer and out-of-range pages', () => {
    for (const page of ['1.5', '0', '10001', 'abc', '']) {
      expect(parseReservationsState({ page }).page).toBe(1);
    }
    expect(parseReservationsState({ page: '10000' }).page).toBe(10000);
  });

  it('defaults the direction per column', () => {
    expect(parseReservationsState({ sort: 'name' }).dir).toBe('asc');
    expect(parseReservationsState({ sort: 'date' }).dir).toBe('desc');
  });

  it('uses the first value of repeated scalar params and caps q at 100 chars', () => {
    expect(parseReservationsState({ q: ['ana', 'luis'] }).q).toBe('ana');
    expect(parseReservationsState({ q: 'a'.repeat(150) }).q).toHaveLength(100);
  });
});

describe('parseReservationsParams', () => {
  it('produces the zod-validated query for searchReservations', () => {
    expect(parseReservationsParams({
      q: 'ana', status: 'failed,expired', from: '2030-01-01', guest: 'individual', sort: 'name', page: '2', pageSize: '50',
    }).query).toEqual({
      q: 'ana', statuses: ['failed', 'expired'], dateFrom: '2030-01-01', guestType: 'individual',
      sort: { by: 'name', dir: 'asc' }, page: 2, pageSize: 50,
    });
  });

  it('never throws on garbage: defaults state and query', () => {
    const { state, query } = parseReservationsParams({ page: 'NaN', pageSize: '1e9', status: ',,,', sort: '__proto__' });
    expect(state).toEqual(DEFAULT_STATE);
    expect(query).toEqual({ sort: { by: 'date', dir: 'desc' }, page: 1, pageSize: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_lib/search-params`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

Crea `src/app/admin/(dashboard)/reservations/_lib/search-params.ts`:
```ts
import type { ReservationQuery, ReservationRow } from '@/lib/db/reservations';
import { DEFAULT_SORT, parseReservationQuery } from '@/lib/reservation-search';
import { STATUS_ORDER } from '@/lib/reservation-status';

/**
 * /admin/reservations keeps its whole state in the URL:
 * ?q=&status=(csv or repeated)&from=&to=&guest=&sort=&dir=&page=&pageSize=
 * Parsing is lenient (each bad value falls back to its default, never throws);
 * the result then goes through PR 02's zod parser before hitting the DB.
 */

export const RESERVATIONS_PATH = '/admin/reservations';

export type RawSearchParams = Record<string, string | string[] | undefined>;
type Status = ReservationRow['status'];
export type SortKey = NonNullable<ReservationQuery['sort']>['by'];
export type SortDir = NonNullable<ReservationQuery['sort']>['dir'];
export type GuestType = NonNullable<ReservationQuery['guestType']>;
export type PageSize = ReservationQuery['pageSize'];

/** Normalized list state ('' = not set). */
export interface ReservationsState {
  q: string;
  statuses: Status[];
  from: string;
  to: string;
  guest: GuestType | '';
  sort: SortKey;
  dir: SortDir;
  page: number;
  pageSize: PageSize;
}

export const SORT_KEYS = [
  'date', 'code', 'name', 'guests', 'total_usd', 'status',
] as const satisfies readonly SortKey[];
const PAGE_SIZES = [10, 25, 50] as const satisfies readonly PageSize[];
const GUEST_TYPES = ['individual', 'family'] as const satisfies readonly GuestType[];
const DIRS = ['asc', 'desc'] as const satisfies readonly SortDir[];
const MAX_PAGE = 10000;
const MAX_Q = 100;

export const DEFAULT_STATE: ReservationsState = {
  q: '', statuses: [], from: '', to: '', guest: '',
  sort: DEFAULT_SORT.by, dir: DEFAULT_SORT.dir, page: 1, pageSize: 10,
};

/** Newest first for dates; A→Z / low→high for every other column. */
export function defaultDir(sort: SortKey): SortDir {
  return sort === 'date' ? 'desc' : 'asc';
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function all(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function oneOf<T extends string | number>(options: readonly T[], value: unknown): T | undefined {
  return options.find((o) => o === value);
}

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Lenient URL → state. Unknown or invalid values fall back to their defaults. */
export function parseReservationsState(sp: RawSearchParams): ReservationsState {
  const requested = new Set(all(sp.status).flatMap((v) => v.split(',')).map((s) => s.trim()));
  let from = isIsoDate(first(sp.from)) ? first(sp.from) : '';
  let to = isIsoDate(first(sp.to)) ? first(sp.to) : '';
  if (from && to && from > to) {
    from = '';
    to = '';
  }
  const sort = oneOf(SORT_KEYS, first(sp.sort)) ?? DEFAULT_STATE.sort;
  const page = Number(first(sp.page));
  return {
    q: first(sp.q).trim().slice(0, MAX_Q),
    statuses: STATUS_ORDER.filter((s) => requested.has(s)),
    from,
    to,
    guest: oneOf(GUEST_TYPES, first(sp.guest)) ?? '',
    sort,
    dir: oneOf(DIRS, first(sp.dir)) ?? defaultDir(sort),
    page: first(sp.page) !== '' && Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
    pageSize: oneOf(PAGE_SIZES, Number(first(sp.pageSize))) ?? DEFAULT_STATE.pageSize,
  };
}

/** State → validated query (PR 02's zod parser). null only if the state is somehow invalid. */
export function toReservationQuery(state: ReservationsState): ReservationQuery | null {
  return parseReservationQuery({
    page: state.page,
    pageSize: state.pageSize,
    sort: { by: state.sort, dir: state.dir },
    ...(state.q ? { q: state.q } : {}),
    ...(state.statuses.length > 0 ? { statuses: state.statuses } : {}),
    ...(state.from ? { dateFrom: state.from } : {}),
    ...(state.to ? { dateTo: state.to } : {}),
    ...(state.guest ? { guestType: state.guest } : {}),
  });
}

/** URL → { state, query }. Bad params degrade to defaults instead of erroring the page. */
export function parseReservationsParams(sp: RawSearchParams): { state: ReservationsState; query: ReservationQuery } {
  const state = parseReservationsState(sp);
  const query = toReservationQuery(state);
  if (query) return { state, query };
  return { state: DEFAULT_STATE, query: toReservationQuery(DEFAULT_STATE)! };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_lib/search-params`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_lib/search-params.ts" "src/app/admin/(dashboard)/reservations/_lib/search-params.test.ts"
git commit -m "feat(admin): lenient URL parser for the reservations list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `search-params.ts` — parte 2: hrefs, orden y última página

**Files:**
- Modify: `src/app/admin/(dashboard)/reservations/_lib/search-params.ts` (añadir al final)
- Test: `src/app/admin/(dashboard)/reservations/_lib/search-params.test.ts`

- [ ] **Step 1: Write the failing test**

En el test, reemplaza el bloque de import de `./search-params` por:
```ts
import {
  DEFAULT_STATE, ariaSort, lastPage, parseReservationsParams, parseReservationsState,
  reservationsHref, sortHref, stateToParams, type ReservationsState,
} from './search-params';
```
y añade al final del archivo:
```ts
describe('stateToParams / reservationsHref', () => {
  it('is the bare path for the default state', () => {
    expect(stateToParams(DEFAULT_STATE)).toEqual({});
    expect(reservationsHref(DEFAULT_STATE)).toBe('/admin/reservations');
  });

  it('serializes non-default values and resets the page on any other change', () => {
    expect(reservationsHref(S({ page: 4, pageSize: 25 }), { statuses: ['failed', 'expired'] }))
      .toBe('/admin/reservations?status=failed%2Cexpired&pageSize=25');
  });

  it('keeps an explicit page', () => {
    expect(reservationsHref(S(), { page: 3 })).toBe('/admin/reservations?page=3');
  });

  it('round-trips through the parser', () => {
    const state = S({
      q: 'josé', statuses: ['confirmed'], from: '2030-01-01', to: '2030-01-02', guest: 'family',
      sort: 'code', dir: 'asc', page: 2, pageSize: 50,
    });
    const url = new URL(reservationsHref(state, { page: 2 }), 'http://x');
    expect(parseReservationsState(Object.fromEntries(url.searchParams))).toEqual(state);
  });
});

describe('sortHref / ariaSort', () => {
  it('flips the direction of the active column', () => {
    expect(sortHref(S({ sort: 'name', dir: 'asc' }), 'name')).toBe('/admin/reservations?sort=name&dir=desc');
  });

  it('uses the column default for a new column and goes back to page 1', () => {
    expect(sortHref(S({ page: 5 }), 'total_usd')).toBe('/admin/reservations?sort=total_usd&dir=asc');
    expect(sortHref(S({ sort: 'code', dir: 'asc' }), 'date')).toBe('/admin/reservations');
  });

  it('exposes aria-sort only on the active column', () => {
    expect(ariaSort(DEFAULT_STATE, 'date')).toBe('descending');
    expect(ariaSort(S({ sort: 'code', dir: 'asc' }), 'code')).toBe('ascending');
    expect(ariaSort(DEFAULT_STATE, 'code')).toBe('none');
  });
});

describe('lastPage', () => {
  it('is at least 1', () => {
    expect(lastPage(0, 10)).toBe(1);
    expect(lastPage(10, 10)).toBe(1);
    expect(lastPage(11, 10)).toBe(2);
    expect(lastPage(142, 25)).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_lib/search-params`
Expected: FAIL (`reservationsHref is not a function`, etc.).

- [ ] **Step 3: Write minimal implementation**

Añade al final de `search-params.ts`:
```ts
/** State → search params, omitting defaults so URLs stay short and shareable. */
export function stateToParams(state: ReservationsState): Record<string, string> {
  const p: Record<string, string> = {};
  if (state.q) p.q = state.q;
  if (state.statuses.length > 0) p.status = state.statuses.join(',');
  if (state.from) p.from = state.from;
  if (state.to) p.to = state.to;
  if (state.guest) p.guest = state.guest;
  if (state.sort !== DEFAULT_STATE.sort || state.dir !== DEFAULT_STATE.dir) {
    p.sort = state.sort;
    p.dir = state.dir;
  }
  if (state.page !== 1) p.page = String(state.page);
  if (state.pageSize !== DEFAULT_STATE.pageSize) p.pageSize = String(state.pageSize);
  return p;
}

/** Link to the list with `patch` applied. Any change other than `page` goes back to page 1. */
export function reservationsHref(state: ReservationsState, patch: Partial<ReservationsState> = {}): string {
  const next: ReservationsState = { ...state, ...patch, page: patch.page ?? 1 };
  const qs = new URLSearchParams(stateToParams(next)).toString();
  return qs ? `${RESERVATIONS_PATH}?${qs}` : RESERVATIONS_PATH;
}

/** Header link: flips the active column, otherwise sorts by `by` in its default direction. */
export function sortHref(state: ReservationsState, by: SortKey): string {
  const dir: SortDir = state.sort === by ? (state.dir === 'asc' ? 'desc' : 'asc') : defaultDir(by);
  return reservationsHref(state, { sort: by, dir });
}

export function ariaSort(state: ReservationsState, by: SortKey): 'ascending' | 'descending' | 'none' {
  if (state.sort !== by) return 'none';
  return state.dir === 'asc' ? 'ascending' : 'descending';
}

/** Last valid page (server-safe twin of pagination.tsx's totalPages, which is a client module). */
export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_lib/search-params`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_lib"
git commit -m "feat(admin): URL builders and sort links for the reservations list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `search-params.ts` — parte 3: chips de estado y filtros activos

**Files:**
- Modify: `src/app/admin/(dashboard)/reservations/_lib/search-params.ts`
- Test: `src/app/admin/(dashboard)/reservations/_lib/search-params.test.ts`

- [ ] **Step 1: Write the failing test**

Reemplaza el bloque de import de `./search-params` por:
```ts
import {
  DEFAULT_STATE, STATUS_CHIPS, activeFilters, activeStatusChip, ariaSort, clearFiltersHref, lastPage,
  parseReservationsParams, parseReservationsState, reservationsHref, sortHref, stateToParams,
  type ReservationsState,
} from './search-params';
```
y añade al final:
```ts
describe('status chips (roadmap §2)', () => {
  it('are Todas · Confirmadas · Ingresaron · Pendientes · Canceladas', () => {
    expect(STATUS_CHIPS.map((c) => c.label)).toEqual(['Todas', 'Confirmadas', 'Ingresaron', 'Pendientes', 'Canceladas']);
    expect(STATUS_CHIPS.find((c) => c.key === 'canceled')?.statuses).toEqual(['failed', 'expired']);
  });

  it('marks the chip matching the status filter exactly', () => {
    expect(activeStatusChip(DEFAULT_STATE)).toBe('all');
    expect(activeStatusChip(S({ statuses: ['pending_payment'] }))).toBe('pending');
    expect(activeStatusChip(S({ statuses: ['failed', 'expired'] }))).toBe('canceled');
    expect(activeStatusChip(S({ statuses: ['confirmed', 'checked_in'] }))).toBeNull();
  });
});

describe('activeFilters / clearFiltersHref', () => {
  it('is empty without filters', () => {
    expect(activeFilters(S({ sort: 'code', dir: 'asc', pageSize: 25 }))).toEqual([]);
  });

  it('lists one dismissible chip per filter, each removing only itself', () => {
    const state = S({ q: 'ana', statuses: ['confirmed', 'checked_in'], from: '2030-01-15', guest: 'family', sort: 'code', dir: 'asc' });
    expect(activeFilters(state)).toEqual([
      { id: 'q', label: 'Búsqueda: “ana”', href: '/admin/reservations?status=confirmed%2Cchecked_in&from=2030-01-15&guest=family&sort=code&dir=asc' },
      { id: 'status:confirmed', label: 'Estado: Confirmada', href: '/admin/reservations?q=ana&status=checked_in&from=2030-01-15&guest=family&sort=code&dir=asc' },
      { id: 'status:checked_in', label: 'Estado: Ingresó', href: '/admin/reservations?q=ana&status=confirmed&from=2030-01-15&guest=family&sort=code&dir=asc' },
      { id: 'from', label: 'Desde: 15 ene 2030', href: '/admin/reservations?q=ana&status=confirmed%2Cchecked_in&guest=family&sort=code&dir=asc' },
      { id: 'guest', label: 'Grupo: Familia', href: '/admin/reservations?q=ana&status=confirmed%2Cchecked_in&from=2030-01-15&sort=code&dir=asc' },
    ]);
  });

  it('labels the end date and the individual guest type', () => {
    expect(activeFilters(S({ to: '2030-02-01', guest: 'individual' })).map((f) => f.label))
      .toEqual(['Hasta: 1 feb 2030', 'Grupo: Individual']);
  });

  it('"Limpiar todo" keeps sort and page size', () => {
    const state = S({ q: 'ana', statuses: ['confirmed'], from: '2030-01-15', guest: 'family', sort: 'code', dir: 'asc', pageSize: 25, page: 3 });
    expect(clearFiltersHref(state)).toBe('/admin/reservations?sort=code&dir=asc&pageSize=25');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_lib/search-params`
Expected: FAIL (`STATUS_CHIPS` indefinido).

- [ ] **Step 3: Write minimal implementation**

En `search-params.ts` reemplaza la línea:
```ts
import { STATUS_ORDER } from '@/lib/reservation-status';
```
por:
```ts
import { STATUS_NAME_ES, STATUS_ORDER } from '@/lib/reservation-status';
```
y añade al final:
```ts
export type StatusChipKey = 'all' | 'confirmed' | 'checked_in' | 'pending' | 'canceled';

/** Quick status filters (roadmap §2). "Canceladas" = failed + expired. */
export const STATUS_CHIPS: readonly { key: StatusChipKey; label: string; statuses: Status[] }[] = [
  { key: 'all', label: 'Todas', statuses: [] },
  { key: 'confirmed', label: 'Confirmadas', statuses: ['confirmed'] },
  { key: 'checked_in', label: 'Ingresaron', statuses: ['checked_in'] },
  { key: 'pending', label: 'Pendientes', statuses: ['pending_payment'] },
  { key: 'canceled', label: 'Canceladas', statuses: ['failed', 'expired'] },
];

/** Chip matching the status filter exactly; null for custom combinations from a shared URL. */
export function activeStatusChip(state: ReservationsState): StatusChipKey | null {
  const current = state.statuses.join(',');
  return STATUS_CHIPS.find((c) => c.statuses.join(',') === current)?.key ?? null;
}

export interface ActiveFilter {
  id: string;
  label: string;
  /** Same list without this filter. */
  href: string;
}

const GUEST_LABEL: Record<GuestType, string> = { individual: 'Individual', family: 'Familia' };

/** "15 ene 2030" in Caracas. */
function chipDate(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(`${date}T12:00:00-04:00`)).replace(/\./g, '');
}

/** One dismissible chip per active filter ("Estado: Confirmada ✕"). */
export function activeFilters(state: ReservationsState): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (state.q) {
    out.push({ id: 'q', label: `Búsqueda: “${state.q}”`, href: reservationsHref(state, { q: '' }) });
  }
  for (const s of state.statuses) {
    out.push({
      id: `status:${s}`,
      label: `Estado: ${STATUS_NAME_ES[s]}`,
      href: reservationsHref(state, { statuses: state.statuses.filter((x) => x !== s) }),
    });
  }
  if (state.from) {
    out.push({ id: 'from', label: `Desde: ${chipDate(state.from)}`, href: reservationsHref(state, { from: '' }) });
  }
  if (state.to) {
    out.push({ id: 'to', label: `Hasta: ${chipDate(state.to)}`, href: reservationsHref(state, { to: '' }) });
  }
  if (state.guest) {
    out.push({ id: 'guest', label: `Grupo: ${GUEST_LABEL[state.guest]}`, href: reservationsHref(state, { guest: '' }) });
  }
  return out;
}

/** "Limpiar todo": drops every filter, keeps sort and page size. */
export function clearFiltersHref(state: ReservationsState): string {
  return reservationsHref(state, { q: '', statuses: [], from: '', to: '', guest: '' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_lib/search-params`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_lib"
git commit -m "feat(admin): status chips and dismissible active filters model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `SearchBox` (command-bar con debounce)

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/_components/search-box.tsx`
- Test: `src/app/admin/(dashboard)/reservations/_components/search-box.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// One stable router object, like Next's.
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { SearchBox } from './search-box';
import { DEFAULT_STATE } from '../_lib/search-params';

const input = () => screen.getByRole('textbox', { name: 'Buscar reservas' });

beforeEach(() => {
  vi.useFakeTimers();
  router.replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SearchBox', () => {
  it('updates the URL once typing pauses, keeping filters and resetting the page', () => {
    render(<SearchBox state={{ ...DEFAULT_STATE, statuses: ['confirmed'], page: 3 }} />);
    fireEvent.change(input(), { target: { value: 'an' } });
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.change(input(), { target: { value: 'ana ' } });
    act(() => { vi.advanceTimersByTime(299); });
    expect(router.replace).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/admin/reservations?q=ana&status=confirmed', { scroll: false });
  });

  it('does not navigate when the text already matches the URL', () => {
    render(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    fireEvent.change(input(), { target: { value: 'ana ' } });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('the clear button empties the field and removes q from the URL', () => {
    render(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(input()).toHaveValue('');
    act(() => { vi.advanceTimersByTime(300); });
    expect(router.replace).toHaveBeenCalledWith('/admin/reservations', { scroll: false });
  });

  it('adopts a q that changes from outside (chip ✕, ⌘K)', () => {
    const { rerender } = render(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    rerender(<SearchBox state={{ ...DEFAULT_STATE, q: 'luis' }} />);
    expect(input()).toHaveValue('luis');
  });

  it('keeps what the user is typing when its own debounced write lands', () => {
    const { rerender } = render(<SearchBox state={DEFAULT_STATE} />);
    fireEvent.change(input(), { target: { value: 'ana' } });
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.change(input(), { target: { value: 'ana p' } });
    rerender(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    expect(input()).toHaveValue('ana p');
  });

  it('is a 44px field', () => {
    render(<SearchBox state={DEFAULT_STATE} />);
    expect(input()).toHaveClass('h-11');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/search-box`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ADMIN_ICON_ACTION, ADMIN_INPUT } from '@/components/admin/ui-constants';
import { cn } from '@/lib/utils';
import { reservationsHref, type ReservationsState } from '../_lib/search-params';

export const SEARCH_DEBOUNCE_MS = 300;

/** Command-bar search: the URL (and so the server query) follows the text after a pause. */
export function SearchBox(props: { state: ReservationsState; delayMs?: number }) {
  const { state, delayMs = SEARCH_DEBOUNCE_MS } = props;
  const router = useRouter();
  const [value, setValue] = useState(state.q);
  const [seenQ, setSeenQ] = useState(state.q);
  const [sentQ, setSentQ] = useState<string | null>(null);

  // q changed in the URL: adopt it, unless it is our own debounced write landing
  // (then the user may already have typed more, which must not be overwritten).
  if (state.q !== seenQ) {
    setSeenQ(state.q);
    if (state.q !== sentQ) setValue(state.q);
  }

  useEffect(() => {
    const next = value.trim();
    if (next === state.q) return;
    const timer = setTimeout(() => {
      setSentQ(next);
      router.replace(reservationsHref(state, { q: next }), { scroll: false });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, state, delayMs, router]);

  return (
    <div role="search" className="relative min-w-0 flex-1">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        aria-label="Buscar reservas"
        placeholder="Nombre, código PP-XXXX o cédula…"
        className={cn(ADMIN_INPUT, 'bg-white pl-9 pr-11')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => setValue('')}
          className={cn(
            ADMIN_ICON_ACTION,
            'absolute right-0 top-0 grid cursor-pointer place-items-center rounded-lg text-muted-foreground hover:text-foreground',
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/search-box`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_components/search-box.tsx" "src/app/admin/(dashboard)/reservations/_components/search-box.test.tsx"
git commit -m "feat(admin): debounced command-bar search for reservations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Chips de estado y chips de filtros activos

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/_components/filter-chips.tsx`
- Test: `src/app/admin/(dashboard)/reservations/_components/filter-chips.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActiveFilters, StatusChips } from './filter-chips';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';

const S = (over: Partial<ReservationsState> = {}): ReservationsState => ({ ...DEFAULT_STATE, ...over });

describe('StatusChips', () => {
  it('renders the five chips as 44px links, "Todas" active by default', () => {
    render(<StatusChips state={DEFAULT_STATE} />);
    const nav = screen.getByRole('navigation', { name: 'Filtrar por estado' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual(['Todas', 'Confirmadas', 'Ingresaron', 'Pendientes', 'Canceladas']);
    expect(screen.getByRole('link', { name: 'Todas' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Canceladas' })).toHaveAttribute('href', '/admin/reservations?status=failed%2Cexpired');
    for (const a of links) expect(a).toHaveClass('min-h-11');
  });

  it('keeps the search, resets the page and marks the active chip', () => {
    render(<StatusChips state={S({ q: 'ana', page: 4, statuses: ['pending_payment'] })} />);
    expect(screen.getByRole('link', { name: 'Pendientes' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Todas' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Confirmadas' })).toHaveAttribute('href', '/admin/reservations?q=ana&status=confirmed');
    expect(screen.getByRole('link', { name: 'Todas' })).toHaveAttribute('href', '/admin/reservations?q=ana');
  });
});

describe('ActiveFilters', () => {
  it('renders nothing without filters', () => {
    const { container } = render(<ActiveFilters state={DEFAULT_STATE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('each chip removes its own filter; "Limpiar todo" removes all', () => {
    render(<ActiveFilters state={S({ statuses: ['confirmed'], guest: 'family' })} />);
    expect(screen.getByRole('link', { name: 'Quitar filtro Estado: Confirmada' })).toHaveAttribute('href', '/admin/reservations?guest=family');
    expect(screen.getByRole('link', { name: 'Quitar filtro Grupo: Familia' })).toHaveAttribute('href', '/admin/reservations?status=confirmed');
    expect(screen.getByRole('link', { name: 'Limpiar todo' })).toHaveAttribute('href', '/admin/reservations');
    expect(screen.getByText('Estado: Confirmada')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/filter-chips`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STATUS_CHIPS, activeFilters, activeStatusChip, clearFiltersHref, reservationsHref, type ReservationsState,
} from '../_lib/search-params';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-teal';

/** Todas · Confirmadas · Ingresaron · Pendientes · Canceladas (roadmap §2). */
export function StatusChips(props: { state: ReservationsState }) {
  const active = activeStatusChip(props.state);
  return (
    <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {STATUS_CHIPS.map((chip) => {
        const on = chip.key === active;
        return (
          <Link
            key={chip.key}
            href={reservationsHref(props.state, { statuses: chip.statuses })}
            scroll={false}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none',
              FOCUS,
              on ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Dismissible chips for every active filter, plus "Limpiar todo". */
export function ActiveFilters(props: { state: ReservationsState }) {
  const filters = activeFilters(props.state);
  if (filters.length === 0) return null;
  return (
    <div role="group" aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          scroll={false}
          aria-label={`Quitar filtro ${f.label}`}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-teal/40 bg-mint px-3 text-sm font-medium text-navy hover:bg-teal-soft',
            FOCUS,
          )}
        >
          {f.label}
          <X aria-hidden className="size-4" />
        </Link>
      ))}
      <Link
        href={clearFiltersHref(props.state)}
        scroll={false}
        className={cn('inline-flex min-h-11 items-center px-2 text-sm font-semibold text-navy underline-offset-4 hover:underline', FOCUS)}
      >
        Limpiar todo
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/filter-chips`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_components/filter-chips.tsx" "src/app/admin/(dashboard)/reservations/_components/filter-chips.test.tsx"
git commit -m "feat(admin): status chips and dismissible active filter chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Drawer de filtros avanzados (rango de fechas, tipo de grupo)

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/_components/filters-drawer.tsx`
- Test: `src/app/admin/(dashboard)/reservations/_components/filters-drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { FiltersDrawer } from './filters-drawer';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';

const S = (over: Partial<ReservationsState> = {}): ReservationsState => ({ ...DEFAULT_STATE, ...over });
const trigger = () => screen.getByRole('button', { name: /^Filtros/ });

beforeEach(() => router.push.mockReset());

describe('FiltersDrawer', () => {
  it('shows how many advanced filters are active on a 44px trigger', () => {
    render(<FiltersDrawer state={S({ from: '2030-01-01', guest: 'family' })} />);
    expect(trigger()).toHaveClass('h-11');
    expect(within(trigger()).getByText('2')).toBeInTheDocument();
  });

  it('applies the date range and guest type, keeping the search and resetting the page', async () => {
    render(<FiltersDrawer state={S({ q: 'ana', page: 3 })} />);
    await userEvent.click(trigger());
    const drawer = await screen.findByRole('dialog', { name: 'Filtros avanzados' });
    fireEvent.change(within(drawer).getByLabelText('Desde'), { target: { value: '2030-01-01' } });
    fireEvent.change(within(drawer).getByLabelText('Hasta'), { target: { value: '2030-01-31' } });
    await userEvent.click(within(drawer).getByRole('radio', { name: /Familia/ }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar filtros' }));
    expect(router.push).toHaveBeenCalledWith(
      '/admin/reservations?q=ana&from=2030-01-01&to=2030-01-31&guest=family',
      { scroll: false },
    );
  });

  it('rejects a reversed range', async () => {
    render(<FiltersDrawer state={DEFAULT_STATE} />);
    await userEvent.click(trigger());
    const drawer = await screen.findByRole('dialog', { name: 'Filtros avanzados' });
    fireEvent.change(within(drawer).getByLabelText('Desde'), { target: { value: '2030-02-01' } });
    fireEvent.change(within(drawer).getByLabelText('Hasta'), { target: { value: '2030-01-01' } });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar filtros' }));
    expect(within(drawer).getByRole('alert')).toHaveTextContent('La fecha final debe ser igual o posterior a la inicial.');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('"Restablecer" clears the advanced filters', async () => {
    render(<FiltersDrawer state={S({ from: '2030-01-01', guest: 'family' })} />);
    await userEvent.click(trigger());
    const drawer = await screen.findByRole('dialog', { name: 'Filtros avanzados' });
    expect(within(drawer).getByLabelText('Desde')).toHaveValue('2030-01-01');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Restablecer' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar filtros' }));
    expect(router.push).toHaveBeenCalledWith('/admin/reservations', { scroll: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/filters-drawer`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlideOver } from '@/components/admin/slide-over';
import { ADMIN_ACTION, ADMIN_INPUT, DIALOG_ACTION } from '@/components/admin/ui-constants';
import { cn } from '@/lib/utils';
import { reservationsHref, type GuestType, type ReservationsState } from '../_lib/search-params';

const GUEST_OPTIONS: { value: GuestType | ''; label: string; hint: string }[] = [
  { value: '', label: 'Todos', hint: 'Cualquier tamaño de grupo' },
  { value: 'individual', label: 'Individual', hint: '1 persona' },
  { value: 'family', label: 'Familia', hint: '2 o más personas' },
];

/** Advanced filters (md2 §2): visit date range and guest type, applied to the URL. */
export function FiltersDrawer(props: { state: ReservationsState }) {
  const { state } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(state.from);
  const [to, setTo] = useState(state.to);
  const [guest, setGuest] = useState<GuestType | ''>(state.guest);
  const [error, setError] = useState<string | null>(null);
  const count = [state.from, state.to, state.guest].filter(Boolean).length;

  function openDrawer() {
    setFrom(state.from);
    setTo(state.to);
    setGuest(state.guest);
    setError(null);
    setOpen(true);
  }

  function reset() {
    setFrom('');
    setTo('');
    setGuest('');
    setError(null);
  }

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (from && to && from > to) {
      setError('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    router.push(reservationsHref(state, { from, to, guest }), { scroll: false });
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" className={cn(ADMIN_ACTION, 'gap-2 bg-white')} onClick={openDrawer}>
        <SlidersHorizontal aria-hidden className="size-4" />
        Filtros
        {count > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1 text-xs font-semibold text-white">
            {count}
          </span>
        )}
      </Button>

      <SlideOver open={open} onOpenChange={setOpen} title="Filtros avanzados">
        <form onSubmit={apply} noValidate className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-navy">Fecha de visita</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from">Desde</Label>
                <Input id="filter-from" type="date" className={ADMIN_INPUT} value={from}
                  max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-to">Hasta</Label>
                <Input id="filter-to" type="date" className={ADMIN_INPUT} value={to}
                  min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-navy">Tipo de grupo</legend>
            {GUEST_OPTIONS.map((o) => (
              <label
                key={o.value || 'all'}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 has-[:checked]:border-teal has-[:checked]:bg-mint"
              >
                <input type="radio" name="guest" value={o.value} checked={guest === o.value}
                  onChange={() => setGuest(o.value)} className="size-4 accent-teal" />
                <span className="font-medium">{o.label}</span>
                <span className="text-sm text-muted-foreground">{o.hint}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className={DIALOG_ACTION} onClick={reset}>Restablecer</Button>
            <Button type="submit" className={DIALOG_ACTION}>Aplicar filtros</Button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/filters-drawer`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_components/filters-drawer.tsx" "src/app/admin/(dashboard)/reservations/_components/filters-drawer.test.tsx"
git commit -m "feat(admin): advanced filters drawer (date range, guest type)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tabla ordenable de escritorio con acciones por fila

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/_components/reservations-data-table.tsx`
- Test: `src/app/admin/(dashboard)/reservations/_components/reservations-data-table.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationsDataTable } from './reservations-data-table';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';
import type { ReservationRow } from '@/lib/db/reservations';

function row(over: Partial<ReservationRow>): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

const rows = [
  row({}),
  row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', status: 'pending_payment' }),
  row({ id: 'c0000000-0000-0000-0000-000000000000', code: 'PP-CCCCC', status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' }),
  row({ id: 'd0000000-0000-0000-0000-000000000000', code: 'PP-DDDDD', status: 'expired' }),
];

function renderTable(state: ReservationsState = DEFAULT_STATE) {
  const handlers = { onDetail: vi.fn(), onResend: vi.fn(), onCheckin: vi.fn() };
  render(<ReservationsDataTable state={state} rows={rows} {...handlers} />);
  return handlers;
}

const rowOf = (code: string) => screen.getByText(code).closest('tr')!;

describe('ReservationsDataTable', () => {
  it('has sortable headers with aria-sort and sort links', () => {
    renderTable();
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'descending');
    for (const name of ['Código', 'Cliente', 'Personas', 'Total', 'Estado']) {
      expect(screen.getByRole('columnheader', { name })).toHaveAttribute('aria-sort', 'none');
    }
    expect(screen.getByRole('link', { name: 'Fecha' })).toHaveAttribute('href', '/admin/reservations?sort=date&dir=asc');
    expect(screen.getByRole('link', { name: 'Total' })).toHaveAttribute('href', '/admin/reservations?sort=total_usd&dir=asc');
  });

  it('reflects the active column and flips it', () => {
    renderTable({ ...DEFAULT_STATE, sort: 'total_usd', dir: 'asc', statuses: ['confirmed'] });
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('link', { name: 'Total' }))
      .toHaveAttribute('href', '/admin/reservations?status=confirmed&sort=total_usd&dir=desc');
  });

  it('shows date, client, people, totals and the status pill', () => {
    renderTable();
    const r = within(rowOf('PP-AAAAA'));
    expect(r.getByText(/15 ene/)).toHaveClass('first-letter:uppercase');
    expect(r.getByText('Ana Pérez')).toBeInTheDocument();
    expect(r.getByText('V-12345678')).toBeInTheDocument();
    expect(r.getByText('3')).toBeInTheDocument();
    expect(r.getByText('2A 1N')).toBeInTheDocument();
    expect(r.getByText('$35.00')).toBeInTheDocument();
    expect(r.getByText('Bs. 1277.50')).toBeInTheDocument();
    expect(within(rowOf('PP-CCCCC')).getByText('Ingresó 10:15 a. m.')).toBeInTheDocument();
  });

  it('offers check-in, resend and detail for confirmed rows (44px icons)', async () => {
    const h = renderTable();
    const checkin = screen.getByRole('button', { name: 'Check-in PP-AAAAA' });
    expect(checkin).toHaveClass('size-11');
    await userEvent.click(checkin);
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar voucher PP-AAAAA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle PP-AAAAA' }));
    expect(h.onCheckin).toHaveBeenCalledWith(rows[0].id);
    expect(h.onResend).toHaveBeenCalledWith(rows[0].id);
    expect(h.onDetail).toHaveBeenCalledWith(rows[0].id);
  });

  it('pending rows offer "Verificar" (opens detail) and no resend/check-in', async () => {
    const h = renderTable();
    expect(screen.queryByRole('button', { name: 'Reenviar voucher PP-BBBBB' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check-in PP-BBBBB' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Verificar pago de PP-BBBBB' }));
    expect(h.onDetail).toHaveBeenCalledWith(rows[1].id);
  });

  it('checked-in rows can resend but not check in; expired rows only show detail', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Reenviar voucher PP-CCCCC' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-in PP-CCCCC' })).toBeNull();
    expect(within(rowOf('PP-DDDDD')).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Ver detalle PP-DDDDD']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/reservations-data-table`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Mail, Ticket } from 'lucide-react';
import { StatusPill } from '@/components/admin/status-pill';
import { ADMIN_ICON_ACTION } from '@/components/admin/ui-constants';
import type { ReservationRow } from '@/lib/db/reservations';
import { shortDateEs } from '@/lib/dates';
import { partyShort } from '@/lib/party';
import { cn } from '@/lib/utils';
import { ariaSort, sortHref, type ReservationsState, type SortKey } from '../_lib/search-params';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'date', label: 'Fecha' },
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Cliente' },
  { key: 'guests', label: 'Personas', numeric: true },
  { key: 'total_usd', label: 'Total', numeric: true },
  { key: 'status', label: 'Estado' },
];

const ICON_BUTTON = cn(
  ADMIN_ICON_ACTION,
  'grid cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors motion-reduce:transition-none',
  'hover:bg-slate-100 hover:text-navy focus-visible:outline-2 focus-visible:outline-teal',
);

export interface RowActions {
  onDetail: (id: string) => void;
  onResend: (id: string) => void;
  onCheckin: (id: string) => void;
}

function SortIcon(props: { sort: 'ascending' | 'descending' | 'none' }) {
  if (props.sort === 'ascending') return <ArrowUp aria-hidden className="size-3.5" />;
  if (props.sort === 'descending') return <ArrowDown aria-hidden className="size-3.5" />;
  return <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />;
}

/** Desktop reservations table (md2 §4): URL-sorted columns, clean rows, inline 44px actions. */
export function ReservationsDataTable(props: { state: ReservationsState; rows: ReservationRow[] } & RowActions) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Reservas. Pulsa un encabezado para ordenar.</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          {COLUMNS.map((c) => {
            const sort = ariaSort(props.state, c.key);
            return (
              <th key={c.key} scope="col" aria-sort={sort} className={cn('px-3 py-1 font-semibold', c.numeric && 'text-right')}>
                <Link
                  href={sortHref(props.state, c.key)}
                  scroll={false}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1 rounded-md hover:text-navy focus-visible:outline-2 focus-visible:outline-teal',
                    sort !== 'none' && 'text-navy',
                  )}
                >
                  {c.label}
                  <SortIcon sort={sort} />
                </Link>
              </th>
            );
          })}
          <th scope="col" className="px-3 py-1 text-right font-semibold">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.id} data-testid="res-table-row" className="border-b border-slate-100 transition-colors motion-reduce:transition-none hover:bg-slate-50">
            <td className="whitespace-nowrap px-3 py-2">
              <span className="block first-letter:uppercase">{shortDateEs(r.date)}</span>
            </td>
            <td className="px-3 py-2 font-mono font-semibold">{r.code}</td>
            <td className="px-3 py-2">
              <p className="font-medium text-slate-900">{r.first_name} {r.last_name}</p>
              <p className="text-xs text-muted-foreground">{r.id_type}-{r.id_number}</p>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              <p className="font-medium">{r.adults + r.children}</p>
              <p className="text-xs text-muted-foreground">{partyShort(r.adults, r.children)}</p>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              <p className="font-medium">${Number(r.total_usd).toFixed(2)}</p>
              {r.total_ves != null && (
                <p className="text-xs text-muted-foreground">Bs. {Number(r.total_ves).toFixed(2)}</p>
              )}
            </td>
            <td className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill reservation={r} />
                {r.status === 'pending_payment' && (
                  <button
                    type="button"
                    aria-label={`Verificar pago de ${r.code}`}
                    onClick={() => props.onDetail(r.id)}
                    className="min-h-11 cursor-pointer rounded-lg px-2 text-xs font-semibold text-amber-900 underline underline-offset-4 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-teal"
                  >
                    Verificar
                  </button>
                )}
              </div>
            </td>
            <td className="px-3 py-1">
              <div className="flex justify-end gap-1">
                {r.status === 'confirmed' && (
                  <button type="button" className={ICON_BUTTON} aria-label={`Check-in ${r.code}`} title="Check-in"
                    onClick={() => props.onCheckin(r.id)}>
                    <Ticket aria-hidden className="size-5" />
                  </button>
                )}
                {(r.status === 'confirmed' || r.status === 'checked_in') && (
                  <button type="button" className={ICON_BUTTON} aria-label={`Reenviar voucher ${r.code}`} title="Reenviar voucher"
                    onClick={() => props.onResend(r.id)}>
                    <Mail aria-hidden className="size-5" />
                  </button>
                )}
                <button type="button" className={ICON_BUTTON} aria-label={`Ver detalle ${r.code}`} title="Ver detalle"
                  onClick={() => props.onDetail(r.id)}>
                  <Eye aria-hidden className="size-5" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/reservations-data-table`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_components/reservations-data-table.tsx" "src/app/admin/(dashboard)/reservations/_components/reservations-data-table.test.tsx"
git commit -m "feat(admin): sortable reservations table with row quick actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `ReservationsView` (orquestador cliente)

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/_components/reservations-view.tsx`
- Test: `src/app/admin/(dashboard)/reservations/_components/reservations-view.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  adminCheckIn: vi.fn(),
  adminResendVoucher: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('@/app/admin/actions', () => ({
  adminCheckIn: mocks.adminCheckIn,
  adminResendVoucher: mocks.adminResendVoucher,
}));

import { ReservationsView } from './reservations-view';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}
const rows = [row(), row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', status: 'pending_payment' })];

function renderView(over: { state?: Partial<ReservationsState>; rows?: ReservationRow[]; total?: number } = {}) {
  const list = over.rows ?? rows;
  render(
    <ReservationsView
      state={{ ...DEFAULT_STATE, ...over.state }}
      rows={list}
      total={over.total ?? list.length}
      today={TODAY}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ReservationsView', () => {
  it('renders the heading, filters, desktop table and mobile cards for the same rows', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Buscar reservas' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Filtrar por estado' })).toBeInTheDocument();
    expect(screen.getAllByTestId('res-table-row')).toHaveLength(2);
    expect(screen.getAllByTestId('res-row')).toHaveLength(2);
  });

  it('wires the shared pagination with the current filters', () => {
    renderView({ state: { statuses: ['confirmed'], page: 2 }, total: 42 });
    expect(screen.getByText('Mostrando 11–20 de 42 reservas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Página siguiente' }))
      .toHaveAttribute('href', '/admin/reservations?status=confirmed&page=3&pageSize=10');
  });

  it('resends the voucher from a row and confirms with a toast', async () => {
    mocks.adminResendVoucher.mockResolvedValue({ ok: true });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar voucher PP-AAAAA' }));
    expect(mocks.adminResendVoucher).toHaveBeenCalledWith(rows[0].id);
    expect(await screen.findByRole('status')).toHaveTextContent('Voucher reenviado por correo');
  });

  it('shows the server message when resending fails', async () => {
    mocks.adminResendVoucher.mockResolvedValue({ ok: false, message: 'Reserva no reenviable.' });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar voucher PP-AAAAA' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Reserva no reenviable.');
  });

  it('checks in through CheckinDialog, then refreshes the list', async () => {
    mocks.adminCheckIn.mockResolvedValue({ ok: true });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Check-in PP-AAAAA' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar check-in' }));
    expect(mocks.adminCheckIn).toHaveBeenCalledWith(rows[0].id);
    expect(mocks.router.refresh).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Check-in aprobado');
  });

  it('opens the detail drawer with the payment reference', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle PP-AAAAA' }));
    const drawer = await screen.findByRole('dialog', { name: 'Detalle de la reserva' });
    expect(within(drawer).getByText('REF-1')).toBeInTheDocument();
  });

  it('shows an empty state with a link to clear the filters', () => {
    renderView({ state: { q: 'zzz' }, rows: [], total: 0 });
    expect(screen.getByText('No hay reservas que coincidan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Limpiar filtros' })).toHaveAttribute('href', '/admin/reservations');
    expect(screen.getByText('Sin reservas')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components/reservations-view`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
import { CheckinDialog } from '@/components/admin/checkin-dialog';
import { Pagination } from '@/components/admin/pagination';
import { ReservationCard } from '@/components/admin/reservation-card';
import { ReservationDetailDialog } from '@/components/admin/reservation-detail-dialog';
import { Toast } from '@/components/ui/toast';
import type { ReservationRow } from '@/lib/db/reservations';
import {
  RESERVATIONS_PATH, activeFilters, clearFiltersHref, stateToParams, type ReservationsState,
} from '../_lib/search-params';
import { ActiveFilters, StatusChips } from './filter-chips';
import { FiltersDrawer } from './filters-drawer';
import { ReservationsDataTable } from './reservations-data-table';
import { SearchBox } from './search-box';

type ToastState = { kind: 'success' | 'error'; message: string } | null;

export function ReservationsView(props: {
  state: ReservationsState;
  rows: ReservationRow[];
  total: number;
  /** Caracas date, for CheckinDialog's wrong-date warning. */
  today: string;
}) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const detail = props.rows.find((r) => r.id === detailId) ?? null;
  const checkin = props.rows.find((r) => r.id === checkinId) ?? null;
  const filtered = activeFilters(props.state).length > 0;

  async function resend(id: string) {
    const res = await adminResendVoucher(id);
    setToast(res.ok
      ? { kind: 'success', message: 'Voucher reenviado por correo' }
      : { kind: 'error', message: res.message ?? 'No se pudo reenviar el correo.' });
  }

  async function approve(id: string) {
    const res = await adminCheckIn(id);
    setToast(res.ok
      ? { kind: 'success', message: 'Check-in aprobado' }
      : { kind: 'error', message: res.message ?? 'No se pudo registrar la entrada.' });
    // adminCheckIn only revalidates /admin; refresh this list ourselves.
    if (res.ok) router.refresh();
    return res;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="font-heading text-2xl font-extrabold text-navy">Reservas</h1>
        <p className="text-sm text-muted-foreground">Busca, filtra y gestiona todas las reservas.</p>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          <SearchBox state={props.state} />
          <FiltersDrawer state={props.state} />
        </div>
        <StatusChips state={props.state} />
        <ActiveFilters state={props.state} />
      </div>

      <section aria-label="Resultados" className="rounded-2xl border border-slate-200 bg-white">
        {props.rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-semibold text-navy">No hay reservas que coincidan.</p>
            {filtered && (
              <Link
                href={clearFiltersHref(props.state)}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4"
              >
                Limpiar filtros
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <ReservationsDataTable
                state={props.state}
                rows={props.rows}
                onDetail={setDetailId}
                onResend={resend}
                onCheckin={setCheckinId}
              />
            </div>
            <ul className="space-y-2 p-3 md:hidden">
              {props.rows.map((r) => (
                <li key={r.id}>
                  <ReservationCard reservation={r} onDetail={setDetailId} onResend={resend} onCheckin={setCheckinId} />
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="sticky bottom-0 z-10 rounded-b-2xl bg-white/95 px-4 pb-3 backdrop-blur">
          <Pagination
            pathname={RESERVATIONS_PATH}
            params={stateToParams(props.state)}
            page={props.state.page}
            pageSize={props.state.pageSize}
            total={props.total}
            noun="reservas"
          />
        </div>
      </section>

      {detail && (
        <ReservationDetailDialog
          reservation={detail}
          open
          onOpenChange={(o) => { if (!o) setDetailId(null); }}
          onResend={resend}
          onStartCheckin={() => { setDetailId(null); setCheckinId(detail.id); }}
        />
      )}
      {checkin && (
        <CheckinDialog
          reservation={checkin}
          today={props.today}
          open
          onOpenChange={(o) => { if (!o) setCheckinId(null); }}
          onApprove={approve}
        />
      )}
      <Toast kind={toast?.kind ?? 'success'} message={toast?.message ?? null} onDismiss={dismissToast} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/_components`
Expected: PASS (todos los tests de `_components`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/_components/reservations-view.tsx" "src/app/admin/(dashboard)/reservations/_components/reservations-view.test.tsx"
git commit -m "feat(admin): reservations view with row actions, toast and pagination

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Página server `/admin/reservations`

**Files:**
- Create: `src/app/admin/(dashboard)/reservations/page.tsx`
- Test: `src/app/admin/(dashboard)/reservations/page.test.tsx`

Next 16: `searchParams` es una **Promise** de `{ [key: string]: string | string[] | undefined }` (ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`). `redirect()` lanza; la página no debe capturarlo. El acceso ya lo valida el layout y `adminSearchReservations` vuelve a llamar `requireAdmin()`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminSearchReservations: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); }),
}));
vi.mock('@/app/admin/actions', () => ({ adminSearchReservations: mocks.adminSearchReservations }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('./_components/reservations-view', () => ({ ReservationsView: () => null }));

import AdminReservationsPage, { metadata } from './page';
import { DEFAULT_STATE } from './_lib/search-params';

type Props = { state: unknown; rows: unknown; total: number; today: string };
async function renderPage(sp: Record<string, string | string[] | undefined>) {
  const el = await AdminReservationsPage({ searchParams: Promise.resolve(sp) });
  return (el as unknown as { props: Props }).props;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminSearchReservations.mockResolvedValue({ rows: [], total: 0 });
});

describe('/admin/reservations page', () => {
  it('has a title', () => {
    expect(metadata.title).toBe('Reservas');
  });

  it('searches with the state parsed from the URL', async () => {
    mocks.adminSearchReservations.mockResolvedValue({ rows: [{ id: 'x' }], total: 30 });
    const props = await renderPage({ q: 'ana', status: 'pending_payment', sort: 'name', page: '2' });
    expect(mocks.adminSearchReservations).toHaveBeenCalledWith({
      q: 'ana', statuses: ['pending_payment'], sort: { by: 'name', dir: 'asc' }, page: 2, pageSize: 10,
    });
    expect(props.state).toEqual({ ...DEFAULT_STATE, q: 'ana', statuses: ['pending_payment'], sort: 'name', dir: 'asc', page: 2 });
    expect(props.rows).toEqual([{ id: 'x' }]);
    expect(props.total).toBe(30);
    expect(props.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to defaults on invalid params instead of failing', async () => {
    const props = await renderPage({ page: 'abc', pageSize: '7', status: 'nope', from: '2030-13-01', sort: 'x', dir: 'y' });
    expect(mocks.adminSearchReservations).toHaveBeenCalledWith({ sort: { by: 'date', dir: 'desc' }, page: 1, pageSize: 10 });
    expect(props.state).toEqual(DEFAULT_STATE);
  });

  it('redirects a page past the end to the last page, keeping filters', async () => {
    mocks.adminSearchReservations.mockResolvedValue({ rows: [], total: 15 });
    await expect(renderPage({ page: '9', status: 'confirmed' }))
      .rejects.toThrow('NEXT_REDIRECT /admin/reservations?status=confirmed&page=2');
  });

  it('redirects to page 1 when there are no results at all', async () => {
    await expect(renderPage({ page: '3' })).rejects.toThrow('NEXT_REDIRECT /admin/reservations');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/page`
Expected: FAIL (import `./page` no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminSearchReservations } from '@/app/admin/actions';
import { todayCaracas } from '@/lib/dates';
import { ReservationsView } from './_components/reservations-view';
import {
  lastPage, parseReservationsParams, reservationsHref, type RawSearchParams,
} from './_lib/search-params';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reservas' };

/** Every reservation, searchable and filterable. The URL is the state (see _lib/search-params). */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { state, query } = parseReservationsParams(await searchParams);
  const { rows, total } = await adminSearchReservations(query);

  const last = lastPage(total, state.pageSize);
  if (state.page > last) redirect(reservationsHref(state, { page: last }));

  return <ReservationsView state={state} rows={rows} total={total} today={todayCaracas()} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run reservations/page && npx tsc --noEmit`
Expected: PASS (5 tests) y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/reservations/page.tsx" "src/app/admin/(dashboard)/reservations/page.test.tsx"
git commit -m "feat(admin): /admin/reservations server page driven by the URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Navegación — `Reservas` lista y campana a pendientes

**Files:**
- Modify: `src/components/admin/nav-config.ts:28` (ítem Reservas)
- Modify: `src/components/admin/topbar.tsx:13-14` (`PENDING_HREF`)
- Test: `src/components/admin/nav-config.test.ts`, `src/components/admin/topbar.test.tsx`, `src/components/admin/admin-shell.test.tsx`

- [ ] **Step 1: Update the tests (failing)**

`src/components/admin/nav-config.test.ts`:
- Cambia el título `'declares every admin route in its group, with only Hoy and Configuración ready'` por `'declares every admin route in its group, with Hoy, Reservas and Configuración ready'`.
- Cambia `{ href: '/admin/reservations', label: 'Reservas', ownerOnly: false, ready: false },` por `{ href: '/admin/reservations', label: 'Reservas', ownerOnly: false, ready: true },`.
- En `'shows an owner only the ready items and drops empty groups'` cambia `expect(hrefs(groups)).toEqual(['/admin', '/admin/settings']);` por `expect(hrefs(groups)).toEqual(['/admin', '/admin/reservations', '/admin/settings']);`.
- En `'hides owner-only items from an operator'` cambia `expect(hrefs(groups)).toEqual(['/admin']);` por `expect(hrefs(groups)).toEqual(['/admin', '/admin/reservations']);`.

`src/components/admin/topbar.test.tsx`: reemplaza
```tsx
  it('links to the admin home with the pending count', () => {
    render(<PendingBell count={3} />);
    const bell = screen.getByRole('link', { name: '3 pagos pendientes por verificar' });
    expect(bell).toHaveAttribute('href', '/admin');
```
por
```tsx
  it('links to the pending reservations with the pending count', () => {
    render(<PendingBell count={3} />);
    const bell = screen.getByRole('link', { name: '3 pagos pendientes por verificar' });
    expect(bell).toHaveAttribute('href', '/admin/reservations?status=pending_payment');
```

`src/components/admin/admin-shell.test.tsx`:
- En `'renders brand, owner nav, profile, topbar and content'`, debajo de la línea de `'Configuración'` añade:
```tsx
    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('href', '/admin/reservations');
```
- En `'does not render routes that are not ready yet'` cambia `for (const name of ['Reservas', 'Transacciones C2P', 'Tasas BCV', 'Auditoría']) {` por `for (const name of ['Transacciones C2P', 'Tasas BCV', 'Auditoría']) {`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/nav-config src/components/admin/topbar src/components/admin/admin-shell`
Expected: FAIL (Reservas aún `ready: false`; bell aún `/admin`).

- [ ] **Step 3: Implement**

En `src/components/admin/nav-config.ts` cambia:
```ts
      { href: '/admin/reservations', label: 'Reservas', icon: CalendarDays, ready: false },
```
por:
```ts
      { href: '/admin/reservations', label: 'Reservas', icon: CalendarDays, ready: true },
```

En `src/components/admin/topbar.tsx` cambia:
```ts
/** Pending payments are reviewed from "Hoy" until PR 10 ships /admin/reservations. */
export const PENDING_HREF = '/admin';
```
por:
```ts
/** The bell opens the reservations list filtered to payments awaiting verification (roadmap §2). */
export const PENDING_HREF = '/admin/reservations?status=pending_payment';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/nav-config.ts src/components/admin/nav-config.test.ts src/components/admin/topbar.tsx src/components/admin/topbar.test.tsx src/components/admin/admin-shell.test.tsx
git commit -m "feat(admin): enable Reservas in the nav and point the bell to pending

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: `CommandSearch` (⌘K / Ctrl+K)

**Files:**
- Create: `src/components/admin/command-search.tsx`
- Test: `src/components/admin/command-search.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import {
  CommandSearch, CommandSearchButton, commandSearchHref, isCommandK, shortcutLabel,
} from './command-search';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CommandSearchButton onClick={() => setOpen(true)} />
      <CommandSearch open={open} onOpenChange={setOpen} />
    </>
  );
}

const field = () => screen.getByRole('textbox', { name: 'Nombre, código o cédula' });

beforeEach(() => router.push.mockReset());

describe('command search helpers', () => {
  it('builds the reservations URL from the query', () => {
    expect(commandSearchHref('  ana pérez ')).toBe('/admin/reservations?q=ana+p%C3%A9rez');
    expect(commandSearchHref('   ')).toBe('/admin/reservations');
  });

  it('labels the shortcut per platform', () => {
    expect(shortcutLabel('MacIntel')).toBe('⌘K');
    expect(shortcutLabel('iPhone')).toBe('⌘K');
    expect(shortcutLabel('Win32')).toBe('Ctrl K');
  });

  it('recognizes only Cmd+K / Ctrl+K', () => {
    const k = { key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
    expect(isCommandK({ ...k, metaKey: true })).toBe(true);
    expect(isCommandK({ ...k, ctrlKey: true, key: 'K' })).toBe(true);
    expect(isCommandK(k)).toBe(false);
    expect(isCommandK({ ...k, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isCommandK({ ...k, ctrlKey: true, key: 'j' })).toBe(false);
  });
});

describe('CommandSearch', () => {
  it('opens with Ctrl+K or Cmd+K and focuses the search field', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Buscar reservas' })).toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it('opens with Cmd+K too and ignores plain K', async () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'k' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(await screen.findByRole('dialog', { name: 'Buscar reservas' })).toBeInTheDocument();
  });

  it('Enter navigates to /admin/reservations?q=… and closes', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar reservas' }));
    await screen.findByRole('dialog', { name: 'Buscar reservas' });
    await userEvent.type(field(), 'PP-AB12{Enter}');
    expect(router.push).toHaveBeenCalledWith('/admin/reservations?q=PP-AB12');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Escape closes without navigating', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar reservas' }));
    await screen.findByRole('dialog', { name: 'Buscar reservas' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.push).not.toHaveBeenCalled();
  });

  it('the trigger is a 44px button that announces the shortcut', () => {
    render(<CommandSearchButton onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Buscar reservas' });
    expect(button).toHaveClass('min-h-11');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/command-search`
Expected: FAIL (import no resuelto).

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Dialog, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ADMIN_INPUT } from './ui-constants';

/** Where the global search sends the operator (roadmap §2: ⌘K → /admin/reservations?q=…). */
export function commandSearchHref(q: string): string {
  const term = q.trim();
  return term ? `/admin/reservations?${new URLSearchParams({ q: term })}` : '/admin/reservations';
}

/** ⌘K on Apple keyboards, Ctrl K elsewhere. */
export function shortcutLabel(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K';
}

export function isCommandK(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
}

const noSubscribe = () => () => {};

/** Server and first client render say "Ctrl K"; the client then switches to ⌘K on Apple devices. */
function useShortcutLabel(): string {
  return useSyncExternalStore(noSubscribe, () => shortcutLabel(navigator.platform), () => 'Ctrl K');
}

/** Visible entry point for the global search (sidebar and mobile bar, navy background). */
export function CommandSearchButton(props: { onClick: () => void; compact?: boolean }) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Buscar reservas"
      aria-keyshortcuts="Meta+K Control+K"
      title={`Buscar reservas (${shortcut})`}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl text-sm text-white/70 transition-colors motion-reduce:transition-none',
        'hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal',
        props.compact ? 'size-11 shrink-0 justify-center self-center' : 'w-full border border-white/15 px-3',
      )}
    >
      <Search aria-hidden className="size-5 shrink-0" />
      {!props.compact && (
        <>
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="rounded-md border border-white/20 px-1.5 py-0.5 font-sans text-xs">{shortcut}</kbd>
        </>
      )}
    </button>
  );
}

/** Global ⌘K / Ctrl+K reservation search: type, Enter, land on the filtered list. */
export function CommandSearch(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { onOpenChange } = props;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isCommandK(e)) return;
      e.preventDefault();
      onOpenChange(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(commandSearchHref(q));
    setQ('');
    onOpenChange(false);
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => onOpenChange(open)}>
      <DialogPopup initialFocus={inputRef} className="top-[12vh] w-[min(36rem,calc(100vw-2rem))] translate-y-0 p-3">
        <DialogTitle className="sr-only">Buscar reservas</DialogTitle>
        <form role="search" onSubmit={submit} className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            aria-label="Nombre, código o cédula"
            placeholder="Nombre, código PP-XXXX o cédula…"
            enterKeyHint="search"
            autoComplete="off"
            className={cn(ADMIN_INPUT, 'pl-11')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <p className="mt-2 px-1 text-xs text-muted-foreground">Enter para buscar en Reservas · Esc para cerrar</p>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/command-search`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/command-search.tsx src/components/admin/command-search.test.tsx
git commit -m "feat(admin): global Cmd/Ctrl+K reservation search dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Montar ⌘K en `AdminShell`

**Files:**
- Modify: `src/components/admin/admin-shell.tsx` (archivo completo)
- Test: `src/components/admin/admin-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

En `src/components/admin/admin-shell.test.tsx` cambia el import de testing-library a:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
```
y añade dentro de `describe('AdminShell', …)`:
```tsx
  it('opens the global reservation search with Ctrl+K', async () => {
    renderShell('operator');
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Buscar reservas' })).toBeInTheDocument();
  });

  it('offers visible 44px search buttons (sidebar and mobile bar)', async () => {
    renderShell('owner');
    const buttons = screen.getAllByRole('button', { name: 'Buscar reservas' });
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b).toHaveClass('min-h-11');
    await userEvent.click(buttons[0]);
    expect(await screen.findByRole('dialog', { name: 'Buscar reservas' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/admin-shell`
Expected: FAIL (no hay diálogo ni botones de búsqueda).

- [ ] **Step 3: Implement**

Reemplaza **todo** `src/components/admin/admin-shell.tsx`:
```tsx
// src/components/admin/admin-shell.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { AdminDrawer } from './admin-drawer';
import { AdminNavLinks } from './admin-nav-links';
import { CommandSearch, CommandSearchButton } from './command-search';
import { visibleNavGroups } from './nav-config';
import { ProfilePill } from './profile-pill';
import { Topbar } from './topbar';
import type { ShellStatus } from './topbar-data';
import { ADMIN_ICON_ACTION } from './ui-constants';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

export interface AdminUser {
  email: string;
  role: AdminRole;
}

export function AdminShell(props: { user: AdminUser; status: ShellStatus; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [searchOpen, setSearchOpen] = useState(false);
  const groups = visibleNavGroups(props.user.role);

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Desktop sidebar */}
      <aside
        aria-label="Menú lateral"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col gap-6 bg-navy p-3 transition-[width] duration-200 motion-reduce:transition-none md:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
          <Logo variant="chip" className={collapsed ? 'h-6 w-auto' : 'h-9 w-auto'} sizes="112px" />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar-nav"
            className={cn(
              ADMIN_ICON_ACTION,
              'grid cursor-pointer place-items-center rounded-xl text-white/70 transition-colors motion-reduce:transition-none',
              'hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal',
            )}
          >
            {collapsed
              ? <PanelLeftOpen aria-hidden className="size-5" />
              : <PanelLeftClose aria-hidden className="size-5" />}
          </button>
        </div>
        <CommandSearchButton onClick={() => setSearchOpen(true)} compact={collapsed} />
        <div id="admin-sidebar-nav" className="min-h-0 flex-1 overflow-y-auto">
          <AdminNavLinks groups={groups} pathname={pathname} collapsed={collapsed} />
        </div>
        <ProfilePill email={props.user.email} role={props.user.role} collapsed={collapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-navy px-3 py-2 md:hidden">
        <Logo variant="chip" className="h-7 w-auto" sizes="96px" />
        <div className="flex items-center gap-1">
          <CommandSearchButton onClick={() => setSearchOpen(true)} compact />
          <AdminDrawer groups={groups} pathname={pathname} email={props.user.email} role={props.user.role} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar status={props.status} />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>

      {/* Global ⌘K / Ctrl+K reservation search (roadmap §2). */}
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin`
Expected: PASS (incluye `admin-drawer`, `admin-nav-links`, `topbar`, `admin-shell`).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-shell.tsx src/components/admin/admin-shell.test.tsx
git commit -m "feat(admin): mount the Cmd/Ctrl+K search in the admin shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: e2e `admin-reservations.spec.ts`

**Files:**
- Create: `e2e/admin-reservations.spec.ts`

El proyecto Playwright es `mobile-chrome` (Pixel 7): se ven las tarjetas (`data-testid="res-row"`), no la tabla. El spec siembra una reserva propia con fecha +400 días (no choca con `booking.spec.ts`, que usa +21 días) y la borra en `afterAll`. No prueba "Reenviar voucher" (el entorno e2e usa `RESEND_API_KEY` ficticio).

- [ ] **Step 1: Write the spec**

```ts
// e2e/admin-reservations.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ws from 'ws';

/**
 * Local admin login, read at runtime and never committed. Point
 * ADMIN_CREDENTIALS_FILE at it when running from a worktree; without the file
 * (CI) the whole spec is skipped.
 */
function readAdminCredentials(): { email: string; password: string } | null {
  const file = process.env.ADMIN_CREDENTIALS_FILE
    ?? path.join(process.cwd(), 'supabase', '.local-admin-credentials.txt');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const email = /^email:\s*(\S+)/m.exec(text)?.[1];
  const password = /^password:\s*(.+)$/m.exec(text)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

const creds = readAdminCredentials();
test.skip(!creds, 'Local admin credentials file not found');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } },
);

const CODE = `PP-Z${Date.now().toString(36).slice(-4).toUpperCase()}`;
let seededId: string | null = null;

test.beforeAll(async () => {
  if (!creds) return;
  const d = new Date();
  d.setDate(d.getDate() + 400);
  const { data, error } = await supabase.from('reservations').insert({
    code: CODE, date: d.toISOString().slice(0, 10),
    first_name: 'Zoe', last_name: 'Pruebas', email: 'zoe.e2e@example.com',
    id_type: 'V', id_number: '99887766', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'E2E-REF-10',
  }).select('id').single();
  if (error) throw new Error(error.message);
  seededId = data.id;
});

test.afterAll(async () => {
  if (seededId) await supabase.from('reservations').delete().eq('id', seededId);
});

async function login(page: Page, next: string) {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.locator('#email').fill(creds!.email);
  await page.locator('#password').fill(creds!.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => url.pathname === next);
}

test('search, status chip, dismissible filter and detail drawer', async ({ page }) => {
  await login(page, '/admin/reservations');
  await expect(page.getByRole('heading', { level: 1, name: 'Reservas' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Buscar reservas' }).fill(CODE);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${CODE}`));
  const card = page.getByTestId('res-row').filter({ hasText: CODE });
  await expect(card).toBeVisible();

  await page.getByRole('link', { name: 'Confirmadas', exact: true }).click();
  await expect(page).toHaveURL(/status=confirmed/);
  const chip = page.getByRole('link', { name: 'Quitar filtro Estado: Confirmada' });
  await expect(chip).toBeVisible();
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Ver detalle' }).click();
  const drawer = page.getByRole('dialog', { name: 'Detalle de la reserva' });
  await expect(drawer.getByText('E2E-REF-10')).toBeVisible();
  await drawer.getByRole('button', { name: 'Cerrar panel' }).click();
  await expect(drawer).toBeHidden();

  await chip.click();
  await expect(page).not.toHaveURL(/status=/);
});

test('Ctrl+K opens the global search from any admin page', async ({ page }) => {
  await login(page, '/admin');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Buscar reservas' });
  await expect(dialog).toBeVisible();
  const field = dialog.getByRole('textbox', { name: 'Nombre, código o cédula' });
  await expect(field).toBeFocused();
  await field.fill(CODE);
  await field.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/admin/reservations\\?q=${CODE}$`));
  await expect(page.getByTestId('res-row').filter({ hasText: CODE })).toBeVisible();
});
```

- [ ] **Step 2: Run the spec (inside the lock)**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done
if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy: wait and retry"; else source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ADMIN_CREDENTIALS_FILE=/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt npx playwright test e2e/admin-reservations.spec.ts; fi
rmdir "$L"
```
Expected: `2 passed`. Si falla el login, verifica que el email del archivo esté en `ADMIN_EMAILS` de `.env.local` (no lo cambies en el repo; repórtalo).

- [ ] **Step 3: Verify the skip path**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ADMIN_CREDENTIALS_FILE=/nonexistent npx playwright test e2e/admin-reservations.spec.ts --list`
Expected: lista los 2 tests sin error (el `skip` se aplica en ejecución; con el archivo ausente ambos salen como `skipped`).

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-reservations.spec.ts
git commit -m "test(e2e): cover /admin/reservations and the Ctrl+K search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Verificación final

**Files:** ninguno (sólo arreglos si algo falla).

- [ ] **Step 1: Tipos, lint, unit tests, build**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test && npm run build
```
Expected: `tsc` sin salida; `eslint` sin errores; todos los tests PASS; `next build` compila y lista `ƒ /admin/reservations` como dinámica.

Si el lint marca `react-hooks/set-state-in-render` en `search-box.tsx` (patrón "estado derivado" con guardas `state.q !== seenQ`), confirma que es el patrón documentado por React y, sólo si la regla lo trata como error, cámbialo por un `key` en el padre no es aceptable (perdería el foco al escribir): en su lugar mueve la sincronización a `useEffect(() => { … }, [state.q])` con `// eslint-disable-next-line react-hooks/set-state-in-effect` y una línea explicando por qué.

- [ ] **Step 2: Integración (no toca DB, pero confirma que nada se rompió)**

Run (dentro del lock):
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:integration
rmdir "$L"
```
Expected: PASS.

- [ ] **Step 3: e2e completo (dentro del lock)**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-reservations
if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy: wait and retry"; else source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && ADMIN_CREDENTIALS_FILE=/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt npm run test:e2e; fi
rmdir "$L"
```
Expected: todos los specs PASS (incluidos `booking`, `i18n`, `admin-lang` y el nuevo).

- [ ] **Step 4: Revisión manual rápida (opcional, con `npm run dev -- --port 3100` dentro del lock)**

Comprueba en `/admin/reservations`: orden por cada columna (flecha + `aria-sort`), chips de estado, drawer de filtros, chips activos con ✕ y "Limpiar todo", paginación fija abajo, tarjetas en móvil, campana → `?status=pending_payment`, ⌘K/Ctrl+K desde `/admin`, y que `?page=abc&status=zzz&from=2030-99-01` carga sin error.

- [ ] **Step 5: Commit de arreglos (sólo si hubo cambios)**

```bash
git add -A
git commit -m "fix(admin): address verification findings for reservations page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Autorrevisión

**Cobertura del spec:**
- Página `/admin/reservations` server, URL como estado, `q/status (csv o repetido)/from/to/guest/sort/dir/page/pageSize`, parser zod, nunca 500 por params → Tasks 6–8, 14.
- Buscador command-bar con debounce que actualiza la URL → Task 9.
- Chips Todas · Confirmadas · Ingresaron · Pendientes · Canceladas (= failed+expired) → Tasks 8, 10.
- Filtros avanzados (rango de fechas, tipo de grupo) en drawer → Task 11.
- Chips de filtros activos descartables + "Limpiar todo" → Tasks 8, 10.
- Tabla ordenable (Fecha, Código, Cliente, Personas, Total, Estado) con `aria-sort` y flechas, hover; tarjetas en móvil → Tasks 3, 12, 13.
- Píldoras: confirmed sólida esmeralda con icono; checked_in contorno azul con hora 12h Caracas; pending ámbar con pulso `motion-safe` + "Verificar"; failed/expired gris → Tasks 1, 2, 3, 12.
- Acciones por fila 44px: Reenviar voucher (+toast), Check-in (CheckinDialog), Ver detalle (slide-over con payment_ref, bcv_rate, total_ves, created_at, checked_in_at) y fix `capitalize` → Tasks 4, 5, 12, 13.
- Paginación compartida fija (`noun="reservas"`) → Task 13.
- ⌘K/Ctrl+K en admin-shell + botón visible + accesible (dialog con nombre, foco) → Tasks 16, 17.
- `PENDING_HREF` y `ready: true` → Task 15.
- Tests: parsing (6–8), sort/aria-sort (12), chips URL (10), acciones (12, 13), ⌘K (16, 17), paginación (13), e2e (18).

**Placeholders:** ninguno; cada paso de código trae el código completo y cada comando su salida esperada.

**Consistencia de tipos/nombres:** `ReservationsState`, `DEFAULT_STATE`, `parseReservationsState`, `parseReservationsParams`, `toReservationQuery`, `stateToParams`, `reservationsHref`, `sortHref`, `ariaSort`, `lastPage`, `STATUS_CHIPS`, `activeStatusChip`, `activeFilters`, `clearFiltersHref`, `RESERVATIONS_PATH`, `RawSearchParams` se definen en Tasks 6–8 y se usan igual en 9–14. `StatusPill` (Task 2), `SlideOver` (Task 4), `caracasTime12`/`caracasDateTime12`/`STATUS_ORDER`/`STATUS_NAME_ES` (Task 1), `CommandSearch`/`CommandSearchButton`/`commandSearchHref`/`shortcutLabel`/`isCommandK` (Task 16) coinciden con sus usos.

**Preguntas abiertas para el coordinador:**
1. ¿Se quieren conteos por chip de estado? Requiere 5 `count` extra por render (o una RPC agregada en una migración 0010).
2. ¿El drawer de detalle debe mostrar el rastro de auditoría de la reserva (md2 §4)? Necesitaría filtrar `audit_log` por `target`, que hoy `listAudit` no soporta.
3. "Verificar" abre el detalle (no existe acción de verificación manual de C2P); confirmar que basta.
