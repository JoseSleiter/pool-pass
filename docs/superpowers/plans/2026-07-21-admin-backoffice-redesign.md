# Rediseño del back-office admin — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el panel de administración (vistas Hoy y Configuración) al estilo SaaS de los mockups, con shell + topbar compartidos, métricas/filtros/tarjetas de reserva, modales (Ver detalle, Aprobar check-in, Nueva excepción), backend de excepciones con `motivo`, todo en español y con `cursor:pointer` en cada control.

**Architecture:** Next.js App Router. Los server components (`page.tsx`) cargan datos vía server actions existentes; el filtrado/búsqueda/modales son cliente sobre las filas cargadas. Se agrega un primitivo `Dialog` (Base UI) y un `Toast` ligero, reusados por las vistas. Backend: una columna nueva `reason` en `capacity_overrides` propagada por db → actions → UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, `@base-ui/react` (Dialog/Select), lucide-react, Supabase, Vitest + @testing-library/react + userEvent.

**Spec:** `docs/superpowers/specs/2026-07-21-admin-backoffice-redesign-design.md`

**Convenciones del repo (leer antes de empezar):**
- Tests de componentes: primera línea `// @vitest-environment jsdom`. Imports: `render, screen` de `@testing-library/react`, `userEvent` de `@testing-library/user-event`.
- Comando de test único: `npx vitest run <ruta> -t "<nombre>"`. Suite completa: `npm test`.
- Botones: usar `<Button>` de `@/components/ui/button` (variantes default/outline/secondary/ghost). NUNCA disparar `alert/confirm/prompt` nativos: las confirmaciones son modales `Dialog`.
- Helpers existentes: `longDateEs`, `shortDateEs`, `caracasTime`, `todayCaracas` (`@/lib/dates`); `partyLabel`, `partyShort` (`@/lib/party`); `totalUsd` (`@/lib/money`).
- Commits frecuentes, uno por tarea. Terminar cada mensaje de commit con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Mapa de archivos

**Fase 1 — Primitivos compartidos**
- Create: `src/components/ui/dialog.tsx` — wrapper de `@base-ui/react/dialog` (Root/Trigger/Portal/Backdrop/Popup/Title/Close).
- Create: `src/components/ui/toast.tsx` — toast controlado (success/error) con auto-dismiss.
- Modify: `src/components/ui/button.tsx` — `cursor-pointer` en la clase base.

**Fase 2 — AdminShell + Topbar**
- Modify: `src/components/admin/admin-shell.tsx` — sidebar (brand/nav/cuenta) + `Topbar`, prop `topbar`.
- Modify: `src/app/admin/(dashboard)/layout.tsx` — sin cambios de firma (sigue pasando `email`).
- Modify: `src/app/admin/(dashboard)/page.tsx` y `settings/page.tsx` — pasar contexto de topbar.

**Fase 3 — Vista Hoy**
- Create: `src/components/admin/metric-cards.tsx` — `MetricGrid` + 4 tarjetas.
- Create: `src/components/admin/reservation-card.tsx` — tarjeta de reserva + acciones.
- Create: `src/components/admin/reservation-detail-dialog.tsx` — modal Ver detalle.
- Create: `src/components/admin/checkin-dialog.tsx` — modal Aprobar check-in.
- Modify: `src/components/admin/reservations-table.tsx` — búsqueda + chips + contador + render con `ReservationCard`.
- Modify: `src/components/admin/day-view.tsx` — encabezado, barra de fecha, `MetricGrid`, alertas, toasts.
- Modify: `src/lib/party.ts` — sin cambios (se reutiliza).

**Fase 4 — Vista Configuración**
- Create: `src/components/admin/exception-dialog.tsx` — modal Nueva/Editar excepción.
- Modify: `src/components/admin/settings-form.tsx` — parámetros + vista previa + estados de guardado + lista de excepciones + confirmación de borrado.

**Fase 5 — Backend excepciones**
- Create: `supabase/migrations/0004_override_reason.sql`.
- Modify: `src/lib/db/reservations.ts` — tipo `OverrideRow`, `listOverrides`, `upsertOverride`.
- Modify: `src/app/admin/actions.ts` — `adminUpsertOverride(date, capacity, reason?)`, `adminGetSettings`.

**Fase 6 — Modal QR check-in (reuso) + barrido español/cursor**
- Modify: `src/components/admin/checkin-card.tsx` — mantiene la página QR; ajustes de español si aplica.
- Barrido final de cadenas en español y `cursor-pointer`.

Cada fase deja el panel funcional. Las Fases 1 y 5 no dependen entre sí; las Fases 3 y 4 dependen de la 1. Recomendado en orden: 1 → 5 → 2 → 3 → 4 → 6.

---

## Fase 1 — Primitivos compartidos

### Task 1: `cursor-pointer` global en Button

**Files:**
- Modify: `src/components/ui/button.tsx:6-7`

- [ ] **Step 1: Editar la clase base de `buttonVariants`**

En `src/components/ui/button.tsx`, en el primer argumento de `cva(...)` (la cadena base que empieza con `"group/button inline-flex ...`), agregar `cursor-pointer` justo después de `inline-flex`. Como los botones deshabilitados ya llevan `disabled:pointer-events-none`, no anulan el cursor pero tampoco lo activan (no reciben eventos). Resultado del inicio de la cadena:

```
"group/button inline-flex cursor-pointer shrink-0 items-center justify-center rounded-lg border ...
```

- [ ] **Step 2: Verificar build de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: cursor-pointer on all buttons by default

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Primitivo `Dialog`

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Test: `src/components/ui/dialog.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogClose } from './dialog';

describe('Dialog', () => {
  it('opens on trigger and closes on close button', async () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogPopup>
          <DialogTitle>Título</DialogTitle>
          <DialogClose>Cerrar</DialogClose>
        </DialogPopup>
      </Dialog>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Título')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verlo fallar**

Run: `npx vitest run src/components/ui/dialog.test.tsx`
Expected: FAIL — "Cannot find module './dialog'".

- [ ] **Step 3: Implementar el wrapper (patrón igual a `select.tsx`)**

```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogPopup({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl bg-white p-5 shadow-xl ring-1 ring-foreground/10",
          "transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-extrabold", className)}
      {...props}
    />
  )
}

export { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogClose }
```

- [ ] **Step 4: Ejecutar el test y verlo pasar**

Run: `npx vitest run src/components/ui/dialog.test.tsx`
Expected: PASS. Si `role="dialog"` no aparece por el Portal en jsdom, ajustar el assert a `screen.getByText('Título')` visible (Base UI marca el Popup con `role="dialog"`; mantener el assert principal en el título visible si hiciera falta).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/dialog.test.tsx
git commit -m "feat: add Dialog primitive over @base-ui/react/dialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Primitivo `Toast`

**Files:**
- Create: `src/components/ui/toast.tsx`
- Test: `src/components/ui/toast.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './toast';

describe('Toast', () => {
  it('renders success message with status role', () => {
    render(<Toast kind="success" message="Check-in aprobado" onDismiss={() => {}} />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Check-in aprobado');
  });

  it('renders nothing when message is null', () => {
    const { container } = render(<Toast kind="success" message={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/ui/toast.test.tsx`
Expected: FAIL — "Cannot find module './toast'".

- [ ] **Step 3: Implementar**

```tsx
"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"

export function Toast(props: {
  kind: "success" | "error"
  message: string | null
  onDismiss: () => void
  timeoutMs?: number
}) {
  const { kind, message, onDismiss, timeoutMs = 3000 } = props
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, timeoutMs)
    return () => clearTimeout(t)
  }, [message, onDismiss, timeoutMs])

  if (!message) return null
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg",
        kind === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      )}
    >
      {message}
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/ui/toast.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/toast.tsx src/components/ui/toast.test.tsx
git commit -m "feat: add Toast primitive

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Fase 5 — Backend de excepciones (sin dependencias; se hace temprano)

### Task 4: Migración `reason` en `capacity_overrides`

**Files:**
- Create: `supabase/migrations/0004_override_reason.sql`

- [ ] **Step 1: Crear la migración**

```sql
-- 0004_override_reason.sql
-- Motivo opcional para excepciones de capacidad (p. ej. "Mantenimiento de piscina").
alter table capacity_overrides
  add column if not exists reason text;
```

- [ ] **Step 2: Aplicar la migración local (si hay Supabase local)**

Run: `npx supabase migration up` (o `npx supabase db reset` en entorno local desechable).
Expected: la columna `reason` existe. Si no hay Supabase local disponible, dejar registrado que la migración se aplicará en el entorno correspondiente y continuar (los tests unitarios no tocan la BD real).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_override_reason.sql
git commit -m "feat: add reason column to capacity_overrides

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Propagar `reason` en la capa db

**Files:**
- Modify: `src/lib/db/reservations.ts` (funciones `listOverrides`, `upsertOverride`)

- [ ] **Step 1: Definir el tipo y actualizar `listOverrides`**

En `src/lib/db/reservations.ts`, agregar el tipo exportado y actualizar la firma de retorno:

```ts
export interface OverrideRow {
  date: string;
  capacity: number;
  reason: string | null;
}

export async function listOverrides(): Promise<OverrideRow[]> {
  const { data, error } = await serviceClient()
    .from('capacity_overrides').select('date, capacity, reason').order('date');
  if (error) throw new Error(error.message);
  return data as OverrideRow[];
}
```

- [ ] **Step 2: Actualizar `upsertOverride` para aceptar `reason`**

```ts
export async function upsertOverride(date: string, capacity: number, reason?: string | null): Promise<void> {
  const { error } = await serviceClient()
    .from('capacity_overrides').upsert({ date, capacity, reason: reason ?? null });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: fallará en `src/app/admin/actions.ts`/`settings-form.tsx` que aún usan la firma vieja — se corrige en las Tasks 6 y 15. Confirmar que los errores son SOLO en esos consumidores. Si `npx tsc --noEmit` es demasiado ruidoso, continuar; se cierra en Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/reservations.ts
git commit -m "feat: carry reason through overrides db layer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: Acciones admin con `reason`

**Files:**
- Modify: `src/app/admin/actions.ts` (`adminUpsertOverride`)
- Test: `src/app/admin/actions.test.ts` (existe; agregar caso)

- [ ] **Step 1: Escribir el test que falla**

Abrir `src/app/admin/actions.test.ts` y agregar un test que verifique que `adminUpsertOverride` pasa `reason` a `upsertOverride`. Seguir el patrón de mocking ya presente en ese archivo (revisar cómo mockea `@/lib/db/reservations`). Ejemplo del assert clave:

```ts
it('adminUpsertOverride forwards reason to db', async () => {
  const res = await adminUpsertOverride('2030-02-01', 25, 'Mantenimiento');
  expect(res.ok).toBe(true);
  expect(upsertOverrideMock).toHaveBeenCalledWith('2030-02-01', 25, 'Mantenimiento');
});
```

(Usar el nombre del mock tal como esté declarado en el archivo; si el archivo mockea el módulo completo, referenciar `vi.mocked(upsertOverride)`.)

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/app/admin/actions.test.ts -t "forwards reason"`
Expected: FAIL — la firma actual ignora `reason`.

- [ ] **Step 3: Actualizar `adminUpsertOverride`**

```ts
export async function adminUpsertOverride(
  date: string,
  capacity: number,
  reason?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(capacity) || capacity < 0 || capacity > 10000) {
    return { ok: false, message: 'Valores inválidos.' };
  }
  try {
    await upsertOverride(date, capacity, cleanReason || null);
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch {
    return { ok: false, message: 'No se pudo guardar.' };
  }
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: PASS (todos los casos del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "feat: adminUpsertOverride accepts optional reason

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Fase 2 — AdminShell + Topbar

### Task 7: Refactor de `AdminShell` con sidebar y topbar

**Files:**
- Modify: `src/components/admin/admin-shell.tsx`
- Test: `src/components/admin/admin-shell.test.tsx` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminShell } from './admin-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut: vi.fn() } }) }));

describe('AdminShell', () => {
  it('renders brand, nav, admin account and topbar context', () => {
    render(<AdminShell email="admin@club.com" topbar={<span>Reservas del día</span>}><p>contenido</p></AdminShell>);
    expect(screen.getByText(/Club La Piscina/)).toBeInTheDocument();
    expect(screen.getAllByText(/Hoy/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Configuración/)).toBeInTheDocument();
    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
    expect(screen.getByText('Reservas del día')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/admin-shell.test.tsx`
Expected: FAIL — `AdminShell` aún no acepta prop `topbar` ni muestra "Administrador".

- [ ] **Step 3: Reescribir `admin-shell.tsx`**

Reemplazar el contenido por (conserva `NavLinks`/`LogoutButton` como base, agrega marca/cuenta/topbar). El `Topbar` se renderiza arriba del `children`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { browserClient } from '@/lib/db/browser-client';

const NAV = [
  { href: '/admin', label: 'Hoy', icon: '🏠' },
  { href: '/admin/settings', label: 'Configuración', icon: '⚙️' },
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
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === item.href ? 'bg-sky-700 text-white' : 'text-sky-200 hover:bg-sky-900'
          }`}
        >
          <span aria-hidden>{item.icon}</span>
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
      className="cursor-pointer text-left text-xs text-sky-300 underline underline-offset-2"
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

function AdminAccount() {
  return (
    <div className="mt-auto rounded-xl bg-sky-950/60 p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-sky-400 text-sm font-bold text-sky-950">A</span>
        <span className="text-sm font-semibold text-white">Administrador</span>
      </div>
      <div className="mt-2">
        <LogoutButton />
      </div>
    </div>
  );
}

function Topbar(props: { context: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b bg-white/70 px-4 py-3">
      <div className="min-w-0 truncate text-sm font-semibold text-slate-700">{props.context}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notificaciones"
          className="grid size-9 cursor-pointer place-items-center rounded-full border bg-white text-slate-600 hover:bg-sky-50"
        >
          <Bell className="size-4" />
        </button>
        <span className="flex cursor-pointer items-center gap-2 rounded-full border bg-white px-2 py-1 text-sm">
          <span className="grid size-6 place-items-center rounded-full bg-sky-400 text-xs font-bold text-sky-950">A</span>
          Admin
        </span>
      </div>
    </div>
  );
}

export function AdminShell(props: { email: string; topbar?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 flex-col bg-[#0c4a6e] p-4 md:flex">
        <p className="font-extrabold text-white">🌊 Club La Piscina</p>
        <p className="mb-5 text-xs text-sky-300">Panel de administración</p>
        <NavLinks />
        <AdminAccount />
      </aside>

      {/* Top bar móvil con hamburguesa */}
      <div className="bg-[#0c4a6e] p-3 md:hidden">
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-white">🌊 Admin</p>
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={open}
            className="min-h-11 min-w-11 cursor-pointer rounded-lg text-xl text-white"
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

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar context={props.topbar ?? props.email} />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/admin-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-shell.tsx src/components/admin/admin-shell.test.tsx
git commit -m "feat: shared admin shell with sidebar brand, account and topbar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Pasar contexto de topbar desde las páginas

**Files:**
- Modify: `src/app/admin/(dashboard)/layout.tsx`
- Modify: `src/app/admin/(dashboard)/page.tsx`
- Modify: `src/app/admin/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Permitir `topbar` opcional en el layout**

El layout ya envuelve con `AdminShell`. Como el contexto depende de la página (fecha en Hoy, texto fijo en Config), lo más simple es que cada página renderice su propio encabezado dentro de `children` y el `Topbar` muestre un texto por defecto derivado de la ruta. Para no complicar el layout, dejar `AdminShell` con `topbar` derivado por la propia página vía un componente cliente pequeño NO es necesario: mantener `Topbar` mostrando el contexto por defecto (`props.email`) y poner el título grande y la fecha en el cuerpo de cada página.

Decisión: **no** pasar `topbar` por ahora; el `Topbar` muestra "Panel administrativo" fijo. Editar el default en `admin-shell.tsx` Topbar para usar `props.context` y en `AdminShell` pasar `props.topbar ?? 'Panel administrativo'`.

Cambiar en `admin-shell.tsx`:

```tsx
<Topbar context={props.topbar ?? 'Panel administrativo'} />
```

- [ ] **Step 2: Verificar que el test del shell sigue pasando**

Run: `npx vitest run src/components/admin/admin-shell.test.tsx`
Expected: PASS (el test pasa `topbar` explícito, así que sigue mostrando "Reservas del día").

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-shell.tsx
git commit -m "feat: default topbar context to 'Panel administrativo'

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Fase 3 — Vista Hoy

### Task 9: `MetricGrid` y tarjetas de métricas

**Files:**
- Create: `src/components/admin/metric-cards.tsx`
- Test: `src/components/admin/metric-cards.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricGrid } from './metric-cards';
import type { DaySummary } from '@/app/admin/actions';

const summary: DaySummary = {
  capacity: 100, confirmedPeople: 5, checkedInParties: 1, checkedInPeople: 1,
  revenueUsd: 65, revenueVes: 2390.05, paidCount: 2, pendingCount: 0,
};

describe('MetricGrid', () => {
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

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/metric-cards.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `metric-cards.tsx`**

```tsx
'use client';

import type { DaySummary } from '@/app/admin/actions';

function Metric(props: { label: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-28 flex-col rounded-2xl border bg-white p-3 ${props.className ?? ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <div className="mt-1 flex-1">{props.children}</div>
      {props.sub && <div className="text-xs text-muted-foreground">{props.sub}</div>}
    </div>
  );
}

function occupancyTone(pct: number): string {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 75) return 'bg-orange-500';
  if (pct >= 40) return 'bg-sky-500';
  return 'bg-green-500';
}

export function MetricGrid(props: { summary: DaySummary; onReviewPending: () => void }) {
  const s = props.summary;
  const pct = s.capacity > 0 ? Math.min(100, Math.round((s.confirmedPeople / s.capacity) * 100)) : 0;
  const pending = s.pendingCount > 0;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Metric label="Ocupación" sub={`${s.confirmedPeople} personas dentro`}>
        <div className="text-xl font-extrabold">
          {s.confirmedPeople}<span className="text-sm font-normal text-muted-foreground">/{s.capacity}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${occupancyTone(pct)}`} style={{ width: `${pct}%` }} />
        </div>
      </Metric>

      <Metric label="Ingresaron" sub={`${s.checkedInPeople} personas dentro`}>
        <div className="text-xl font-extrabold">
          {s.checkedInParties} <span className="text-sm font-normal text-muted-foreground">grupos</span>
        </div>
      </Metric>

      <Metric label="Ingresos del día" sub={`Bs. ${s.revenueVes.toFixed(2)} · ${s.paidCount} reservas`}>
        <div className="text-xl font-extrabold">${s.revenueUsd.toFixed(2)}</div>
      </Metric>

      <Metric
        label="Pagos por verificar"
        className={pending ? 'border-amber-300 bg-amber-50' : ''}
        sub={pending ? undefined : <span className="font-semibold text-green-700">Todo al día</span>}
      >
        <div className={`text-xl font-extrabold ${pending ? 'text-amber-600' : ''}`}>{s.pendingCount}</div>
        {pending && (
          <div className="mt-1 space-y-1">
            <p className="text-xs font-semibold text-amber-700">Requiere atención</p>
            <button
              type="button"
              onClick={props.onReviewPending}
              className="cursor-pointer rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Revisar pagos
            </button>
          </div>
        )}
      </Metric>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/metric-cards.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/metric-cards.tsx src/components/admin/metric-cards.test.tsx
git commit -m "feat: MetricGrid with occupancy tone and pending-payments state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 10: Modal Ver detalle

**Files:**
- Create: `src/components/admin/reservation-detail-dialog.tsx`
- Test: `src/components/admin/reservation-detail-dialog.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import type { ReservationRow } from '@/lib/db/reservations';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-KAV8W', date: '2030-01-15',
    first_name: 'Jose', last_name: 'Rios', email: 'j@e.com',
    id_type: 'V', id_number: '262626262', adults: 1, children: 0,
    total_usd: 15, bcv_rate: 36.5, total_ves: 547.5,
    status: 'confirmed', payment_ref: 'REF', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

describe('ReservationDetailDialog', () => {
  it('shows reservation data when open', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.getByText('PP-KAV8W')).toBeInTheDocument();
    expect(screen.getByText(/Jose Rios/)).toBeInTheDocument();
    expect(screen.getByText(/V-262626262/)).toBeInTheDocument();
    expect(screen.getByText(/\$15\.00/)).toBeInTheDocument();
  });

  it('offers "Iniciar check-in" for confirmed reservations', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Iniciar check-in/i })).toBeInTheDocument();
  });

  it('hides "Iniciar check-in" for checked_in reservations', () => {
    render(<ReservationDetailDialog reservation={row({ status: 'checked_in' })} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Iniciar check-in/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/reservation-detail-dialog.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```tsx
'use client';

import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { partyLabel } from '@/lib/party';
import { longDateEs } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

const STATUS_ES: Record<ReservationRow['status'], string> = {
  confirmed: 'Confirmada',
  checked_in: 'Ingresó',
  pending_payment: 'Pago en verificación',
  failed: 'Fallida',
  expired: 'Expirada',
};

export function ReservationDetailDialog(props: {
  reservation: ReservationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartCheckin: () => void;
}) {
  const r = props.reservation;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>Detalle de la reserva</DialogTitle>
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-mono text-lg font-bold">{r.code}</p>
          <p className="font-medium">{r.first_name} {r.last_name}</p>
          <p className="text-muted-foreground">{r.id_type}-{r.id_number}</p>
          <p>{partyLabel(r.adults, r.children)}</p>
          <p className="text-muted-foreground">
            Pago: ${Number(r.total_usd).toFixed(2)} · Bs. {Number(r.total_ves ?? 0).toFixed(2)}
          </p>
          <p className="capitalize text-muted-foreground">Fecha: {longDateEs(r.date)}</p>
          <p className="font-semibold">Estado: {STATUS_ES[r.status]}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cerrar</Button>} />
          {r.status === 'confirmed' && (
            <Button onClick={props.onStartCheckin}>Iniciar check-in</Button>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
```

Nota: `DialogClose render={<Button .../>}` usa el patrón de composición de Base UI (igual que `Badge`/`Select` usan `render`). Si `DialogClose` no admite `render`, envolver el `Button` con `onClick={() => props.onOpenChange(false)}` en su lugar.

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/reservation-detail-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/reservation-detail-dialog.tsx src/components/admin/reservation-detail-dialog.test.tsx
git commit -m "feat: reservation detail dialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 11: Modal Aprobar check-in

**Files:**
- Create: `src/components/admin/checkin-dialog.tsx`
- Test: `src/components/admin/checkin-dialog.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckinDialog } from './checkin-dialog';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-KAV8W', date: TODAY,
    first_name: 'Jose', last_name: 'Rios', email: 'j@e.com',
    id_type: 'V', id_number: '262626262', adults: 1, children: 0,
    total_usd: 15, bcv_rate: 36.5, total_ves: 547.5,
    status: 'confirmed', payment_ref: 'REF', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

describe('CheckinDialog', () => {
  it('warns when reservation date is not today', () => {
    render(<CheckinDialog reservation={row({ date: '2030-01-20' })} today={TODAY} open onOpenChange={() => {}} onApprove={vi.fn()} />);
    expect(screen.getByText(/fecha distinta/i)).toBeInTheDocument();
  });

  it('calls onApprove when approving', async () => {
    const onApprove = vi.fn().mockResolvedValue({ ok: true });
    render(<CheckinDialog reservation={row()} today={TODAY} open onOpenChange={() => {}} onApprove={onApprove} />);
    await userEvent.click(screen.getByRole('button', { name: /Aprobar check-in/i }));
    expect(onApprove).toHaveBeenCalledWith(row().id);
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/checkin-dialog.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { partyLabel } from '@/lib/party';
import { longDateEs } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

export function CheckinDialog(props: {
  reservation: ReservationRow;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const r = props.reservation;
  const wrongDate = r.date !== props.today;
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>Aprobar check-in</DialogTitle>
        {wrongDate && (
          <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm font-semibold text-amber-900">
            ⚠️ Fecha distinta: la reserva es para {longDateEs(r.date)}
          </p>
        )}
        <div className="mt-3 space-y-1 text-sm">
          <p className="font-mono text-lg font-bold">{r.code}</p>
          <p className="font-medium">{r.first_name} {r.last_name} · {r.id_type}-{r.id_number}</p>
          <p>{partyLabel(r.adults, r.children)}</p>
          <p className="text-muted-foreground">
            Pago: ${Number(r.total_usd).toFixed(2)} · Bs. {Number(r.total_ves ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await props.onApprove(r.id);
              setBusy(false);
              if (res.ok) props.onOpenChange(false);
            }}
          >
            {busy ? 'Aprobando…' : 'Aprobar check-in'}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/checkin-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/checkin-dialog.tsx src/components/admin/checkin-dialog.test.tsx
git commit -m "feat: approve check-in dialog with wrong-date warning

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 12: `ReservationCard` con Check-in abajo-derecha y Ver detalle prominente

**Files:**
- Create: `src/components/admin/reservation-card.tsx`
- Test: `src/components/admin/reservation-card.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationCard } from './reservation-card';
import type { ReservationRow } from '@/lib/db/reservations';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-KAV8W', date: '2030-01-15',
    first_name: 'Jose', last_name: 'Rios', email: 'j@e.com',
    id_type: 'V', id_number: '262626262', adults: 1, children: 0,
    total_usd: 15, bcv_rate: 36.5, total_ves: 547.5,
    status: 'confirmed', payment_ref: 'REF', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

describe('ReservationCard', () => {
  it('shows Check-in for confirmed and calls onCheckin', async () => {
    const onCheckin = vi.fn();
    render(<ReservationCard reservation={row()} onCheckin={onCheckin} onResend={vi.fn()} onDetail={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Check-in/i }));
    expect(onCheckin).toHaveBeenCalledWith(row().id);
  });

  it('always offers "Ver detalle"', async () => {
    const onDetail = vi.fn();
    render(<ReservationCard reservation={row({ status: 'checked_in' })} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={onDetail} />);
    await userEvent.click(screen.getByRole('button', { name: /Ver detalle/i }));
    expect(onDetail).toHaveBeenCalledWith(row().id);
  });

  it('shows "Ingreso registrado" instead of Check-in for checked_in', () => {
    render(<ReservationCard reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:01:00Z' })} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={vi.fn()} />);
    expect(screen.getByText(/Ingreso registrado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Check-in$/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/reservation-card.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { partyLabel } from '@/lib/party';
import { caracasTime } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

const CHIP: Record<ReservationRow['status'], string> = {
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

export function ReservationCard(props: {
  reservation: ReservationRow;
  onCheckin: (id: string) => void;
  onResend: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  const r = props.reservation;
  return (
    <div data-testid="res-row" className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold">{r.code}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CHIP[r.status]}`}>
          {statusLabel(r)}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium">{r.first_name} {r.last_name}</p>
      <p className="text-sm text-muted-foreground">{r.id_type}-{r.id_number}</p>
      <p className="text-sm text-muted-foreground">
        {partyLabel(r.adults, r.children)} · ${Number(r.total_usd).toFixed(2)}
      </p>

      {/* Separación clara entre información y acciones */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="secondary" size="sm" onClick={() => props.onDetail(r.id)}>Ver detalle</Button>
        {['confirmed', 'checked_in'].includes(r.status) && (
          <Button variant="outline" size="sm" onClick={() => props.onResend(r.id)}>✉️ Reenviar correo</Button>
        )}
        {/* Acción principal anclada abajo-a-la-derecha */}
        <div className="ml-auto">
          {r.status === 'confirmed' ? (
            <Button size="sm" onClick={() => props.onCheckin(r.id)}>Check-in</Button>
          ) : r.status === 'checked_in' ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              Ingreso registrado
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/reservation-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/reservation-card.tsx src/components/admin/reservation-card.test.tsx
git commit -m "feat: ReservationCard with prominent detail and bottom-right check-in

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 13: `ReservationsTable` con chips, contador y modales

**Files:**
- Modify: `src/components/admin/reservations-table.tsx`
- Modify: `src/components/admin/reservations-table.test.tsx`

- [ ] **Step 1: Actualizar el test para el nuevo contrato**

`ReservationsTable` ahora recibe además `today` y `onDetailApproved`/callbacks de check-in vía diálogo. Para mantener el alcance testeable, el componente maneja internamente los modales; su API pública se mantiene `rows`, `onCheckIn`, `onResend`, más `today`. Reemplazar el test existente por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationsTable } from './reservations-table';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
function row(over: Partial<ReservationRow>): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

const rows = [
  row({ code: 'PP-AAAAA', first_name: 'Ana', status: 'confirmed' }),
  row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', first_name: 'Luis', id_number: '999', status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' }),
];

describe('ReservationsTable', () => {
  it('filters rows by search text', async () => {
    render(<ReservationsTable rows={rows} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getAllByTestId('res-row')).toHaveLength(2);
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'luis');
    expect(screen.getAllByTestId('res-row')).toHaveLength(1);
  });

  it('filters by status chip', async () => {
    render(<ReservationsTable rows={rows} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Ingresaron · 1/i }));
    expect(screen.getAllByTestId('res-row')).toHaveLength(1);
    expect(screen.getByText('PP-BBBBB')).toBeInTheDocument();
  });

  it('shows results counter', () => {
    render(<ReservationsTable rows={rows} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByText(/2 reservas encontradas/i)).toBeInTheDocument();
  });

  it('shows empty state when no rows', () => {
    render(<ReservationsTable rows={[]} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByText(/No hay reservas para este día/i)).toBeInTheDocument();
  });

  it('opens the approve dialog from a confirmed card and calls onCheckIn', async () => {
    const onCheckIn = vi.fn().mockResolvedValue({ ok: true });
    render(<ReservationsTable rows={[rows[0]]} today={TODAY} onCheckIn={onCheckIn} onResend={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Check-in$/i }));
    await userEvent.click(screen.getByRole('button', { name: /Aprobar check-in/i }));
    expect(onCheckIn).toHaveBeenCalledWith(rows[0].id);
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/reservations-table.test.tsx`
Expected: FAIL — la tabla aún no acepta `today`, ni tiene chips/contador/estado vacío/diálogos.

- [ ] **Step 3: Reescribir `reservations-table.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ReservationCard } from './reservation-card';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import { CheckinDialog } from './checkin-dialog';
import type { ReservationRow } from '@/lib/db/reservations';

type ChipKey = 'all' | 'confirmed' | 'checked_in' | 'pending_payment' | 'canceled';

const CHIPS: { key: ChipKey; label: string; match: (r: ReservationRow) => boolean }[] = [
  { key: 'all', label: 'Todas', match: () => true },
  { key: 'confirmed', label: 'Confirmadas', match: (r) => r.status === 'confirmed' },
  { key: 'checked_in', label: 'Ingresaron', match: (r) => r.status === 'checked_in' },
  { key: 'pending_payment', label: 'Pendientes', match: (r) => r.status === 'pending_payment' },
  { key: 'canceled', label: 'Canceladas', match: (r) => r.status === 'failed' || r.status === 'expired' },
];

export function ReservationsTable(props: {
  rows: ReservationRow[];
  today: string;
  onCheckIn: (id: string) => Promise<{ ok: boolean; message?: string }> | void;
  onResend: (id: string) => void;
  initialChip?: ChipKey;
}) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<ChipKey>(props.initialChip ?? 'all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const byChip = CHIPS.find((c) => c.key === chip)!.match;
  const rows = props.rows.filter((r) =>
    byChip(r) &&
    (needle === '' ||
      r.code.toLowerCase().includes(needle) ||
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) ||
      r.id_number.includes(needle))
  );

  const detail = props.rows.find((r) => r.id === detailId) ?? null;
  const checkin = props.rows.find((r) => r.id === checkinId) ?? null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input placeholder="Buscar por nombre, código o cédula…" className="h-11 pr-9"
          value={q} onChange={(e) => setQ(e.target.value)} />
        {q !== '' && (
          <button type="button" aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground"
            onClick={() => setQ('')}>×</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const count = props.rows.filter(c.match).length;
          const active = chip === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setChip(c.key)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${
                active ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'
              }`}>
              {c.label} · {count}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{rows.length} reservas encontradas</p>

      <div className="space-y-2">
        {rows.map((r) => (
          <ReservationCard
            key={r.id}
            reservation={r}
            onDetail={setDetailId}
            onResend={props.onResend}
            onCheckin={setCheckinId}
          />
        ))}
        {rows.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No hay reservas para este día. Prueba con otra fecha o revisa las reservas futuras.
          </p>
        )}
      </div>

      {detail && (
        <ReservationDetailDialog
          reservation={detail}
          open={detailId !== null}
          onOpenChange={(o) => { if (!o) setDetailId(null); }}
          onStartCheckin={() => { setDetailId(null); setCheckinId(detail.id); }}
        />
      )}
      {checkin && (
        <CheckinDialog
          reservation={checkin}
          today={props.today}
          open={checkinId !== null}
          onOpenChange={(o) => { if (!o) setCheckinId(null); }}
          onApprove={async (id) => {
            const res = await props.onCheckIn(id);
            return res ?? { ok: true };
          }}
        />
      )}
    </div>
  );
}

export type { ChipKey };
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/reservations-table.test.tsx`
Expected: PASS. Si el diálogo tarda un tick en montar, usar `await screen.findByRole('button', { name: /Aprobar check-in/i })` en el test.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/reservations-table.tsx src/components/admin/reservations-table.test.tsx
git commit -m "feat: reservation list with chips, counter, empty state and dialogs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 14: `AdminDayView` — encabezado, barra de fecha, métricas, toasts

**Files:**
- Modify: `src/components/admin/day-view.tsx`
- Modify: `src/app/admin/(dashboard)/page.tsx` (título y contexto de topbar)

- [ ] **Step 1: Reescribir `day-view.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { MetricGrid } from './metric-cards';
import { ReservationsTable, type ChipKey } from './reservations-table';
import { adminCheckIn, adminResendVoucher, type DaySummary } from '@/app/admin/actions';
import { longDateEs, todayCaracas } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

export function AdminDayView(props: { date: string; rows: ReservationRow[]; summary: DaySummary }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [chip, setChip] = useState<ChipKey>('all');
  const today = todayCaracas();

  const go = (d: string) => router.push(`/admin?date=${d}`);
  const shift = (days: number) => {
    const d = new Date(`${props.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    go(d.toISOString().slice(0, 10));
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">Reservas del día</h1>
        <p className="capitalize text-sm text-muted-foreground">{longDateEs(props.date)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="h-11 w-fit bg-white" value={props.date} onChange={(e) => go(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => shift(-1)}>‹ Ayer</Button>
        <Button variant="outline" size="sm" onClick={() => shift(1)}>Mañana ›</Button>
        {props.date !== today && <Button size="sm" onClick={() => go(today)}>Hoy</Button>}
      </div>

      <MetricGrid summary={props.summary} onReviewPending={() => setChip('pending_payment')} />

      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-extrabold">Reservas programadas</h2>
        <p className="mb-3 text-sm text-muted-foreground">Consulta y gestiona los accesos del día</p>
        <ReservationsTable
          key={chip}
          rows={props.rows}
          today={today}
          initialChip={chip}
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
      </div>

      <Toast kind={toast?.kind ?? 'success'} message={toast?.message ?? null} onDismiss={() => setToast(null)} />
    </main>
  );
}
```

Nota: `AdminDayView` ahora renderiza su propio `<main>`; quitar el `<main>` duplicado de `page.tsx` en el Step 2.

- [ ] **Step 2: Ajustar `page.tsx` (Hoy)**

```tsx
import { adminListReservations, adminGetDaySummary } from '../actions';
import { AdminDayView } from '@/components/admin/day-view';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: rawDate } = await searchParams;
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayCaracas();
  const [rows, summary] = await Promise.all([adminListReservations(date), adminGetDaySummary(date)]);
  return <AdminDayView date={date} rows={rows} summary={summary} />;
}
```

- [ ] **Step 3: Ejecutar la suite admin y typecheck**

Run: `npx vitest run src/components/admin && npx tsc --noEmit`
Expected: PASS y sin errores de tipos en la vista Hoy.

- [ ] **Step 4: Verificación visual manual**

Run: `npm run dev`, abrir `/admin`. Confirmar: encabezado + fecha, barra de fecha (Ayer/Mañana/Hoy), 4 métricas de igual altura, chips con conteo, tarjetas con "Ver detalle" (prominente) y "Check-in" abajo-derecha, modal Ver detalle, modal Aprobar check-in con toast "Check-in aprobado".

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/day-view.tsx "src/app/admin/(dashboard)/page.tsx"
git commit -m "feat: redesigned Hoy view with metrics, filters, dialogs and toasts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Fase 4 — Vista Configuración

### Task 15: Modal Nueva/Editar excepción

**Files:**
- Create: `src/components/admin/exception-dialog.tsx`
- Test: `src/components/admin/exception-dialog.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExceptionDialog } from './exception-dialog';

describe('ExceptionDialog', () => {
  it('hides capacity field when "Día cerrado" is selected', async () => {
    render(<ExceptionDialog open onOpenChange={() => {}} onSave={vi.fn().mockResolvedValue({ ok: true })} />);
    // "Capacidad especial" por defecto → campo visible
    expect(screen.getByLabelText(/Capacidad máxima/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Día cerrado/i }));
    expect(screen.queryByLabelText(/Capacidad máxima/i)).toBeNull();
  });

  it('saves closed day as capacity 0', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<ExceptionDialog open onOpenChange={() => {}} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Fecha/i), '2030-08-15');
    await userEvent.click(screen.getByRole('radio', { name: /Día cerrado/i }));
    await userEvent.type(screen.getByLabelText(/Motivo/i), 'Mantenimiento');
    await userEvent.click(screen.getByRole('button', { name: /Guardar excepción/i }));
    expect(onSave).toHaveBeenCalledWith('2030-08-15', 0, 'Mantenimiento');
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/exception-dialog.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ExceptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, capacity: number, reason?: string) => Promise<{ ok: boolean; message?: string }>;
  initial?: { date: string; capacity: number; reason: string | null };
}) {
  const [date, setDate] = useState(props.initial?.date ?? '');
  const [closed, setClosed] = useState(props.initial ? props.initial.capacity === 0 : false);
  const [capacity, setCapacity] = useState(String(props.initial && props.initial.capacity > 0 ? props.initial.capacity : 25));
  const [reason, setReason] = useState(props.initial?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(props.initial);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>{editing ? 'Editar excepción' : 'Nueva excepción'}</DialogTitle>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="ex-date">Fecha</Label>
            <Input id="ex-date" type="date" className="h-11" value={date}
              disabled={editing} onChange={(e) => setDate(e.target.value)} />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Tipo de día</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={!closed} onChange={() => setClosed(false)} />
              Capacidad especial
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={closed} onChange={() => setClosed(true)} />
              Día cerrado
            </label>
          </fieldset>
          {!closed && (
            <div>
              <Label htmlFor="ex-cap">Capacidad máxima</Label>
              <Input id="ex-cap" type="number" className="h-11" value={capacity}
                onChange={(e) => setCapacity(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ex-reason">Motivo (opcional)</Label>
            <Input id="ex-reason" className="h-11" placeholder="Mantenimiento de piscina"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button onClick={async () => {
            setError(null);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Selecciona una fecha válida.'); return; }
            const cap = closed ? 0 : Number(capacity);
            if (!closed && (!Number.isInteger(cap) || cap < 1)) { setError('Capacidad inválida.'); return; }
            const res = await props.onSave(date, cap, reason.trim() || undefined);
            if (res.ok) props.onOpenChange(false);
            else setError(res.message ?? 'No se pudo guardar.');
          }}>
            Guardar excepción
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/exception-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/exception-dialog.tsx src/components/admin/exception-dialog.test.tsx
git commit -m "feat: new/edit exception dialog with progressive capacity field

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 16: `SettingsForm` — parámetros, vista previa, estados de guardado, excepciones

**Files:**
- Modify: `src/components/admin/settings-form.tsx`
- Create: `src/components/admin/settings-form.test.tsx`
- Modify: `src/app/admin/(dashboard)/settings/page.tsx` (quitar `<main>` duplicado si aplica)

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsForm } from './settings-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/admin/actions', () => ({
  adminUpdateSettings: vi.fn().mockResolvedValue({ ok: true }),
  adminUpsertOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminDeleteOverride: vi.fn().mockResolvedValue({ ok: true }),
}));

const settings = { daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1, last_bcv_rate: null, last_bcv_rate_at: null };

describe('SettingsForm', () => {
  it('shows a live price preview for 2 adults and 1 child', () => {
    render(<SettingsForm settings={settings} overrides={[]} />);
    // 2*7 + 1*1 = 15
    expect(screen.getByText(/\$15\.00 USD/)).toBeInTheDocument();
  });

  it('shows empty state when there are no overrides', () => {
    render(<SettingsForm settings={settings} overrides={[]} />);
    expect(screen.getByText(/No tienes excepciones configuradas/i)).toBeInTheDocument();
  });

  it('renders a closed-day exception as "Club cerrado"', () => {
    render(<SettingsForm settings={settings} overrides={[{ date: '2030-08-15', capacity: 0, reason: null }]} />);
    expect(screen.getByText(/Club cerrado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run src/components/admin/settings-form.test.tsx`
Expected: FAIL — el form actual no tiene vista previa ni estado vacío ni acepta `reason` en overrides.

- [ ] **Step 3: Reescribir `settings-form.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ExceptionDialog } from './exception-dialog';
import { adminUpdateSettings, adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import { totalUsd } from '@/lib/money';
import type { SettingsRow, OverrideRow } from '@/lib/db/reservations';

type SaveState = 'idle' | 'saving' | 'saved';

export function SettingsForm(props: { settings: SettingsRow; overrides: OverrideRow[] }) {
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(props.settings.daily_capacity));
  const [adult, setAdult] = useState(String(props.settings.adult_price_usd));
  const [child, setChild] = useState(String(props.settings.child_price_usd));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<OverrideRow | null>(null);
  const [deleting, setDeleting] = useState<OverrideRow | null>(null);

  const preview = totalUsd(2, 1, { adult: Number(adult) || 0, child: Number(child) || 0 });
  const dirty =
    capacity !== String(props.settings.daily_capacity) ||
    adult !== String(props.settings.adult_price_usd) ||
    child !== String(props.settings.child_price_usd);

  async function save() {
    setError(null);
    if (capacity.trim() === '' || adult.trim() === '' || child.trim() === '') {
      setError('Todos los campos son requeridos.');
      return;
    }
    setSaveState('saving');
    const res = await adminUpdateSettings({
      daily_capacity: Number(capacity),
      adult_price_usd: Math.round(Number(adult) * 100) / 100,
      child_price_usd: Math.round(Number(child) * 100) / 100,
    });
    if (res.ok) { setSaveState('saved'); router.refresh(); }
    else { setSaveState('idle'); setError(res.message ?? 'No se pudo guardar.'); }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Administra la capacidad, los precios y las excepciones del club.</p>
      </div>

      {/* Parámetros generales */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-extrabold">Parámetros generales</h2>
        <p className="mb-3 text-sm text-muted-foreground">Estos valores se aplican a las reservas nuevas y pueden cambiarse en cualquier momento.</p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="capacity">Capacidad diaria</Label>
            <Input id="capacity" type="number" className="h-11" value={capacity}
              onChange={(e) => { setCapacity(e.target.value); setSaveState('idle'); }} />
            <p className="mt-1 text-xs text-muted-foreground">Límite máximo de personas que pueden ingresar en un día normal.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="adult">Precio adulto (USD)</Label>
              <Input id="adult" type="number" step="0.01" className="h-11" value={adult}
                onChange={(e) => { setAdult(e.target.value); setSaveState('idle'); }} />
            </div>
            <div className="flex-1">
              <Label htmlFor="child">Precio niño (USD)</Label>
              <Input id="child" type="number" step="0.01" className="h-11" value={child}
                onChange={(e) => { setChild(e.target.value); setSaveState('idle'); }} />
            </div>
          </div>
          <p className="rounded-lg bg-sky-50 p-2 text-sm text-slate-600">
            Una reserva de 2 adultos y 1 niño tendrá un valor estimado de <b>${preview.toFixed(2)} USD</b>.
          </p>
          <Button onClick={save} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Configuración guardada' : 'Guardar configuración'}
          </Button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {saveState === 'saved' && !dirty && <p className="text-sm font-semibold text-green-700">Todos los cambios están guardados.</p>}
          {dirty && <p className="text-sm text-amber-700">Tienes cambios sin guardar.</p>}
        </div>
      </div>

      {/* Excepciones */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-extrabold">Excepciones de capacidad</h2>
            <p className="text-sm text-muted-foreground">Usa una excepción cuando un día tenga una capacidad diferente o el club permanezca cerrado.</p>
          </div>
          <Button size="sm" onClick={() => setShowNew(true)}>+ Nueva excepción</Button>
        </div>

        <div className="mt-3 space-y-2">
          {props.overrides.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
              No tienes excepciones configuradas. Agrega una fecha especial cuando la capacidad cambie.
            </p>
          )}
          {props.overrides.map((o) => (
            <div key={o.date} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <div>
                <p className="font-semibold">{o.date}</p>
                <p className="text-muted-foreground">
                  {o.capacity === 0 ? 'Club cerrado' : `Capacidad limitada a ${o.capacity} ${o.capacity === 1 ? 'persona' : 'personas'}`}
                  {o.reason ? ` · ${o.reason}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(o)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nueva */}
      {showNew && (
        <ExceptionDialog
          open={showNew}
          onOpenChange={setShowNew}
          onSave={async (date, cap, reason) => {
            const res = await adminUpsertOverride(date, cap, reason);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      )}
      {/* Modal editar */}
      {editing && (
        <ExceptionDialog
          open={editing !== null}
          initial={editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSave={async (date, cap, reason) => {
            const res = await adminUpsertOverride(date, cap, reason);
            if (res.ok) { setEditing(null); router.refresh(); }
            return res;
          }}
        />
      )}
      {/* Confirmar borrado */}
      {deleting && (
        <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
          <DialogPopup>
            <DialogTitle>¿Eliminar esta excepción?</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">Esta acción cambiará la capacidad disponible para ese día.</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose render={<Button variant="outline">Cancelar</Button>} />
              <Button variant="destructive" onClick={async () => {
                await adminDeleteOverride(deleting.date);
                setDeleting(null);
                router.refresh();
              }}>Eliminar</Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Ajustar `settings/page.tsx` (quitar `<main>` duplicado)**

```tsx
import { adminGetSettings } from '../../actions';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  const { settings, overrides } = await adminGetSettings();
  return <SettingsForm settings={settings} overrides={overrides} />;
}
```

- [ ] **Step 5: Ejecutar y ver pasar**

Run: `npx vitest run src/components/admin/settings-form.test.tsx && npx tsc --noEmit`
Expected: PASS y sin errores de tipos (`OverrideRow` ya incluye `reason`).

- [ ] **Step 6: Verificación visual manual**

Run: `npm run dev`, abrir `/admin/settings`. Confirmar: vista previa de precio en vivo, botón con estados, "+ Nueva excepción" abre modal (campo capacidad oculto en "Día cerrado"), lista con Editar/Eliminar, confirmación de borrado, estado vacío.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/settings-form.tsx src/components/admin/settings-form.test.tsx "src/app/admin/(dashboard)/settings/page.tsx"
git commit -m "feat: redesigned settings with price preview, save states and exception dialogs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Fase 6 — Barrido final: español, cursor y suite completa

### Task 17: Barrido de español y `cursor-pointer`

**Files:**
- Modify: cualquier vista admin con cadenas en inglés o controles sin cursor (auditoría).

- [ ] **Step 1: Buscar cadenas en inglés en las vistas admin**

Run: `grep -rniE "save|cancel|delete|search|settings|today|reservation|check" src/components/admin src/app/admin --include="*.tsx" | grep -viE "// |check-in|checkin|checked_in|Check-in"`
Revisar resultados; traducir cualquier cadena visible en inglés al español (los nombres de símbolos/props en inglés se dejan). Mantener "Check-in" tal cual.

- [ ] **Step 2: Auditar `cursor-pointer` en controles crudos**

Run: `grep -rnE "<button|<Link|onClick" src/components/admin src/app/admin --include="*.tsx" | grep -v "cursor-pointer"`
Para cada `<button>`/`<Link>` clickeable sin `cursor-pointer` (los `<Button>` ya lo heredan de la base), agregar `cursor-pointer` a su `className`.

- [ ] **Step 3: Verificar suite completa y tipos**

Run: `npm test && npx tsc --noEmit`
Expected: toda la suite en verde, sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: spanish sweep and cursor-pointer audit across admin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 18: Limpieza de `checkin-card.tsx` (página QR) y regresión

**Files:**
- Modify: `src/components/admin/checkin-card.tsx` (solo si hay cadenas en inglés; la página QR sigue igual)
- Verify: `src/components/admin/checkin-card.test.tsx`

- [ ] **Step 1: Confirmar que la página QR sigue funcionando**

La página `/admin/checkin/[id]` usa `CheckinCard` (botón "Registrar entrada"), independiente del modal nuevo. No cambiar su comportamiento. Ejecutar su test:

Run: `npx vitest run src/components/admin/checkin-card.test.tsx`
Expected: PASS (sin cambios de comportamiento).

- [ ] **Step 2: Verificación E2E ligera (opcional si hay Playwright configurado)**

Run: `npm run test:e2e` (si aplica).
Expected: sin regresiones en flujos existentes. Si no hay E2E para admin, omitir.

- [ ] **Step 3: Verificación final completa**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: todo verde.

- [ ] **Step 4: Commit (si hubo cambios)**

```bash
git add -A
git commit -m "test: verify QR check-in page unaffected by redesign

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación de cobertura del spec

- Primitivos compartidos (Dialog, Toast, cursor global) → Tasks 1-3. ✔
- Shell + Topbar (marca, nav activo, cuenta, campana, perfil) → Tasks 7-8. ✔
- Vista Hoy: encabezado, barra de fecha, MetricGrid con tono/pendientes, alertas/toasts, workspace, chips, contador, estado vacío → Tasks 9, 13, 14. ✔
- ReservationCard: Ver detalle prominente + Check-in abajo-derecha + "Ingreso registrado" → Task 12. ✔
- Modales Ver detalle y Aprobar check-in (aviso fecha) → Tasks 10-11. ✔
- Configuración: parámetros + vista previa + estados de guardado; excepciones modal + lista + editar + confirmar borrado + estado vacío → Tasks 15-16. ✔
- Backend excepciones: migración `reason`, db, actions → Tasks 4-6. ✔
- Español + cursor:pointer → Tasks 1, 17. ✔
- Fuera de alcance (pagos manuales, reservas presenciales, notificaciones persistidas) → no incluidas (PR 2). ✔

## Notas para el implementador

- El patrón `DialogClose render={<Button .../>}` depende de que Base UI `Dialog.Close` acepte `render` (igual que `Badge`/`Select`). Si falla en runtime, sustituir por un `<Button variant="outline" onClick={() => props.onOpenChange(false)}>`.
- Los tests de diálogos pueden requerir `findBy*` (async) porque el Portal monta en microtask. Si un `getBy*` falla intermitente, cambiar a `await screen.findBy*`.
- No introducir `alert/confirm/prompt` nativos en ningún punto (rompen la automatización del navegador y son mala UX).
- Mantener `npm test` verde tras cada tarea.
