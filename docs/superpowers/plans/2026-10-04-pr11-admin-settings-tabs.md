# PR 11 — Configuración con pestañas (General · Excepciones · Accesos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/admin/settings` (solo dueño) en una página con tres pestañas accesibles y persistentes en la URL (`?tab=general|excepciones|accesos`): General (steppers táctiles, proyección de ingresos al 100 % y tarjeta BCV con "Actualizar tasa ahora"), Excepciones (calendario mensual + lista con chips de motivo) y Accesos (roles de `ADMIN_EMAILS`).

**Architecture:** La página servidor lee `searchParams.tab`, los ajustes, las excepciones y los roles, y se los pasa a `SettingsForm`, que ahora solo compone `SettingsTabs` (tablist propio, ARIA completo, `history.replaceState` para la URL) con tres paneles cliente en `src/components/admin/settings/*`. La lógica pura (pasos del stepper, proyección, rejilla del mes, edad de la tasa, presets de motivo, parseo de la pestaña) vive en módulos `.ts` con tests unitarios. El refresco manual de la tasa es una server action nueva en `src/app/admin/settings-actions.ts` que reutiliza `fetchBcvRate` (`src/lib/bcv.ts`), `writeRateCache` y `recordBcvRate(…, 'manual')` sin duplicar lógica, y audita con la nueva acción `'bcv.refresh'`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (tokens `teal`, `coral`, `navy`), shadcn/ui + base-ui (`Button`, `Input`, `Dialog`), lucide-react, Vitest + Testing Library (jsdom), Playwright.

---

## Contexto que el ejecutor debe conocer

- **Worktree:** `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-settings-tabs` (rama `feat/admin-settings-tabs`, base `develop`). Todos los comandos se corren desde ahí.
- **Node:** por defecto es v16. Todo `npm`/`npx` va con `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && …`.
- **Supabase local** compartido y corriendo: prohibido `supabase start/stop/db reset/migration`. Este PR **no** necesita migración (todas las tablas existen: `settings`, `capacity_overrides`, `admin_roles`, `bcv_rate_history`, `audit_log`; `audit_log.action` es `text`, así que `'bcv.refresh'` no requiere DDL).
- **e2e serializado** con lock (ver Task 15). Sin push ni PR: lo hace el coordinador.
- **Commits:** conventional + línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (dos `-m` producen la línea en blanco).
- **Reglas de la ola:** admin en español en duro; touch targets ≥ 44 px (`ADMIN_ACTION`, `ADMIN_ICON_ACTION`, `ADMIN_INPUT`, `DIALOG_ACTION` de `src/components/admin/ui-constants.ts`); fechas/horas en `America/Caracas` (`src/lib/dates.ts`); `prefers-reduced-motion` (`motion-safe:` / `motion-reduce:`); fechas largas con `first-letter:uppercase`, **nunca** la clase `capitalize` (este PR elimina la que había en la lista de excepciones).
- **Propiedad de archivos (PR 11):** `admin/settings-form.tsx` (+test), nuevos `admin/settings/*`, `admin/exception-dialog.tsx` (+test), `src/app/admin/(dashboard)/settings/**`, nuevo `src/app/admin/settings-actions.ts`. Además, por mandato del brief: una línea en `src/lib/audit.ts` (`AuditAction`). Nuevo e2e `e2e/admin-settings.spec.ts`. **No** se toca `src/app/admin/actions.ts`, `src/lib/bcv.ts`, `nav-config.ts` (Configuración ya está `ready: true`), ni `reservation-status.ts`.
- **Fuera de alcance:** pestaña de logs/auditoría (es `/admin/audit`, PR 12).

### Decisiones de diseño (léelas antes de empezar)

1. **Proyección de ingresos honesta.** No inventamos una mezcla adultos/niños. Mostramos el rango de un día lleno (capacidad × 100 %): "entre $min y $max", con el desglose "Si todos son adultos" / "Si todos son niños", y el equivalente en bolívares a la tasa BCV guardada si existe. Nota visible: el ingreso real depende de la mezcla y no incluye excepciones de capacidad.
2. **Steppers.** Input de texto con `role="spinbutton"` (`aria-valuemin/max/now`) + botones −/+ de 44 px. Teclado: ↑/↓ = ±paso, RePág/AvPág = ±10 pasos, Inicio/Fin = mín/máx. Límites idénticos a `settingsSchema` de `actions.ts`: capacidad 0–10000 paso 1; precios 0–1000 paso 0,5 (2 decimales). El texto libre sigue permitido y se valida al guardar (el servidor revalida).
3. **Pestaña en la URL sin ida y vuelta al servidor.** `window.history.replaceState` (Next.js lo sincroniza con su router), así `router.refresh()` posterior conserva `?tab=`. Los tres paneles quedan montados (`hidden`), por lo que los cambios sin guardar de General sobreviven a un cambio de pestaña.
4. **Refresco BCV.** `adminRefreshBcvRate()` llama a `fetchBcvRate()` directamente (no a `getBcvRate`, que serviría la caché de 1 h). Orden: fetch → `writeRateCache` (si falla, error y no se audita) → `recordBcvRate(rate, now, 'manual')` (si falla, solo `console.error`, igual que `getBcvRate`) → `logAudit('bcv.refresh')` → `revalidatePath('/admin', 'layout')` (refresca también el badge BCV del topbar). No recibe input, así que no hay esquema zod que validar.
5. **Constantes de frescura duplicadas a propósito.** `bcv-age.ts` (cliente) declara `HOUR`/`DAY` en vez de importar de `src/lib/bcv.ts`, porque ese módulo hace `import('undici')` y no debe entrar al bundle del navegador. Comentario en el código lo explica.
6. **Calendario propio** (no `react-day-picker`): una tabla de 7 columnas con botones de 44 px, `data-kind="closed|special|normal"`, `aria-label` descriptivo y leyenda. Cerrado = fondo coral suave + "Cerr."; especial = fondo teal suave + cupo; hoy = contorno navy + `aria-current="date"`. El significado nunca depende solo del color. Días pasados sin excepción quedan deshabilitados.
7. **Motivos.** La BD sigue con `reason` en texto libre. Chips de atajo en `ExceptionDialog`: Mantenimiento, Evento privado, Feriado, Otro ("Otro" limpia y enfoca el campo). En la lista, el chip toma color por preset; texto libre = "Otro" (gris) mostrando el texto real.
8. **Accesos.** `<select>` nativo (h-11) por fila + diálogo de confirmación → `adminUpsertRole`. La fila propia queda deshabilitada con explicación (el servidor además lo bloquea). "por defecto" cuando la fila no existe en `admin_roles`. Nota: "Para quitar acceso, saca el email de `ADMIN_EMAILS`…". Etiquetas de rol reutilizan `ROLE_LABEL` de `admin/profile-pill.tsx`.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/audit.ts` | Modify (1 línea) | Añadir `'bcv.refresh'` a `AuditAction`. |
| `src/app/admin/settings-actions.ts` | Create | `adminRefreshBcvRate()` (owner-only). |
| `src/app/admin/settings-actions.test.ts` | Create | Gate, fetch forzado, caché, historial `'manual'`, auditoría, errores. |
| `src/components/admin/settings/tab-param.ts` (+`.test.ts`) | Create | `SETTINGS_TABS`, `parseSettingsTab`, `settingsTabHref`. |
| `src/components/admin/settings/settings-tabs.tsx` (+`.test.tsx`) | Create | Tablist accesible + URL. |
| `src/components/admin/settings/number-stepper.tsx` (+`.test.tsx`) | Create | `stepValue`, `stepperKeyValue`, `parseStepperValue`, `NumberStepper`. |
| `src/components/admin/settings/projection.ts` (+`.test.ts`) | Create | `projectRevenue`. |
| `src/components/admin/settings/bcv-age.ts` (+`.test.ts`) | Create | `rateAgeLabel`, `rateStampEs`, `rateFreshness`. |
| `src/components/admin/settings/bcv-card.tsx` (+`.test.tsx`) | Create | Tasa en caché + edad + botón "Actualizar tasa ahora". |
| `src/components/admin/settings/general-panel.tsx` (+`.test.tsx`) | Create | Steppers, proyección, dirty + Descartar/Guardar, `BcvCard`. |
| `src/components/admin/settings/reason-presets.ts` (+`.test.ts`) | Create | `REASON_PRESETS`, `reasonKind`, `REASON_CHIP_CLASS`. |
| `src/components/admin/exception-dialog.tsx` (+test) | Modify | `defaultDate` + chips de motivo. |
| `src/components/admin/settings/month-grid.ts` (+`.test.ts`) | Create | `monthGrid`, `shiftMonth`, `monthLabelEs`, `WEEKDAYS_ES`. |
| `src/components/admin/settings/exceptions-calendar.tsx` (+`.test.tsx`) | Create | Calendario mensual con resaltado y leyenda. |
| `src/components/admin/settings/exceptions-panel.tsx` (+`.test.tsx`) | Create | Calendario + lista + diálogos crear/editar/borrar. |
| `src/components/admin/settings/roles-panel.tsx` (+`.test.tsx`) | Create | Pestaña Accesos. |
| `src/components/admin/settings-form.tsx` (+test) | Modify (reescritura) | Composición: encabezado + `SettingsTabs` con los 3 paneles. |
| `src/app/admin/(dashboard)/settings/page.tsx` | Modify | `searchParams.tab`, roles, `today`, `now`. |
| `e2e/admin-settings.spec.ts` | Create | Pestaña en URL tras recargar, stepper por teclado, calendario. |

---

### Task 0: Preparar el entorno

**Files:** ninguno.

- [ ] **Step 1: Verificar rama y dependencias**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-settings-tabs
git branch --show-current
[ -d node_modules ] || (source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci)
```

Expected: imprime `feat/admin-settings-tabs`; `npm ci` termina sin errores (al escribir este plan el worktree NO tenía `node_modules`).

- [ ] **Step 2: Línea base**

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings-form.test.tsx src/components/admin/exception-dialog.test.tsx src/app/admin/actions.test.ts && npx tsc --noEmit
```

Expected: PASS en los tres archivos y `tsc` sin errores. Si algo falla aquí, detente y repórtalo (no es culpa de este PR).

---

### Task 1: Acción de auditoría `bcv.refresh` + `adminRefreshBcvRate`

**Files:**
- Modify: `src/lib/audit.ts:4-6`
- Create: `src/app/admin/settings-actions.ts`
- Test: `src/app/admin/settings-actions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/admin/settings-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

const OWNER = 'admin@club.com';
const OPS = 'ops@club.com';
process.env.ADMIN_EMAILS = `${OWNER},${OPS}`;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));
vi.mock('@/lib/db/admin-roles', () => ({ getAdminRole: vi.fn(async () => null) }));
vi.mock('@/lib/bcv', () => ({ fetchBcvRate: vi.fn() }));
vi.mock('@/lib/bcv-history', () => ({ recordBcvRate: vi.fn(async () => {}) }));
vi.mock('@/lib/db/reservations', () => ({
  writeRateCache: vi.fn(async () => {}),
  readRateCache: vi.fn(async () => ({ rate: 1, fetchedAt: 0 })),
}));
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { adminRefreshBcvRate } from './settings-actions';
import { getAdminRole } from '@/lib/db/admin-roles';
import { fetchBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { writeRateCache, readRateCache } from '@/lib/db/reservations';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

const NOW = new Date('2030-01-15T16:00:00Z').getTime();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mockUser = { id: 'u1', email: OWNER };
  vi.mocked(getAdminRole).mockResolvedValue(null); // no row = owner
  vi.mocked(fetchBcvRate).mockResolvedValue(36.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('adminRefreshBcvRate', () => {
  it('rejects anonymous users before fetching anything', async () => {
    mockUser = null;
    await expect(adminRefreshBcvRate()).rejects.toThrow('Unauthorized');
    expect(fetchBcvRate).not.toHaveBeenCalled();
  });

  it('is owner-only: an operator gets Forbidden and nothing is fetched or written', async () => {
    mockUser = { id: 'u2', email: OPS };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(adminRefreshBcvRate()).rejects.toThrow('Forbidden');
    expect(fetchBcvRate).not.toHaveBeenCalled();
    expect(writeRateCache).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('bypasses the cache: always fetches and never reads the cached rate', async () => {
    await adminRefreshBcvRate();
    expect(fetchBcvRate).toHaveBeenCalledTimes(1);
    expect(readRateCache).not.toHaveBeenCalled();
  });

  it('writes the settings cache, records a manual history row and audits', async () => {
    const res = await adminRefreshBcvRate();
    expect(res).toEqual({ ok: true, rate: 36.5, at: '2030-01-15T16:00:00.000Z' });
    expect(writeRateCache).toHaveBeenCalledWith(36.5, NOW);
    expect(recordBcvRate).toHaveBeenCalledWith(36.5, NOW, 'manual');
    expect(logAudit).toHaveBeenCalledWith({ actor: OWNER, action: 'bcv.refresh', details: { rate: 36.5 } });
    expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
  });

  it('returns a Spanish error and writes nothing when every BCV source fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchBcvRate).mockRejectedValue(new Error('all BCV sources failed'));
    const res = await adminRefreshBcvRate();
    expect(res).toEqual({ ok: false, message: 'No se pudo obtener la tasa del BCV. Intenta de nuevo en unos minutos.' });
    expect(writeRateCache).not.toHaveBeenCalled();
    expect(recordBcvRate).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('fails without auditing when the cache cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(writeRateCache).mockRejectedValueOnce(new Error('db down'));
    const res = await adminRefreshBcvRate();
    expect(res).toEqual({ ok: false, message: 'Se obtuvo la tasa, pero no se pudo guardar. Intenta de nuevo.' });
    expect(recordBcvRate).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('still succeeds (and audits) when only the history insert fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(recordBcvRate).mockRejectedValueOnce(new Error('history down'));
    const res = await adminRefreshBcvRate();
    expect(res.ok).toBe(true);
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/settings-actions.test.ts`
Expected: FAIL — `Failed to resolve import "./settings-actions"`.

- [ ] **Step 3: Añadir la acción de auditoría**

En `src/lib/audit.ts`, reemplazar el tipo `AuditAction` por:

```ts
export type AuditAction =
  | 'reservation.check_in' | 'reservation.resend_voucher'
  | 'settings.update' | 'override.upsert' | 'override.delete'
  | 'role.upsert'
  | 'bcv.refresh';
```

- [ ] **Step 4: Implementar la server action**

Crear `src/app/admin/settings-actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { fetchBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { writeRateCache } from '@/lib/db/reservations';
import { logAudit } from '@/lib/audit';

export type RefreshBcvResult =
  | { ok: true; rate: number; at: string }
  | { ok: false; message: string };

/**
 * Owner-only "Actualizar tasa ahora". Unlike getBcvRate (which serves the
 * settings cache for 1 h), this always hits the BCV sources via fetchBcvRate,
 * then writes the cache and appends a 'manual' bcv_rate_history row.
 * Takes no input, so there is nothing to validate with zod.
 */
export async function adminRefreshBcvRate(): Promise<RefreshBcvResult> {
  const me = await requireAdmin({ role: 'owner' });
  const now = Date.now();

  let rate: number;
  try {
    rate = await fetchBcvRate();
  } catch (e) {
    console.error('bcv refresh: fetch failed:', e);
    return { ok: false, message: 'No se pudo obtener la tasa del BCV. Intenta de nuevo en unos minutos.' };
  }

  try {
    await writeRateCache(rate, now);
  } catch (e) {
    console.error('bcv refresh: cache write failed:', e);
    return { ok: false, message: 'Se obtuvo la tasa, pero no se pudo guardar. Intenta de nuevo.' };
  }

  try {
    await recordBcvRate(rate, now, 'manual');
  } catch (e) {
    // The cache already holds the new rate; a missing history row is not worth failing over
    // (same policy as getBcvRate in src/lib/bcv.ts).
    console.error('bcv refresh: history write failed:', e);
  }

  await logAudit({ actor: me.email, action: 'bcv.refresh', details: { rate } });
  revalidatePath('/admin', 'layout'); // this page + the topbar BCV badge
  return { ok: true, rate, at: new Date(now).toISOString() };
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/app/admin/settings-actions.test.ts src/lib/audit.test.ts && npx tsc --noEmit`
Expected: PASS (7 tests nuevos + los de audit) y `tsc` limpio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit.ts src/app/admin/settings-actions.ts src/app/admin/settings-actions.test.ts
git commit -m "feat(admin): add owner-only manual BCV rate refresh action" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Parámetro de pestaña (`?tab=`)

**Files:**
- Create: `src/components/admin/settings/tab-param.ts`
- Test: `src/components/admin/settings/tab-param.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { SETTINGS_TABS, parseSettingsTab, settingsTabHref } from './tab-param';

describe('parseSettingsTab', () => {
  it('accepts the three known tabs', () => {
    expect(parseSettingsTab('general')).toBe('general');
    expect(parseSettingsTab('excepciones')).toBe('excepciones');
    expect(parseSettingsTab('accesos')).toBe('accesos');
  });

  it('falls back to general for missing or unknown values', () => {
    expect(parseSettingsTab(undefined)).toBe('general');
    expect(parseSettingsTab('')).toBe('general');
    expect(parseSettingsTab('logs')).toBe('general');
    expect(parseSettingsTab('ACCESOS')).toBe('general');
  });

  it('uses the first value of a repeated param', () => {
    expect(parseSettingsTab(['accesos', 'general'])).toBe('accesos');
  });
});

describe('settingsTabHref', () => {
  it('builds the settings URL with the tab param', () => {
    expect(settingsTabHref('excepciones')).toBe('/admin/settings?tab=excepciones');
    expect(settingsTabHref('general')).toBe('/admin/settings?tab=general');
  });
});

it('lists tabs in display order with Spanish labels', () => {
  expect(SETTINGS_TABS.map((t) => t.label)).toEqual(['General', 'Excepciones', 'Accesos']);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/tab-param.test.ts`
Expected: FAIL — no se resuelve `./tab-param`.

- [ ] **Step 3: Implementar**

```ts
// src/components/admin/settings/tab-param.ts
export const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'excepciones', label: 'Excepciones' },
  { id: 'accesos', label: 'Accesos' },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

export const SETTINGS_PATH = '/admin/settings';

const TAB_IDS: readonly string[] = SETTINGS_TABS.map((t) => t.id);

/** `?tab=` value → known tab; anything else is 'general'. */
export function parseSettingsTab(raw: string | string[] | undefined): SettingsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && TAB_IDS.includes(value) ? (value as SettingsTab) : 'general';
}

export function settingsTabHref(tab: SettingsTab): string {
  return `${SETTINGS_PATH}?tab=${tab}`;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/tab-param.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/tab-param.ts src/components/admin/settings/tab-param.test.ts
git commit -m "feat(admin): parse the settings tab from the URL" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `SettingsTabs` — tablist accesible que escribe `?tab=`

**Files:**
- Create: `src/components/admin/settings/settings-tabs.tsx`
- Test: `src/components/admin/settings/settings-tabs.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsTabs } from './settings-tabs';

const panels = {
  general: <p>Panel general</p>,
  excepciones: <p>Panel excepciones</p>,
  accesos: <p>Panel accesos</p>,
};

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/settings');
});

describe('SettingsTabs', () => {
  it('renders a labelled tablist and selects the initial tab', () => {
    render(<SettingsTabs initialTab="excepciones" panels={panels} />);
    expect(screen.getByRole('tablist', { name: 'Secciones de configuración' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Excepciones' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'false');
    // hidden panels are excluded from role queries
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel excepciones');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'settings-tab-excepciones');
  });

  it('uses a roving tabindex (only the selected tab is tabbable)', () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('tabindex', '-1');
  });

  it('clicking a tab selects it and writes ?tab= to the URL', async () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Accesos' }));
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.pathname).toBe('/admin/settings');
    expect(window.location.search).toBe('?tab=accesos');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel accesos');
  });

  it('arrow keys (wrapping), Home and End move selection and focus', async () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    screen.getByRole('tab', { name: 'General' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Excepciones' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Excepciones' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();
    expect(window.location.search).toBe('?tab=general');
  });

  it('keeps inactive panels mounted but hidden (unsaved edits survive a tab switch)', () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    expect(screen.getByText('Panel accesos')).not.toBeVisible();
    expect(screen.getByText('Panel general')).toBeVisible();
  });

  it('tabs are 44px touch targets', () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    expect(screen.getByRole('tab', { name: 'General' }).className).toContain('min-h-11');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/settings-tabs.test.tsx`
Expected: FAIL — no se resuelve `./settings-tabs`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/settings-tabs.tsx
'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SETTINGS_TABS, settingsTabHref, type SettingsTab } from './tab-param';

/**
 * WAI-ARIA tabs (automatic activation, roving tabindex). The selected tab is
 * mirrored in `?tab=` with the native History API — Next.js keeps its router
 * in sync with it, so the tab survives a refresh without a server round-trip
 * on every switch. Every panel stays mounted (`hidden`) so unsaved edits in
 * one tab are not lost when visiting another.
 */
export function SettingsTabs(props: { initialTab: SettingsTab; panels: Record<SettingsTab, ReactNode> }) {
  const [active, setActive] = useState<SettingsTab>(props.initialTab);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  function select(tab: SettingsTab, focus = false) {
    setActive(tab);
    window.history.replaceState(null, '', settingsTabHref(tab));
    if (focus) tabRefs.current[tab]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = SETTINGS_TABS.findIndex((t) => t.id === active);
    const last = SETTINGS_TABS.length - 1;
    const target =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (target === null) return;
    e.preventDefault();
    select(SETTINGS_TABS[target].id, true);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de configuración"
        className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
      >
        {SETTINGS_TABS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={onKeyDown}
              className={cn(
                'min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy',
                selected ? 'bg-white text-navy shadow-sm' : 'text-slate-600 hover:bg-white/60',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {SETTINGS_TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`settings-panel-${t.id}`}
          aria-labelledby={`settings-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="mt-4 focus-visible:outline-none"
        >
          {props.panels[t.id]}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/settings-tabs.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/settings-tabs.tsx src/components/admin/settings/settings-tabs.test.tsx
git commit -m "feat(admin): add accessible settings tabs synced to ?tab=" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `NumberStepper` (botones 44 px + teclado)

**Files:**
- Create: `src/components/admin/settings/number-stepper.tsx`
- Test: `src/components/admin/settings/number-stepper.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  NumberStepper, stepValue, stepperKeyValue, parseStepperValue, type StepperBounds,
} from './number-stepper';

const CAP: StepperBounds = { min: 0, max: 10000, step: 1, decimals: 0 };
const PRICE: StepperBounds = { min: 0, max: 1000, step: 0.5, decimals: 2 };

describe('parseStepperValue', () => {
  it('parses numbers, accepts a decimal comma, rejects empty/garbage', () => {
    expect(parseStepperValue('7.5')).toBe(7.5);
    expect(parseStepperValue('7,5')).toBe(7.5);
    expect(parseStepperValue('')).toBeNull();
    expect(parseStepperValue('  ')).toBeNull();
    expect(parseStepperValue('abc')).toBeNull();
  });
});

describe('stepValue', () => {
  it('adds the delta', () => {
    expect(stepValue('100', 1, CAP)).toBe('101');
    expect(stepValue('7', 0.5, PRICE)).toBe('7.5');
    expect(stepValue('7.5', -0.5, PRICE)).toBe('7');
  });

  it('clamps to the bounds', () => {
    expect(stepValue('0', -1, CAP)).toBe('0');
    expect(stepValue('10000', 1, CAP)).toBe('10000');
    expect(stepValue('999.8', 0.5, PRICE)).toBe('1000');
  });

  it('steps from min when the field is empty or invalid', () => {
    expect(stepValue('', 1, CAP)).toBe('1');
    expect(stepValue('abc', -1, CAP)).toBe('0');
  });

  it('rounds away floating point noise', () => {
    expect(stepValue('0.1', 0.2, PRICE)).toBe('0.3');
    expect(stepValue('7,5', 0.5, PRICE)).toBe('8');
  });
});

describe('stepperKeyValue', () => {
  it('maps spinbutton keys', () => {
    expect(stepperKeyValue('ArrowUp', '100', CAP)).toBe('101');
    expect(stepperKeyValue('ArrowDown', '100', CAP)).toBe('99');
    expect(stepperKeyValue('PageUp', '100', CAP)).toBe('110');
    expect(stepperKeyValue('PageDown', '100', CAP)).toBe('90');
    expect(stepperKeyValue('Home', '100', CAP)).toBe('0');
    expect(stepperKeyValue('End', '100', CAP)).toBe('10000');
    expect(stepperKeyValue('a', '100', CAP)).toBeNull();
  });
});

function Harness(props: { initial: string; bounds?: StepperBounds }) {
  const [value, setValue] = useState(props.initial);
  return (
    <NumberStepper id="cap" label="Capacidad diaria" value={value} onChange={setValue}
      bounds={props.bounds ?? CAP} hint="Personas por día" />
  );
}

describe('NumberStepper', () => {
  it('exposes a labelled spinbutton with its bounds and hint', () => {
    render(<Harness initial="100" />);
    const input = screen.getByRole('spinbutton', { name: 'Capacidad diaria' });
    expect(input).toHaveValue('100');
    expect(input).toHaveAttribute('aria-valuemin', '0');
    expect(input).toHaveAttribute('aria-valuemax', '10000');
    expect(input).toHaveAttribute('aria-valuenow', '100');
    expect(input).toHaveAccessibleDescription('Personas por día');
  });

  it('− and + buttons step the value and are 44px targets', async () => {
    render(<Harness initial="100" />);
    const plus = screen.getByRole('button', { name: 'Aumentar Capacidad diaria' });
    const minus = screen.getByRole('button', { name: 'Disminuir Capacidad diaria' });
    expect(plus.className).toContain('size-11');
    expect(minus.className).toContain('size-11');
    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(screen.getByRole('spinbutton')).toHaveValue('102');
    await userEvent.click(minus);
    expect(screen.getByRole('spinbutton')).toHaveValue('101');
  });

  it('disables − at the minimum and + at the maximum', () => {
    const { unmount } = render(<Harness initial="0" />);
    expect(screen.getByRole('button', { name: 'Disminuir Capacidad diaria' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' })).toBeEnabled();
    unmount();
    render(<Harness initial="10000" />);
    expect(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' })).toBeDisabled();
  });

  it('supports the spinbutton keyboard pattern', async () => {
    render(<Harness initial="100" />);
    const input = screen.getByRole('spinbutton');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('101');
    await userEvent.keyboard('{PageDown}');
    expect(input).toHaveValue('91');
    await userEvent.keyboard('{End}');
    expect(input).toHaveValue('10000');
    await userEvent.keyboard('{Home}');
    expect(input).toHaveValue('0');
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveValue('0');
  });

  it('still accepts typed values', async () => {
    render(<Harness initial="7" bounds={PRICE} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '12.25');
    expect(input).toHaveValue('12.25');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/number-stepper.test.tsx`
Expected: FAIL — no se resuelve `./number-stepper`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/number-stepper.tsx
'use client';

import type { KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION, ADMIN_INPUT } from '../ui-constants';

export interface StepperBounds {
  min: number;
  max: number;
  step: number;
  decimals: number;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** The field as a number; '' or garbage → null. Accepts a decimal comma. */
export function parseStepperValue(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** current ± delta, rounded and clamped. An empty/invalid field steps from `min`. */
export function stepValue(current: string, delta: number, b: StepperBounds): string {
  const base = parseStepperValue(current) ?? b.min;
  const next = Math.min(b.max, Math.max(b.min, round(base + delta, b.decimals)));
  return String(next);
}

/** WAI-ARIA spinbutton keys → new value, or null for keys we don't handle. */
export function stepperKeyValue(key: string, current: string, b: StepperBounds): string | null {
  switch (key) {
    case 'ArrowUp': return stepValue(current, b.step, b);
    case 'ArrowDown': return stepValue(current, -b.step, b);
    case 'PageUp': return stepValue(current, b.step * 10, b);
    case 'PageDown': return stepValue(current, -b.step * 10, b);
    case 'Home': return String(b.min);
    case 'End': return String(b.max);
    default: return null;
  }
}

export function NumberStepper(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  bounds: StepperBounds;
  hint?: string;
  unit?: string;
}) {
  const b = props.bounds;
  const n = parseStepperValue(props.value);
  const hintId = props.hint ? `${props.id}-hint` : undefined;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const next = stepperKeyValue(e.key, props.value, b);
    if (next === null) return;
    e.preventDefault();
    props.onChange(next);
  }

  return (
    <div>
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Button
          type="button" variant="outline" size="icon" className={ADMIN_ICON_ACTION}
          aria-label={`Disminuir ${props.label}`}
          disabled={n !== null && n <= b.min}
          onClick={() => props.onChange(stepValue(props.value, -b.step, b))}
        >
          <Minus />
        </Button>
        <Input
          id={props.id}
          role="spinbutton"
          inputMode={b.decimals > 0 ? 'decimal' : 'numeric'}
          className={cn(ADMIN_INPUT, 'w-28 text-center tabular-nums')}
          value={props.value}
          aria-valuemin={b.min}
          aria-valuemax={b.max}
          aria-valuenow={n ?? undefined}
          aria-describedby={hintId}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          type="button" variant="outline" size="icon" className={ADMIN_ICON_ACTION}
          aria-label={`Aumentar ${props.label}`}
          disabled={n !== null && n >= b.max}
          onClick={() => props.onChange(stepValue(props.value, b.step, b))}
        >
          <Plus />
        </Button>
        {props.unit && <span className="text-sm text-muted-foreground">{props.unit}</span>}
      </div>
      {props.hint && <p id={hintId} className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/number-stepper.test.tsx`
Expected: PASS (11 tests). Si `toHaveAccessibleDescription` falla porque base-ui `Input` descarta `aria-describedby`, verifica con `screen.getByRole('spinbutton').getAttribute('aria-describedby')` — **no** cambies el test: corrige el componente pasando el atributo (base-ui reenvía props desconocidos al `<input>`).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/number-stepper.tsx src/components/admin/settings/number-stepper.test.tsx
git commit -m "feat(admin): add touch and keyboard friendly number stepper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Proyección de ingresos al 100 %

**Files:**
- Create: `src/components/admin/settings/projection.ts`
- Test: `src/components/admin/settings/projection.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { projectRevenue } from './projection';

describe('projectRevenue', () => {
  it('returns both extremes of a full day', () => {
    expect(projectRevenue(100, 7, 1)).toEqual({
      capacity: 100, allAdults: 700, allChildren: 100, min: 100, max: 700,
    });
  });

  it('orders min/max even if children cost more than adults', () => {
    const p = projectRevenue(10, 2, 5)!;
    expect(p.allAdults).toBe(20);
    expect(p.allChildren).toBe(50);
    expect(p.min).toBe(20);
    expect(p.max).toBe(50);
  });

  it('rounds to cents', () => {
    expect(projectRevenue(3, 0.1, 0.2)).toMatchObject({ allAdults: 0.3, allChildren: 0.6 });
  });

  it('is zero for a closed (capacity 0) day', () => {
    expect(projectRevenue(0, 7, 1)).toMatchObject({ min: 0, max: 0 });
  });

  it('returns null for invalid inputs', () => {
    expect(projectRevenue(Number.NaN, 7, 1)).toBeNull();
    expect(projectRevenue(10.5, 7, 1)).toBeNull();
    expect(projectRevenue(-1, 7, 1)).toBeNull();
    expect(projectRevenue(10, -1, 1)).toBeNull();
    expect(projectRevenue(10, 7, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/projection.test.ts`
Expected: FAIL — no se resuelve `./projection`.

- [ ] **Step 3: Implementar**

```ts
// src/components/admin/settings/projection.ts
import { roundMoney } from '@/lib/money';

export interface RevenueProjection {
  capacity: number;
  allAdults: number;
  allChildren: number;
  min: number;
  max: number;
}

/**
 * Daily revenue when every one of `capacity` slots is sold. Real revenue
 * depends on the adult/child mix, so we return the two extremes instead of
 * inventing a mix. null when capacity is not an integer ≥ 0 or a price is not
 * a finite number ≥ 0.
 */
export function projectRevenue(
  capacity: number,
  adultPrice: number,
  childPrice: number,
): RevenueProjection | null {
  const pricesOk = [adultPrice, childPrice].every((p) => Number.isFinite(p) && p >= 0);
  if (!Number.isInteger(capacity) || capacity < 0 || !pricesOk) return null;
  const allAdults = roundMoney(capacity * adultPrice);
  const allChildren = roundMoney(capacity * childPrice);
  return {
    capacity,
    allAdults,
    allChildren,
    min: Math.min(allAdults, allChildren),
    max: Math.max(allAdults, allChildren),
  };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/projection.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/projection.ts src/components/admin/settings/projection.test.ts
git commit -m "feat(admin): compute full-capacity revenue range" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Edad de la tasa BCV (hora de Caracas)

**Files:**
- Create: `src/components/admin/settings/bcv-age.ts`
- Test: `src/components/admin/settings/bcv-age.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { rateAgeLabel, rateStampEs, rateFreshness } from './bcv-age';

const NOW = Date.parse('2030-01-15T16:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('rateAgeLabel', () => {
  it('uses minutes, hours and days in Spanish with singular/plural', () => {
    expect(rateAgeLabel(ago(20_000), NOW)).toBe('hace menos de 1 minuto');
    expect(rateAgeLabel(ago(1 * MIN), NOW)).toBe('hace 1 minuto');
    expect(rateAgeLabel(ago(30 * MIN), NOW)).toBe('hace 30 minutos');
    expect(rateAgeLabel(ago(1 * HOUR), NOW)).toBe('hace 1 hora');
    expect(rateAgeLabel(ago(5 * HOUR + 59 * MIN), NOW)).toBe('hace 5 horas');
    expect(rateAgeLabel(ago(24 * HOUR), NOW)).toBe('hace 1 día');
    expect(rateAgeLabel(ago(72 * HOUR), NOW)).toBe('hace 3 días');
  });

  it('treats a future timestamp (clock skew) as just now', () => {
    expect(rateAgeLabel(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe('hace menos de 1 minuto');
  });
});

describe('rateStampEs', () => {
  it('formats date and time in Caracas time (UTC-4)', () => {
    const s = rateStampEs('2026-10-04T17:05:00Z');
    expect(s).toContain('4 oct');
    expect(s).toContain('13:05');
  });

  it('uses the Caracas calendar day, not the UTC one', () => {
    const s = rateStampEs('2026-10-05T02:00:00Z'); // 22:00 on Oct 4 in Caracas
    expect(s).toContain('4 oct');
    expect(s).toContain('22:00');
  });
});

describe('rateFreshness', () => {
  it('is fresh < 1 h, stale < 24 h, expired after', () => {
    expect(rateFreshness(ago(59 * MIN), NOW)).toBe('fresh');
    expect(rateFreshness(ago(2 * HOUR), NOW)).toBe('stale');
    expect(rateFreshness(ago(25 * HOUR), NOW)).toBe('expired');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/bcv-age.test.ts`
Expected: FAIL — no se resuelve `./bcv-age`.

- [ ] **Step 3: Implementar**

```ts
// src/components/admin/settings/bcv-age.ts
import { caracasTime, shortDateEs } from '@/lib/dates';

// Mirrors FRESH_MS / MAX_STALE_MS in src/lib/bcv.ts. Not imported from there on
// purpose: that module lazy-imports 'undici' and must stay out of client bundles.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "hace 25 minutos" — age of the cached rate. */
export function rateAgeLabel(atIso: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(atIso));
  if (ms < MIN) return 'hace menos de 1 minuto';
  if (ms < HOUR) return `hace ${plural(Math.floor(ms / MIN), 'minuto', 'minutos')}`;
  if (ms < DAY) return `hace ${plural(Math.floor(ms / HOUR), 'hora', 'horas')}`;
  return `hace ${plural(Math.floor(ms / DAY), 'día', 'días')}`;
}

/** "dom, 4 oct. · 13:05" — when the rate was fetched, in Caracas time. */
export function rateStampEs(atIso: string): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(atIso));
  return `${shortDateEs(day)} · ${caracasTime(atIso)}`;
}

export type RateFreshness = 'fresh' | 'stale' | 'expired';

/** fresh: served from cache; stale: next use refetches; expired: no fallback if BCV is down. */
export function rateFreshness(atIso: string, now: number): RateFreshness {
  const ms = now - Date.parse(atIso);
  if (ms < HOUR) return 'fresh';
  if (ms < DAY) return 'stale';
  return 'expired';
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/bcv-age.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/bcv-age.ts src/components/admin/settings/bcv-age.test.ts
git commit -m "feat(admin): describe BCV rate age in Caracas time" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `BcvCard` — tasa en caché + "Actualizar tasa ahora"

**Files:**
- Create: `src/components/admin/settings/bcv-card.tsx`
- Test: `src/components/admin/settings/bcv-card.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/settings-actions', () => ({ adminRefreshBcvRate: vi.fn() }));

import { BcvCard } from './bcv-card';
import { adminRefreshBcvRate } from '@/app/admin/settings-actions';

const NOW = Date.parse('2030-01-15T16:00:00Z');

beforeEach(() => vi.clearAllMocks());

describe('BcvCard', () => {
  it('shows the cached rate, its age and the Caracas time', () => {
    render(<BcvCard rate={36.5} at="2030-01-15T15:30:00Z" now={NOW} />);
    expect(screen.getByText(/Bs\. 36\.50/)).toBeInTheDocument();
    expect(screen.getByText(/hace 30 minutos/)).toBeInTheDocument();
    expect(screen.getByText(/11:30/)).toBeInTheDocument();
    expect(screen.getByText(/hora de Caracas/)).toBeInTheDocument();
  });

  it('explains when there is no cached rate yet', () => {
    render(<BcvCard rate={null} at={null} now={NOW} />);
    expect(screen.getByText('Aún no hay una tasa guardada.')).toBeInTheDocument();
  });

  it('warns when the cached rate is older than 24 h', () => {
    render(<BcvCard rate={36.5} at="2030-01-13T12:00:00Z" now={NOW} />);
    expect(screen.getByText(/Tiene más de 24 horas/)).toBeInTheDocument();
  });

  it('refreshes on demand and shows the new rate', async () => {
    vi.mocked(adminRefreshBcvRate).mockResolvedValue({ ok: true, rate: 40.12, at: '2030-01-15T16:00:00.000Z' });
    render(<BcvCard rate={36.5} at="2030-01-15T12:00:00Z" now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar tasa ahora' }));
    expect(adminRefreshBcvRate).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Tasa actualizada: Bs. 40.12 por USD.')).toBeInTheDocument();
    expect(screen.getByText(/hace menos de 1 minuto/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the action error and keeps the old rate', async () => {
    vi.mocked(adminRefreshBcvRate).mockResolvedValue({
      ok: false, message: 'No se pudo obtener la tasa del BCV. Intenta de nuevo en unos minutos.',
    });
    render(<BcvCard rate={36.5} at="2030-01-15T15:30:00Z" now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar tasa ahora' }));
    expect(await screen.findByText(/No se pudo obtener la tasa del BCV/)).toBeInTheDocument();
    expect(screen.getByText(/Bs\. 36\.50/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('disables the button while refreshing', async () => {
    let resolve!: (v: { ok: true; rate: number; at: string }) => void;
    vi.mocked(adminRefreshBcvRate).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<BcvCard rate={36.5} at="2030-01-15T15:30:00Z" now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar tasa ahora' }));
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();
    resolve({ ok: true, rate: 40, at: '2030-01-15T16:00:00.000Z' });
    expect(await screen.findByRole('button', { name: 'Actualizar tasa ahora' })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/bcv-card.test.tsx`
Expected: FAIL — no se resuelve `./bcv-card`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/bcv-card.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ADMIN_ACTION } from '../ui-constants';
import { adminRefreshBcvRate } from '@/app/admin/settings-actions';
import { rateAgeLabel, rateFreshness, rateStampEs } from './bcv-age';

/** `now` comes from the server render so SSR and hydration print the same age. */
export function BcvCard(props: { rate: number | null; at: string | null; now: number }) {
  const router = useRouter();
  const [rate, setRate] = useState(props.rate);
  const [at, setAt] = useState(props.at);
  const [now, setNow] = useState(props.now);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function refresh() {
    setBusy(true);
    setStatus(null);
    const res = await adminRefreshBcvRate();
    setBusy(false);
    if (res.ok) {
      setRate(res.rate);
      setAt(res.at);
      setNow(Date.parse(res.at));
      setStatus({ kind: 'ok', text: `Tasa actualizada: Bs. ${res.rate.toFixed(2)} por USD.` });
      router.refresh();
    } else {
      setStatus({ kind: 'error', text: res.message });
    }
  }

  return (
    <section aria-labelledby="bcv-title" className="rounded-2xl border bg-white p-4">
      <h2 id="bcv-title" className="font-extrabold">Tasa BCV</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Se usa para cobrar en bolívares. Se renueva sola (como máximo cada hora) cuando la web la necesita; aquí puedes forzarla.
      </p>

      {rate === null ? (
        <p className="text-sm text-muted-foreground">Aún no hay una tasa guardada.</p>
      ) : (
        <div>
          <p className="text-2xl font-extrabold tabular-nums text-navy">
            Bs. {rate.toFixed(2)} <span className="text-sm font-semibold text-muted-foreground">por USD</span>
          </p>
          {at && (
            <p className="text-sm text-muted-foreground">
              Actualizada {rateAgeLabel(at, now)} ·{' '}
              <span className="inline-block first-letter:uppercase">{rateStampEs(at)}</span> (hora de Caracas)
            </p>
          )}
          {at && rateFreshness(at, now) === 'expired' && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Tiene más de 24 horas. Actualízala para evitar errores al cobrar en bolívares.
            </p>
          )}
        </div>
      )}

      <p role="status" className="mt-3 min-h-5 text-sm">
        {status && (
          <span className={status.kind === 'ok' ? 'font-semibold text-green-700' : 'text-destructive'}>{status.text}</span>
        )}
      </p>
      <div className="mt-2 flex justify-end">
        <Button variant="outline" className={ADMIN_ACTION} disabled={busy} onClick={refresh}>
          <RefreshCw aria-hidden className={cn(busy && 'motion-safe:animate-spin')} />
          {busy ? 'Actualizando…' : 'Actualizar tasa ahora'}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/bcv-card.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/bcv-card.tsx src/components/admin/settings/bcv-card.test.tsx
git commit -m "feat(admin): show cached BCV rate with manual refresh button" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `GeneralPanel` — steppers, proyección, dirty tracking y BCV

**Files:**
- Create: `src/components/admin/settings/general-panel.tsx`
- Test: `src/components/admin/settings/general-panel.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/actions', () => ({ adminUpdateSettings: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock('@/app/admin/settings-actions', () => ({ adminRefreshBcvRate: vi.fn() }));

import { GeneralPanel } from './general-panel';
import { adminUpdateSettings } from '@/app/admin/actions';

const NOW = Date.parse('2030-01-15T16:00:00Z');
const settings = {
  daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1,
  last_bcv_rate: 36.5, last_bcv_rate_at: '2030-01-15T15:30:00Z',
};

const adultsLine = () => screen.getByText(/Si todos son adultos/).closest('li')!;
const childrenLine = () => screen.getByText(/Si todos son niños/).closest('li')!;

beforeEach(() => vi.clearAllMocks());

describe('GeneralPanel', () => {
  it('projects full-capacity revenue as an honest range', () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    expect(screen.getByText(/Con 100 personas \(100 % de la capacidad\)/)).toBeInTheDocument();
    expect(adultsLine()).toHaveTextContent('$700.00');
    expect(childrenLine()).toHaveTextContent('$100.00');
    expect(screen.getByText(/depende de cuántos adultos y niños/)).toBeInTheDocument();
  });

  it('shows the VES equivalent at the cached BCV rate', () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    expect(screen.getByText(/Bs\. 3650\.00 – Bs\. 25550\.00/)).toBeInTheDocument();
  });

  it('updates the projection live when a stepper changes', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    expect(adultsLine()).toHaveTextContent('$707.00');

    const adult = screen.getByRole('spinbutton', { name: 'Precio adulto (USD)' });
    adult.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(adult).toHaveValue('7.5');
    expect(adultsLine()).toHaveTextContent('$757.50');
  });

  it('asks to complete the fields when one is empty', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Capacidad diaria' }));
    expect(screen.getByText('Completa capacidad y precios para ver la proyección.')).toBeInTheDocument();
  });

  it('tracks dirty state, saves parsed numbers and can discard', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    const save = screen.getByRole('button', { name: 'Guardar configuración' });
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument();
    expect(save).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByRole('spinbutton', { name: 'Capacidad diaria' })).toHaveValue('100');
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    await userEvent.click(save);
    expect(adminUpdateSettings).toHaveBeenCalledWith({ daily_capacity: 101, adult_price_usd: 7, child_price_usd: 1 });
    expect(await screen.findByText('✓ Todos los cambios están guardados.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('does not save when a field is empty', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Precio niño (USD)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(screen.getByText('Todos los campos son requeridos.')).toBeInTheDocument();
    expect(adminUpdateSettings).not.toHaveBeenCalled();
  });

  it('includes the BCV card', () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Tasa BCV' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/general-panel.test.tsx`
Expected: FAIL — no se resuelve `./general-panel`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/general-panel.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DIALOG_ACTION } from '../ui-constants';
import { adminUpdateSettings } from '@/app/admin/actions';
import { totalUsd, usdToVes } from '@/lib/money';
import type { SettingsRow } from '@/lib/db/reservations';
import { NumberStepper, parseStepperValue, type StepperBounds } from './number-stepper';
import { projectRevenue } from './projection';
import { BcvCard } from './bcv-card';

// Same limits as settingsSchema in src/app/admin/actions.ts.
export const CAPACITY_BOUNDS: StepperBounds = { min: 0, max: 10000, step: 1, decimals: 0 };
export const PRICE_BOUNDS: StepperBounds = { min: 0, max: 1000, step: 0.5, decimals: 2 };

type SaveState = 'idle' | 'saving' | 'saved';

const usd = (n: number) => `$${n.toFixed(2)}`;
const ves = (n: number) => `Bs. ${n.toFixed(2)}`;

export function GeneralPanel(props: { settings: SettingsRow; now: number }) {
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(props.settings.daily_capacity));
  const [adult, setAdult] = useState(String(props.settings.adult_price_usd));
  const [child, setChild] = useState(String(props.settings.child_price_usd));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const cap = parseStepperValue(capacity);
  const adultN = parseStepperValue(adult);
  const childN = parseStepperValue(child);
  const projection = cap !== null && adultN !== null && childN !== null
    ? projectRevenue(cap, adultN, childN)
    : null;
  const preview = totalUsd(2, 1, { adult: adultN ?? 0, child: childN ?? 0 });
  const rate = props.settings.last_bcv_rate != null ? Number(props.settings.last_bcv_rate) : null;

  const dirty =
    capacity !== String(props.settings.daily_capacity) ||
    adult !== String(props.settings.adult_price_usd) ||
    child !== String(props.settings.child_price_usd);

  function edit(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setSaveState('idle');
      setError(null);
    };
  }

  function discard() {
    setCapacity(String(props.settings.daily_capacity));
    setAdult(String(props.settings.adult_price_usd));
    setChild(String(props.settings.child_price_usd));
    setSaveState('idle');
    setError(null);
  }

  async function save() {
    setError(null);
    if (cap === null || adultN === null || childN === null) {
      setError('Todos los campos son requeridos.');
      return;
    }
    setSaveState('saving');
    const res = await adminUpdateSettings({
      daily_capacity: cap,
      adult_price_usd: Math.round(adultN * 100) / 100,
      child_price_usd: Math.round(childN * 100) / 100,
    });
    if (res.ok) { setSaveState('saved'); router.refresh(); }
    else { setSaveState('idle'); setError(res.message ?? 'No se pudo guardar.'); }
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="general-title" className="rounded-2xl border bg-white p-4">
        <h2 id="general-title" className="font-extrabold">Parámetros generales</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Estos valores se aplican a las reservas nuevas y pueden cambiarse en cualquier momento.
        </p>

        <div className="space-y-4">
          <NumberStepper
            id="capacity" label="Capacidad diaria" value={capacity} onChange={edit(setCapacity)}
            bounds={CAPACITY_BOUNDS} unit="personas"
            hint="Límite máximo de personas que pueden ingresar en un día normal."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberStepper id="adult" label="Precio adulto (USD)" value={adult} onChange={edit(setAdult)} bounds={PRICE_BOUNDS} />
            <NumberStepper id="child" label="Precio niño (USD)" value={child} onChange={edit(setChild)} bounds={PRICE_BOUNDS} />
          </div>

          <section aria-labelledby="projection-title" className="rounded-xl bg-sky-50 p-3 text-sm text-slate-700">
            <h3 id="projection-title" className="font-semibold">Proyección de ingresos con el día lleno</h3>
            {projection ? (
              <>
                <p className="mt-1">
                  Con {projection.capacity} {projection.capacity === 1 ? 'persona' : 'personas'} (100 % de la capacidad),
                  un día lleno deja entre <b>{usd(projection.min)}</b> y <b>{usd(projection.max)}</b> USD.
                </p>
                <ul className="mt-2 space-y-1">
                  <li>Si todos son adultos: <b className="tabular-nums">{usd(projection.allAdults)}</b></li>
                  <li>Si todos son niños: <b className="tabular-nums">{usd(projection.allChildren)}</b></li>
                </ul>
                {rate !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ≈ {ves(usdToVes(projection.min, rate))} – {ves(usdToVes(projection.max, rate))} a la tasa BCV guardada ({ves(rate)} por USD).
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  El ingreso real depende de cuántos adultos y niños reserven, y no incluye las excepciones de capacidad.
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">Completa capacidad y precios para ver la proyección.</p>
            )}
          </section>

          <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
            Una reserva de 2 adultos y 1 niño tendrá un valor estimado de <b>${preview.toFixed(2)} USD</b>.
          </p>
        </div>

        {/* Footer de acciones — descartar a la izquierda, guardar a la derecha */}
        <div className="mt-4 border-t pt-4">
          {/* 'saved' wins over 'dirty': until router.refresh() brings the new props, the
              fields still differ from props.settings. Any edit resets saveState to 'idle'. */}
          <p role="status" className="mb-3 text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : saveState === 'saved' ? (
              <span className="font-semibold text-green-700">✓ Todos los cambios están guardados.</span>
            ) : dirty ? (
              <span className="text-amber-700">Tienes cambios sin guardar.</span>
            ) : null}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {dirty && (
                <Button variant="ghost" className={DIALOG_ACTION} onClick={discard} disabled={saveState === 'saving'}>
                  Descartar
                </Button>
              )}
            </div>
            <Button className={DIALOG_ACTION} onClick={save} disabled={!dirty || saveState === 'saving'}>
              {saveState === 'saving' ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>
        </div>
      </section>

      <BcvCard rate={rate} at={props.settings.last_bcv_rate_at} now={props.now} />
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/general-panel.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/general-panel.tsx src/components/admin/settings/general-panel.test.tsx
git commit -m "feat(admin): general settings panel with steppers and revenue projection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Presets de motivo + `ExceptionDialog` con chips y `defaultDate`

**Files:**
- Create: `src/components/admin/settings/reason-presets.ts`
- Test: `src/components/admin/settings/reason-presets.test.ts`
- Modify: `src/components/admin/exception-dialog.tsx`
- Test: `src/components/admin/exception-dialog.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/components/admin/settings/reason-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { REASON_PRESETS, reasonKind } from './reason-presets';

describe('reasonKind', () => {
  it('lists the quick presets in order', () => {
    expect(REASON_PRESETS).toEqual(['Mantenimiento', 'Evento privado', 'Feriado']);
  });

  it('matches presets case-insensitively and ignoring outer spaces', () => {
    expect(reasonKind('Mantenimiento')).toBe('Mantenimiento');
    expect(reasonKind('  feriado ')).toBe('Feriado');
    expect(reasonKind('EVENTO PRIVADO')).toBe('Evento privado');
  });

  it('classifies any other free text as Otro', () => {
    expect(reasonKind('Mantenimiento de piscina')).toBe('Otro');
    expect(reasonKind('Boda')).toBe('Otro');
  });

  it('returns null when there is no reason', () => {
    expect(reasonKind(null)).toBeNull();
    expect(reasonKind(undefined)).toBeNull();
    expect(reasonKind('   ')).toBeNull();
  });
});
```

Añadir al final del `describe` de `src/components/admin/exception-dialog.test.tsx` (mantener los dos tests existentes):

```tsx
  it('prefills the date when opened from a calendar day', () => {
    render(<ExceptionDialog open onOpenChange={() => {}} defaultDate="2030-08-10" onSave={vi.fn().mockResolvedValue({ ok: true })} />);
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('2030-08-10');
    expect(screen.getByLabelText(/Fecha/i)).toBeEnabled();
  });

  it('reason chips fill the reason and reflect the pressed state', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<ExceptionDialog open onOpenChange={() => {}} defaultDate="2030-08-10" onSave={onSave} />);
    const feriado = screen.getByRole('button', { name: 'Feriado' });
    expect(feriado).toHaveAttribute('aria-pressed', 'false');
    expect(feriado.className).toContain('min-h-11');
    await userEvent.click(feriado);
    expect(screen.getByLabelText(/Motivo/i)).toHaveValue('Feriado');
    expect(feriado).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Guardar excepción/i }));
    expect(onSave).toHaveBeenCalledWith('2030-08-10', 25, 'Feriado');
  });

  it('"Otro" clears the reason and focuses the free-text field', async () => {
    render(<ExceptionDialog open onOpenChange={() => {}}
      initial={{ date: '2030-08-15', capacity: 0, reason: 'Mantenimiento' }}
      onSave={vi.fn().mockResolvedValue({ ok: true })} />);
    expect(screen.getByRole('button', { name: 'Mantenimiento' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Otro' }));
    const reason = screen.getByLabelText(/Motivo/i);
    expect(reason).toHaveValue('');
    expect(reason).toHaveFocus();
    await userEvent.type(reason, 'Boda');
    expect(screen.getByRole('button', { name: 'Otro' })).toHaveAttribute('aria-pressed', 'true');
  });
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/reason-presets.test.ts src/components/admin/exception-dialog.test.tsx`
Expected: FAIL — no se resuelve `./reason-presets`; los tests nuevos del diálogo fallan (no hay `defaultDate` ni chips). Los 2 tests antiguos siguen pasando.

- [ ] **Step 3: Implementar `reason-presets.ts`**

```ts
// src/components/admin/settings/reason-presets.ts
/** Quick presets for capacity_overrides.reason (still free text in the DB). */
export const REASON_PRESETS = ['Mantenimiento', 'Evento privado', 'Feriado'] as const;

export type ReasonPreset = (typeof REASON_PRESETS)[number];
export type ReasonKind = ReasonPreset | 'Otro';

/** Which chip a stored reason belongs to; null when there is no reason. */
export function reasonKind(reason: string | null | undefined): ReasonKind | null {
  const r = reason?.trim() ?? '';
  if (r === '') return null;
  return REASON_PRESETS.find((p) => p.toLowerCase() === r.toLowerCase()) ?? 'Otro';
}

export const REASON_CHIP_CLASS: Record<ReasonKind, string> = {
  Mantenimiento: 'bg-amber-100 text-amber-900',
  'Evento privado': 'bg-violet-100 text-violet-900',
  Feriado: 'bg-teal/20 text-navy',
  Otro: 'bg-slate-100 text-slate-700',
};
```

- [ ] **Step 4: Reescribir `exception-dialog.tsx`**

Reemplazar el contenido completo de `src/components/admin/exception-dialog.tsx` por:

```tsx
'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DIALOG_FOOTER, DIALOG_ACTION, ADMIN_INPUT } from './ui-constants';
import { REASON_PRESETS, reasonKind, type ReasonKind } from './settings/reason-presets';

const CHIPS: ReasonKind[] = [...REASON_PRESETS, 'Otro'];

export function ExceptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, capacity: number, reason?: string) => Promise<{ ok: boolean; message?: string }>;
  initial?: { date: string; capacity: number; reason: string | null };
  /** Prefilled date for a new exception (e.g. the calendar day that was clicked). */
  defaultDate?: string;
}) {
  const [date, setDate] = useState(props.initial?.date ?? props.defaultDate ?? '');
  const [closed, setClosed] = useState(props.initial ? props.initial.capacity === 0 : false);
  const [capacity, setCapacity] = useState(String(props.initial && props.initial.capacity > 0 ? props.initial.capacity : 25));
  const [reason, setReason] = useState(props.initial?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(props.initial);
  const kind = reasonKind(reason);

  function pickChip(chip: ReasonKind) {
    if (chip === 'Otro') {
      setReason('');
      reasonRef.current?.focus();
    } else {
      setReason(chip);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>{editing ? 'Editar excepción' : 'Nueva excepción'}</DialogTitle>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="ex-date">Fecha</Label>
            <Input id="ex-date" type="date" className={ADMIN_INPUT} value={date}
              disabled={editing} onChange={(e) => setDate(e.target.value)} />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Tipo de día</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={!closed} onChange={() => setClosed(false)} />
              Capacidad especial
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={closed} onChange={() => setClosed(true)} />
              Día cerrado
            </label>
          </fieldset>
          {!closed && (
            <div>
              <Label htmlFor="ex-cap">Capacidad máxima</Label>
              <Input id="ex-cap" type="number" min={1} className={ADMIN_INPUT} value={capacity}
                onChange={(e) => setCapacity(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ex-reason">Motivo (opcional)</Label>
            <div role="group" aria-label="Atajos rápidos" className="mt-1 flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={kind === chip}
                  onClick={() => pickChip(chip)}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none',
                    kind === chip ? 'border-navy bg-navy text-white' : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Input id="ex-reason" ref={reasonRef} className={cn(ADMIN_INPUT, 'mt-2')}
              placeholder="Escribe el motivo" maxLength={200}
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className={DIALOG_FOOTER}>
          <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cancelar</Button>} />
          <Button className={DIALOG_ACTION} disabled={busy} onClick={async () => {
            setError(null);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Selecciona una fecha válida.'); return; }
            const cap = closed ? 0 : Number(capacity);
            if (!closed && (!Number.isInteger(cap) || cap < 1)) { setError('Capacidad inválida.'); return; }
            setBusy(true);
            const res = await props.onSave(date, cap, reason.trim() || undefined);
            setBusy(false);
            if (res.ok) props.onOpenChange(false);
            else setError(res.message ?? 'No se pudo guardar.');
          }}>
            {busy ? 'Guardando…' : 'Guardar excepción'}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/reason-presets.test.ts src/components/admin/exception-dialog.test.tsx`
Expected: PASS (4 + 5 tests). Si el foco no llega al input (base-ui `Input` debería recibir `ref` como prop en React 19), reemplaza `reasonRef.current?.focus()` por `document.getElementById('ex-reason')?.focus()` y deja el test igual.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/settings/reason-presets.ts src/components/admin/settings/reason-presets.test.ts src/components/admin/exception-dialog.tsx src/components/admin/exception-dialog.test.tsx
git commit -m "feat(admin): quick reason chips and prefilled date in exception dialog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Rejilla mensual (lunes primero)

**Files:**
- Create: `src/components/admin/settings/month-grid.ts`
- Test: `src/components/admin/settings/month-grid.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { monthGrid, shiftMonth, monthLabelEs, WEEKDAYS_ES } from './month-grid';

describe('monthGrid', () => {
  it('builds Monday-first weeks padded with null (Oct 2026 starts on Thursday)', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('fits a 28-day February starting on Monday in exactly 4 weeks', () => {
    const weeks = monthGrid('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks[3][6]).toBe('2027-02-28');
  });

  it('handles a leap February', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });
});

describe('monthLabelEs', () => {
  it('is the Spanish month and year (lowercase; the UI uppercases the first letter)', () => {
    expect(monthLabelEs('2030-09')).toBe('septiembre de 2030');
  });
});

it('weekday headers start on Monday', () => {
  expect(WEEKDAYS_ES.map((d) => d.short)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/month-grid.test.ts`
Expected: FAIL — no se resuelve `./month-grid`.

- [ ] **Step 3: Implementar**

```ts
// src/components/admin/settings/month-grid.ts
// Calendar math on plain 'YYYY-MM' / 'YYYY-MM-DD' strings in UTC, so the grid
// never shifts with the browser's timezone (dates are Caracas calendar days).

function parts(month: string): { y: number; m: number } {
  return { y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) };
}

/** Monday-first weeks for 'YYYY-MM'; null pads the days outside the month. */
export function monthGrid(month: string): (string | null)[][] {
  const { y, m } = parts(month);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 'YYYY-MM' moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const { y, m } = parts(month);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "septiembre de 2030". */
export function monthLabelEs(month: string): string {
  const { y, m } = parts(month);
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
}

export const WEEKDAYS_ES = [
  { short: 'L', long: 'lunes' },
  { short: 'M', long: 'martes' },
  { short: 'X', long: 'miércoles' },
  { short: 'J', long: 'jueves' },
  { short: 'V', long: 'viernes' },
  { short: 'S', long: 'sábado' },
  { short: 'D', long: 'domingo' },
] as const;
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/month-grid.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/month-grid.ts src/components/admin/settings/month-grid.test.ts
git commit -m "feat(admin): Monday-first month grid helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `ExceptionsCalendar` — resaltado de días cerrados/especiales

**Files:**
- Create: `src/components/admin/settings/exceptions-calendar.tsx`
- Test: `src/components/admin/settings/exceptions-calendar.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExceptionsCalendar, dayKind } from './exceptions-calendar';
import type { OverrideRow } from '@/lib/db/reservations';

const rows: OverrideRow[] = [
  { date: '2030-08-15', capacity: 0, reason: 'Mantenimiento' },
  { date: '2030-08-20', capacity: 40, reason: null },
];
const overrides = new Map(rows.map((o) => [o.date, o]));

function setup(today = '2030-08-01') {
  const onSelectDay = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <ExceptionsCalendar month="2030-08" today={today} overrides={overrides}
      onSelectDay={onSelectDay} onMonthChange={onMonthChange} />,
  );
  return { onSelectDay, onMonthChange };
}

describe('dayKind', () => {
  it('classifies overrides', () => {
    expect(dayKind(undefined)).toBe('normal');
    expect(dayKind(rows[0])).toBe('closed');
    expect(dayKind(rows[1])).toBe('special');
  });
});

describe('ExceptionsCalendar', () => {
  it('renders the month with one button per day', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'agosto de 2030' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /de agosto/ })).toHaveLength(31);
  });

  it('highlights closed and special days with distinct styles and labels', () => {
    setup();
    const closed = screen.getByRole('button', { name: /15 de agosto: cerrado \(Mantenimiento\)/ });
    const special = screen.getByRole('button', { name: /20 de agosto: capacidad especial de 40/ });
    const normal = screen.getByRole('button', { name: /10 de agosto: sin excepción/ });
    expect(closed).toHaveAttribute('data-kind', 'closed');
    expect(special).toHaveAttribute('data-kind', 'special');
    expect(normal).toHaveAttribute('data-kind', 'normal');
    expect(closed.className).toContain('bg-coral/20');
    expect(special.className).toContain('bg-teal/20');
    expect(closed.className).not.toBe(special.className);
    expect(closed).toHaveTextContent('Cerr.');
    expect(special).toHaveTextContent('40');
  });

  it('shows a legend', () => {
    setup();
    const legend = screen.getByRole('list', { name: 'Leyenda' });
    expect(legend).toHaveTextContent('Día cerrado (capacidad 0)');
    expect(legend).toHaveTextContent('Capacidad especial');
    expect(legend).toHaveTextContent('Hoy');
  });

  it('day buttons are 44px targets and today is marked', () => {
    setup('2030-08-01');
    const today = screen.getByRole('button', { name: /1 de agosto:/ });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today.className).toContain('min-h-11');
  });

  it('clicking a day reports its date', async () => {
    const { onSelectDay } = setup();
    await userEvent.click(screen.getByRole('button', { name: /10 de agosto/ }));
    expect(onSelectDay).toHaveBeenCalledWith('2030-08-10');
  });

  it('disables past days without an exception but keeps past exceptions editable', () => {
    setup('2030-08-16');
    expect(screen.getByRole('button', { name: /10 de agosto/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /15 de agosto/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /16 de agosto/ })).toBeEnabled();
  });

  it('navigates months', async () => {
    const { onMonthChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2030-09');
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2030-07');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/exceptions-calendar.test.tsx`
Expected: FAIL — no se resuelve `./exceptions-calendar`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/exceptions-calendar.tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { longDateEs } from '@/lib/dates';
import type { OverrideRow } from '@/lib/db/reservations';
import { ADMIN_ICON_ACTION } from '../ui-constants';
import { monthGrid, monthLabelEs, shiftMonth, WEEKDAYS_ES } from './month-grid';

export type DayKind = 'closed' | 'special' | 'normal';

export function dayKind(o: OverrideRow | undefined): DayKind {
  if (!o) return 'normal';
  return o.capacity === 0 ? 'closed' : 'special';
}

const KIND_CLASS: Record<DayKind, string> = {
  closed: 'bg-coral/20 font-bold text-navy ring-1 ring-inset ring-coral',
  special: 'bg-teal/20 font-bold text-navy ring-1 ring-inset ring-teal',
  normal: 'text-slate-700 hover:bg-muted',
};

function dayLabel(date: string, o: OverrideRow | undefined): string {
  const base = longDateEs(date);
  if (!o) return `${base}: sin excepción`;
  const what = o.capacity === 0 ? 'cerrado' : `capacidad especial de ${o.capacity}`;
  return `${base}: ${what}${o.reason ? ` (${o.reason})` : ''}`;
}

export function ExceptionsCalendar(props: {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD, Caracas
  overrides: Map<string, OverrideRow>;
  onMonthChange: (month: string) => void;
  onSelectDay: (date: string) => void;
}) {
  const weeks = monthGrid(props.month);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" className={ADMIN_ICON_ACTION} aria-label="Mes anterior"
          onClick={() => props.onMonthChange(shiftMonth(props.month, -1))}>
          <ChevronLeft />
        </Button>
        <h3 aria-live="polite" className="font-bold first-letter:uppercase">{monthLabelEs(props.month)}</h3>
        <Button variant="ghost" size="icon" className={ADMIN_ICON_ACTION} aria-label="Mes siguiente"
          onClick={() => props.onMonthChange(shiftMonth(props.month, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS_ES.map((d) => (
              <th key={d.long} scope="col" className="text-xs font-semibold text-muted-foreground">
                <abbr title={d.long} className="no-underline">{d.short}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                if (!date) return <td key={`pad-${wi}-${di}`} />;
                const o = props.overrides.get(date);
                const kind = dayKind(o);
                const isToday = date === props.today;
                return (
                  <td key={date}>
                    <button
                      type="button"
                      data-kind={kind}
                      aria-label={dayLabel(date, o)}
                      aria-current={isToday ? 'date' : undefined}
                      disabled={date < props.today && !o}
                      onClick={() => props.onSelectDay(date)}
                      className={cn(
                        'flex min-h-11 w-full flex-col items-center justify-center rounded-lg text-sm tabular-nums',
                        'transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40',
                        KIND_CLASS[kind],
                        isToday && 'outline-2 outline-offset-1 outline-navy',
                      )}
                    >
                      <span>{Number(date.slice(8))}</span>
                      {kind === 'closed' && <span aria-hidden className="text-[10px] leading-none">Cerr.</span>}
                      {kind === 'special' && <span aria-hidden className="text-[10px] leading-none">{o!.capacity}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label="Leyenda" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded bg-coral/20 ring-1 ring-inset ring-coral" />
          Día cerrado (capacidad 0)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded bg-teal/20 ring-1 ring-inset ring-teal" />
          Capacidad especial (el número es el cupo)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded outline-2 outline-offset-[-2px] outline-navy" />
          Hoy
        </li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/exceptions-calendar.test.tsx`
Expected: PASS (8 tests). Nota: el `heading` "agosto de 2030" se consulta en minúsculas porque la mayúscula es CSS (`first-letter:uppercase`).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/exceptions-calendar.tsx src/components/admin/settings/exceptions-calendar.test.tsx
git commit -m "feat(admin): month calendar highlighting capacity exceptions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `ExceptionsPanel` — calendario + lista + diálogos

**Files:**
- Create: `src/components/admin/settings/exceptions-panel.tsx`
- Test: `src/components/admin/settings/exceptions-panel.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/actions', () => ({
  adminUpsertOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminDeleteOverride: vi.fn().mockResolvedValue({ ok: true }),
}));

import { ExceptionsPanel } from './exceptions-panel';
import { adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import type { OverrideRow } from '@/lib/db/reservations';

const overrides: OverrideRow[] = [
  { date: '2030-08-15', capacity: 0, reason: 'Mantenimiento' },
  { date: '2030-08-20', capacity: 40, reason: 'Boda de la familia Pérez' },
];

beforeEach(() => vi.clearAllMocks());

describe('ExceptionsPanel', () => {
  it('opens on the month of today and highlights overrides', () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    expect(screen.getByRole('heading', { name: 'agosto de 2030' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /15 de agosto: cerrado/ })).toHaveAttribute('data-kind', 'closed');
  });

  it('lists overrides with reason chips (preset color vs. free text = Otro)', () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    expect(screen.getByText('Complejo cerrado')).toBeInTheDocument();
    expect(screen.getByText('Capacidad limitada a 40 personas')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento').className).toContain('bg-amber-100');
    expect(screen.getByText('Boda de la familia Pérez').className).toContain('bg-slate-100');
  });

  it('formats list dates with first-letter:uppercase, never capitalize', () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    const date = screen.getByText(/15 ago/);
    expect(date.className).toContain('first-letter:uppercase');
    expect(date.className).not.toMatch(/\bcapitalize\b/);
  });

  it('clicking a free day opens "Nueva excepción" for that date and saves it', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getByRole('button', { name: /10 de agosto/ }));
    expect(screen.getByRole('dialog', { name: 'Nueva excepción' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('2030-08-10');
    await userEvent.click(screen.getByRole('button', { name: 'Feriado' }));
    await userEvent.click(screen.getByRole('button', { name: /Guardar excepción/i }));
    expect(adminUpsertOverride).toHaveBeenCalledWith('2030-08-10', 25, 'Feriado');
    expect(refresh).toHaveBeenCalled();
  });

  it('clicking an overridden day opens "Editar excepción" with its data', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getByRole('button', { name: /15 de agosto/ }));
    expect(screen.getByRole('dialog', { name: 'Editar excepción' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('2030-08-15');
    expect(screen.getByLabelText(/Fecha/i)).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Día cerrado/i })).toBeChecked();
  });

  it('edits from the list too', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar excepción' })[1]);
    expect(screen.getByLabelText(/Capacidad máxima/i)).toHaveValue(40);
  });

  it('deletes after confirmation', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar excepción' })[0]);
    expect(screen.getByRole('dialog', { name: '¿Eliminar esta excepción?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(adminDeleteOverride).toHaveBeenCalledWith('2030-08-15');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the delete error', async () => {
    vi.mocked(adminDeleteOverride).mockResolvedValueOnce({ ok: false, message: 'No se pudo eliminar.' });
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar excepción' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar.');
  });

  it('shows the empty state', () => {
    render(<ExceptionsPanel overrides={[]} today="2030-08-01" />);
    expect(screen.getByText(/No tienes excepciones configuradas/)).toBeInTheDocument();
  });

  it('"Nueva excepción" button opens an empty dialog (44px)', async () => {
    render(<ExceptionsPanel overrides={[]} today="2030-08-01" />);
    const btn = screen.getByRole('button', { name: /Nueva excepción/ });
    expect(btn.className).toContain('h-11');
    await userEvent.click(btn);
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/exceptions-panel.test.tsx`
Expected: FAIL — no se resuelve `./exceptions-panel`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/exceptions-panel.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { shortDateEs } from '@/lib/dates';
import { adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import type { OverrideRow } from '@/lib/db/reservations';
import { ExceptionDialog } from '../exception-dialog';
import { ADMIN_ACTION, ADMIN_ICON_ACTION, DIALOG_ACTION, DIALOG_FOOTER } from '../ui-constants';
import { ExceptionsCalendar } from './exceptions-calendar';
import { REASON_CHIP_CLASS, reasonKind } from './reason-presets';

type DialogState = { mode: 'new'; date?: string } | { mode: 'edit'; row: OverrideRow } | null;

function ReasonChip(props: { reason: string | null }) {
  const kind = reasonKind(props.reason);
  if (!kind) return null;
  return (
    <span className={cn('max-w-[14rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold', REASON_CHIP_CLASS[kind])}>
      {props.reason}
    </span>
  );
}

export function ExceptionsPanel(props: { overrides: OverrideRow[]; today: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(props.today.slice(0, 7));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<OverrideRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(props.overrides.map((o) => [o.date, o])), [props.overrides]);

  function openDay(date: string) {
    const row = byDate.get(date);
    setDialog(row ? { mode: 'edit', row } : { mode: 'new', date });
  }

  async function save(date: string, capacity: number, reason?: string) {
    const res = await adminUpsertOverride(date, capacity, reason);
    if (res.ok) { setDialog(null); router.refresh(); }
    return res;
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="calendar-title" className="rounded-2xl border bg-white p-4">
        <h2 id="calendar-title" className="font-extrabold">Calendario de excepciones</h2>
        <p className="mb-3 text-sm text-muted-foreground">Toca un día para crear o editar su excepción.</p>
        <ExceptionsCalendar month={month} today={props.today} overrides={byDate}
          onMonthChange={setMonth} onSelectDay={openDay} />
      </section>

      <section aria-labelledby="exceptions-title" className="rounded-2xl border bg-white p-4">
        <h2 id="exceptions-title" className="font-extrabold">Excepciones de capacidad</h2>
        <p className="text-sm text-muted-foreground">
          Usa una excepción cuando un día tenga una capacidad diferente o el complejo permanezca cerrado.
        </p>

        <div className="mt-3 space-y-2">
          {props.overrides.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-muted-foreground">
              No tienes excepciones configuradas.<br />Agrega una fecha especial cuando la capacidad cambie.
            </p>
          )}
          {props.overrides.map((o) => {
            const closed = o.capacity === 0;
            return (
              <div key={o.date} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block font-semibold first-letter:uppercase">{shortDateEs(o.date)}</span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      closed ? 'bg-coral/20 text-navy' : 'bg-teal/20 text-navy',
                    )}>
                      {closed ? 'Cerrado' : 'Especial'}
                    </span>
                    <ReasonChip reason={o.reason} />
                  </div>
                  <p className="truncate text-muted-foreground">
                    {closed ? 'Complejo cerrado' : `Capacidad limitada a ${o.capacity} ${o.capacity === 1 ? 'persona' : 'personas'}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" className={ADMIN_ICON_ACTION} variant="ghost" aria-label="Editar excepción" title="Editar"
                    onClick={() => setDialog({ mode: 'edit', row: o })}>
                    <Pencil />
                  </Button>
                  <Button size="icon" className={ADMIN_ICON_ACTION} variant="destructive" aria-label="Eliminar excepción" title="Eliminar"
                    onClick={() => { setDeleteError(null); setDeleting(o); }}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end border-t pt-4">
          <Button className={ADMIN_ACTION} onClick={() => setDialog({ mode: 'new' })}>
            <Plus /> Nueva excepción
          </Button>
        </div>
      </section>

      {dialog && (
        <ExceptionDialog
          key={dialog.mode === 'edit' ? `edit-${dialog.row.date}` : `new-${dialog.date ?? ''}`}
          open
          onOpenChange={(o) => { if (!o) setDialog(null); }}
          initial={dialog.mode === 'edit' ? dialog.row : undefined}
          defaultDate={dialog.mode === 'new' ? dialog.date : undefined}
          onSave={save}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
          <DialogPopup>
            <DialogTitle>¿Eliminar esta excepción?</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">Esta acción cambiará la capacidad disponible para ese día.</p>
            {deleteError && <p role="alert" className="mt-2 text-sm text-destructive">{deleteError}</p>}
            <div className={DIALOG_FOOTER}>
              <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cancelar</Button>} />
              <Button variant="destructive" className={DIALOG_ACTION} onClick={async () => {
                const res = await adminDeleteOverride(deleting.date);
                if (res.ok) { setDeleting(null); router.refresh(); }
                else setDeleteError(res.message ?? 'No se pudo eliminar.');
              }}>Eliminar</Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/exceptions-panel.test.tsx`
Expected: PASS (10 tests). Si `getByText(/15 ago/)` encuentra más de un nodo, el `aria-label` del calendario no cuenta (ByText ignora `aria-label`); revisa que no haya otro texto visible con "15 ago".

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/exceptions-panel.tsx src/components/admin/settings/exceptions-panel.test.tsx
git commit -m "feat(admin): exceptions tab with calendar, reason chips and dialogs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `RolesPanel` — pestaña Accesos

**Files:**
- Create: `src/components/admin/settings/roles-panel.tsx`
- Test: `src/components/admin/settings/roles-panel.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/actions', () => ({ adminUpsertRole: vi.fn().mockResolvedValue({ ok: true }) }));

import { RolesPanel } from './roles-panel';
import { adminUpsertRole } from '@/app/admin/actions';
import type { AdminAccessEntry } from '@/app/admin/actions';

const entries: AdminAccessEntry[] = [
  { email: 'admin@club.com', role: 'owner', explicit: false },
  { email: 'ops@club.com', role: 'operator', explicit: true },
  { email: 'boss@club.com', role: 'owner', explicit: true },
];

const row = (email: string) => screen.getByText(email).closest('li')!;

beforeEach(() => vi.clearAllMocks());

describe('RolesPanel', () => {
  it('lists every allowlisted email with its role and marks defaults and yourself', () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    expect(within(row('admin@club.com')).getByText('(tú)')).toBeInTheDocument();
    expect(within(row('admin@club.com')).getByText('por defecto')).toBeInTheDocument();
    expect(within(row('ops@club.com')).queryByText('por defecto')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Rol de ops@club.com' })).toHaveValue('operator');
    expect(screen.getByRole('combobox', { name: 'Rol de boss@club.com' })).toHaveValue('owner');
  });

  it('blocks changing your own role and explains why', () => {
    render(<RolesPanel entries={entries} currentEmail="Admin@Club.com" />);
    const own = screen.getByRole('combobox', { name: 'Rol de admin@club.com' });
    expect(own).toBeDisabled();
    expect(own).toHaveAccessibleDescription(/No puedes cambiar tu propio rol/);
  });

  it('asks for confirmation and then changes the role', async () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol de ops@club.com' }), 'owner');
    expect(screen.getByText('¿Cambiar el rol de ops@club.com?')).toBeInTheDocument();
    expect(screen.getByText(/Acceso total/)).toBeInTheDocument();
    expect(adminUpsertRole).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    expect(adminUpsertRole).toHaveBeenCalledWith({ email: 'ops@club.com', role: 'owner' });
    expect(refresh).toHaveBeenCalled();
  });

  it('cancelling the confirmation changes nothing', async () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol de boss@club.com' }), 'operator');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(adminUpsertRole).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Rol de boss@club.com' })).toHaveValue('owner');
  });

  it('shows the server error inside the dialog', async () => {
    vi.mocked(adminUpsertRole).mockResolvedValueOnce({ ok: false, message: 'No se pudo guardar.' });
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol de boss@club.com' }), 'operator');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar.');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('explains how to remove access', () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Para quitar acceso, saca el email de ADMIN_EMAILS/.test(el.textContent ?? '')),
    ).toBeInTheDocument();
  });

  it('role selects are 44px tall', () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    expect(screen.getByRole('combobox', { name: 'Rol de ops@club.com' }).className).toContain('h-11');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/roles-panel.test.tsx`
Expected: FAIL — no se resuelve `./roles-panel`.

- [ ] **Step 3: Implementar**

```tsx
// src/components/admin/settings/roles-panel.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { adminUpsertRole, type AdminAccessEntry } from '@/app/admin/actions';
import type { AdminRole } from '@/lib/db/admin-roles';
import { ROLE_LABEL } from '../profile-pill';
import { ADMIN_INPUT, DIALOG_ACTION, DIALOG_FOOTER } from '../ui-constants';

const ROLE_HELP: Record<AdminRole, string> = {
  owner: 'Acceso total: configuración, excepciones, accesos y auditoría.',
  operator: 'Puede ver reservas y registrar entradas, pero no cambiar la configuración ni los accesos, ni ver la auditoría.',
};

export function RolesPanel(props: { entries: AdminAccessEntry[]; currentEmail: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ email: string; role: AdminRole } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = props.currentEmail.toLowerCase();

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const res = await adminUpsertRole(pending);
    setBusy(false);
    if (res.ok) { setPending(null); router.refresh(); }
    else setError(res.message ?? 'No se pudo cambiar el rol.');
  }

  return (
    <section aria-labelledby="roles-title" className="rounded-2xl border bg-white p-4">
      <h2 id="roles-title" className="font-extrabold">Accesos</h2>
      <p className="text-sm text-muted-foreground">Personas que pueden entrar al panel y su rol.</p>

      <ul className="mt-3 space-y-2">
        {props.entries.map((e) => {
          const self = e.email === me;
          const helpId = `role-help-${e.email}`;
          return (
            <li key={e.email} className="flex flex-col gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  <span>{e.email}</span>
                  {self && <span className="font-normal text-muted-foreground"> (tú)</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    e.role === 'owner' ? 'bg-teal/20 text-navy' : 'bg-slate-100 text-slate-700',
                  )}>
                    {ROLE_LABEL[e.role]}
                  </span>
                  {!e.explicit && (
                    <span title="Sin rol asignado: por defecto es dueño."
                      className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">
                      por defecto
                    </span>
                  )}
                </div>
                {self && (
                  <p id={helpId} className="mt-1 text-xs text-muted-foreground">
                    No puedes cambiar tu propio rol: si te quitas el rol de dueño perderías el acceso a esta página. Pide a otro dueño que lo haga.
                  </p>
                )}
              </div>
              <select
                aria-label={`Rol de ${e.email}`}
                aria-describedby={self ? helpId : undefined}
                className={cn(ADMIN_INPUT, 'w-full rounded-lg border border-input bg-background px-3 sm:w-40')}
                value={e.role}
                disabled={self}
                onChange={(ev) => {
                  const role = ev.target.value as AdminRole;
                  if (role !== e.role) { setError(null); setPending({ email: e.email, role }); }
                }}
              >
                <option value="owner">{ROLE_LABEL.owner}</option>
                <option value="operator">{ROLE_LABEL.operator}</option>
              </select>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        Para quitar acceso, saca el email de <code>ADMIN_EMAILS</code> (variable de entorno del servidor).
      </p>

      {pending && (
        <Dialog open onOpenChange={(o) => { if (!o) { setPending(null); setError(null); } }}>
          <DialogPopup>
            <DialogTitle>¿Cambiar el rol de {pending.email}?</DialogTitle>
            <p className="mt-2 text-sm">
              Nuevo rol: <b>{ROLE_LABEL[pending.role]}</b>. {ROLE_HELP[pending.role]}
            </p>
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            <div className={DIALOG_FOOTER}>
              <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cancelar</Button>} />
              <Button className={DIALOG_ACTION} disabled={busy} onClick={confirm}>
                {busy ? 'Guardando…' : 'Cambiar rol'}
              </Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </section>
  );
}
```

> `screen.getByText('admin@club.com')` en el test apunta al `<span>` del email (por eso el email va en su propio `span`), y `.closest('li')` sube a la fila.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings/roles-panel.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/settings/roles-panel.tsx src/components/admin/settings/roles-panel.test.tsx
git commit -m "feat(admin): access tab to review and change admin roles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Componer `SettingsForm` y conectar la página

**Files:**
- Modify (reescritura): `src/components/admin/settings-form.tsx`
- Modify (reescritura): `src/components/admin/settings-form.test.tsx`
- Modify: `src/app/admin/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Reescribir el test (falla)**

Reemplazar el contenido de `src/components/admin/settings-form.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './settings-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/admin/actions', () => ({
  adminUpdateSettings: vi.fn().mockResolvedValue({ ok: true }),
  adminUpsertOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminDeleteOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminUpsertRole: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/app/admin/settings-actions', () => ({ adminRefreshBcvRate: vi.fn() }));

const settings = { daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1, last_bcv_rate: null, last_bcv_rate_at: null };
const roles = [{ email: 'admin@club.com', role: 'owner' as const, explicit: false }];

function renderForm(overrides: { date: string; capacity: number; reason: string | null }[] = [], initialTab: 'general' | 'excepciones' | 'accesos' = 'general') {
  return render(
    <SettingsForm settings={settings} overrides={overrides} roles={roles} currentEmail="admin@club.com"
      initialTab={initialTab} today="2030-08-01" now={Date.parse('2030-08-01T12:00:00Z')} />,
  );
}

beforeEach(() => window.history.replaceState(null, '', '/admin/settings'));

describe('SettingsForm', () => {
  it('shows a live price preview for 2 adults and 1 child', () => {
    renderForm();
    expect(screen.getByText(/\$15\.00 USD/)).toBeInTheDocument();
  });

  it('shows empty state when there are no overrides', () => {
    renderForm();
    expect(screen.getByText(/No tienes excepciones configuradas/i)).toBeInTheDocument();
  });

  it('renders a closed-day exception as "Complejo cerrado" with a "Cerrado" badge', () => {
    renderForm([{ date: '2030-08-15', capacity: 0, reason: null }]);
    expect(screen.getByText(/Complejo cerrado/i)).toBeInTheDocument();
    expect(screen.getByText('Cerrado')).toBeInTheDocument();
  });

  it('disables "Guardar configuración" until there are unsaved changes', async () => {
    renderForm();
    const save = screen.getByRole('button', { name: /Guardar configuración/i });
    expect(save).toBeDisabled();
    const cap = screen.getByRole('spinbutton', { name: 'Capacidad diaria' });
    await userEvent.clear(cap);
    await userEvent.type(cap, '120');
    expect(save).toBeEnabled();
    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(save).toBeDisabled();
  });

  it('opens on the tab from the URL and offers the three tabs', () => {
    renderForm([], 'accesos');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['General', 'Excepciones', 'Accesos']);
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('admin@club.com');
  });

  it('keeps unsaved General edits when switching tabs', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Excepciones' }));
    await userEvent.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.getByRole('spinbutton', { name: 'Capacidad diaria' })).toHaveValue('101');
  });

  it('has no audit/logs tab (that lives in /admin/audit)', () => {
    renderForm();
    expect(screen.queryByRole('tab', { name: /Registro|Logs|Auditoría/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin/settings-form.test.tsx`
Expected: FAIL — no hay `tab`s ni `spinbutton` en el `SettingsForm` actual (y error de tipos por props nuevas).

- [ ] **Step 3: Reescribir `settings-form.tsx`**

Reemplazar el contenido de `src/components/admin/settings-form.tsx` por:

```tsx
import type { SettingsRow, OverrideRow } from '@/lib/db/reservations';
import type { AdminAccessEntry } from '@/app/admin/actions';
import { SettingsTabs } from './settings/settings-tabs';
import { GeneralPanel } from './settings/general-panel';
import { ExceptionsPanel } from './settings/exceptions-panel';
import { RolesPanel } from './settings/roles-panel';
import type { SettingsTab } from './settings/tab-param';

/** Owner-only settings page body: header + General / Excepciones / Accesos tabs. */
export function SettingsForm(props: {
  settings: SettingsRow;
  overrides: OverrideRow[];
  roles: AdminAccessEntry[];
  currentEmail: string;
  initialTab: SettingsTab;
  /** Today in America/Caracas (YYYY-MM-DD). */
  today: string;
  /** Server render time (ms) so the BCV age matches between SSR and hydration. */
  now: number;
}) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra la capacidad, los precios, las excepciones y los accesos del complejo.
        </p>
      </div>
      <SettingsTabs
        initialTab={props.initialTab}
        panels={{
          general: <GeneralPanel settings={props.settings} now={props.now} />,
          excepciones: <ExceptionsPanel overrides={props.overrides} today={props.today} />,
          accesos: <RolesPanel entries={props.roles} currentEmail={props.currentEmail} />,
        }}
      />
    </main>
  );
}
```

- [ ] **Step 4: Actualizar la página**

Reemplazar el contenido de `src/app/admin/(dashboard)/settings/page.tsx` por:

```tsx
import { adminGetSettings, adminListRoles } from '../../actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { SettingsForm } from '@/components/admin/settings-form';
import { parseSettingsTab } from '@/components/admin/settings/tab-param';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// Module-level helper keeps the component body free of impure calls (react-hooks/purity).
function renderedAt(): number {
  return Date.now();
}

export default async function AdminSettings(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Settings are owner-only; show a notice instead of an error page to operators.
  const me = await requireAdmin();
  if (me.role !== 'owner') {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Solo el dueño puede ver y cambiar la configuración.
      </p>
    );
  }
  const [{ settings, overrides }, roles, sp] = await Promise.all([
    adminGetSettings(),
    adminListRoles(),
    props.searchParams,
  ]);
  return (
    <SettingsForm
      settings={settings}
      overrides={overrides}
      roles={roles}
      currentEmail={me.email}
      initialTab={parseSettingsTab(sp.tab)}
      today={todayCaracas()}
      now={renderedAt()}
    />
  );
}
```

- [ ] **Step 5: Ejecutar tests, tipos y lint**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/admin && npx tsc --noEmit && npm run lint`
Expected: PASS en todo `src/components/admin` (incluidos los 7 tests reescritos), `tsc` y `lint` sin errores. Si `lint` marca `react-hooks/purity` en `renderedAt`, muévelo a un archivo nuevo `src/components/admin/settings/server-now.ts` (`export function serverNow(): number { return Date.now(); }`) e impórtalo en la página.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/settings-form.tsx src/components/admin/settings-form.test.tsx "src/app/admin/(dashboard)/settings/page.tsx"
git commit -m "feat(admin): tabbed settings page with tab persisted in the URL" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: e2e — pestaña en la URL, stepper por teclado y calendario

**Files:**
- Create: `e2e/admin-settings.spec.ts`

- [ ] **Step 1: Escribir el spec**

```ts
// e2e/admin-settings.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Local admin credentials are never committed. Point ADMIN_CREDENTIALS_FILE at
// the file (format "email: …" / "password: …"); without it the suite is skipped (CI).
function readCreds(): { email: string; password: string } | null {
  const file = process.env.ADMIN_CREDENTIALS_FILE
    ?? path.join(process.cwd(), 'supabase/.local-admin-credentials.txt');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const email = /^email:\s*(.+)$/m.exec(text)?.[1].trim();
  const password = /^password:\s*(.+)$/m.exec(text)?.[1].trim();
  return email && password ? { email, password } : null;
}

const creds = readCreds();

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(creds!.email);
  await page.getByLabel('Password').fill(creds!.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe('admin settings tabs', () => {
  test.skip(!creds, 'No local admin credentials file');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('the selected tab lives in ?tab= and survives a reload', async ({ page }) => {
    await page.goto('/admin/settings?tab=excepciones');
    await expect(page.getByRole('tab', { name: 'Excepciones' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Accesos' }).click();
    await expect(page).toHaveURL(/\/admin\/settings\?tab=accesos$/);

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Para quitar acceso, saca el email de/)).toBeVisible();
  });

  test('capacity stepper responds to the keyboard and changes can be discarded', async ({ page }) => {
    await page.goto('/admin/settings');
    const cap = page.getByRole('spinbutton', { name: 'Capacidad diaria' });
    const before = await cap.inputValue();
    await cap.focus();
    const goDown = Number(before) > 0;
    await page.keyboard.press(goDown ? 'ArrowDown' : 'ArrowUp');
    await expect(cap).toHaveValue(String(Number(before) + (goDown ? -1 : 1)));
    await expect(page.getByText('Tienes cambios sin guardar.')).toBeVisible();
    await expect(page.getByText(/Si todos son adultos/)).toBeVisible();

    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(cap).toHaveValue(before);
  });

  test('exceptions calendar shows a legend and navigates months', async ({ page }) => {
    await page.goto('/admin/settings?tab=excepciones');
    await expect(page.getByRole('list', { name: 'Leyenda' })).toContainText('Día cerrado (capacidad 0)');
    const heading = page.getByRole('heading', { level: 3 }).first();
    const current = await heading.textContent();
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    await expect(heading).not.toHaveText(current ?? '');
  });
});
```

> El spec **no guarda** nada ni pulsa "Actualizar tasa ahora" (eso llamaría a fuentes BCV reales): no muta la BD compartida.

- [ ] **Step 2: Ejecutar con lock (serializado)**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-settings-tabs
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock
until mkdir "$L" 2>/dev/null; do sleep 5; done
if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy — aborting"; rmdir "$L"; exit 1; fi
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && \
  ADMIN_CREDENTIALS_FILE=/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt \
  npx playwright test e2e/admin-settings.spec.ts
rmdir "$L"
```

Expected: 3 passed. Si `lsof` muestra un proceso en :3100, **no lo mates**: libera el lock, espera y reintenta. Si el login redirige a otra ruta distinta de `/admin`, ajusta solo el `waitForURL` (no las aserciones).

- [ ] **Step 3: Commit**

```bash
git add e2e/admin-settings.spec.ts
git commit -m "test(e2e): cover settings tabs, stepper keyboard and calendar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Verificación final

**Files:** ninguno (solo correcciones si algo falla).

- [ ] **Step 1: Tipos, lint, unit tests y build**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-settings-tabs
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: todo en verde; `npm run build` compila `/admin/settings` como ruta dinámica (ƒ). Este PR no toca DB, así que `npm run test:integration` no es obligatorio.

- [ ] **Step 2: Suite e2e completa (con lock)**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-settings-tabs
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock
until mkdir "$L" 2>/dev/null; do sleep 5; done
if lsof -nP -iTCP:3100 -sTCP:LISTEN; then echo "port 3100 busy — aborting"; rmdir "$L"; exit 1; fi
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && \
  ADMIN_CREDENTIALS_FILE=/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/supabase/.local-admin-credentials.txt \
  npm run test:e2e
rmdir "$L"
```

Expected: todos los specs pasan (incluido `admin-settings.spec.ts`).

- [ ] **Step 3: Revisión de reglas de la ola**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-settings-tabs
grep -rn "\bcapitalize\b" src/components/admin/settings src/components/admin/settings-form.tsx src/components/admin/exception-dialog.tsx || echo "OK: no capitalize"
git diff --stat develop -- src/app/admin/actions.ts src/lib/bcv.ts src/components/admin/nav-config.ts src/lib/reservation-status.ts
```

Expected: "OK: no capitalize" y el `git diff --stat` vacío (no se tocaron archivos ajenos). Si hubo correcciones, commitearlas con `fix(admin): …` + `Co-Authored-By`.

---

## Self-Review

**1. Cobertura del spec**
- Pestañas accesibles con `?tab=general|excepciones|accesos` que sobrevive a recargar → Tasks 2, 3, 14 (página lee `searchParams`), 15 (e2e con `reload`).
- General: steppers ±44 px + teclado para capacidad/adulto/niño → Task 4, 8. Proyección al 100 % honesta y etiquetada → Tasks 5, 8. Dirty + Descartar/Guardar con `adminUpdateSettings` → Task 8 (+ Task 14 test).
- BCV: tasa en caché + edad en hora de Caracas → Tasks 6, 7. "Actualizar tasa ahora" → acción owner-only que fuerza fetch, escribe caché, `recordBcvRate(…,'manual')`, audita `'bcv.refresh'` → Task 1 (reutiliza `fetchBcvRate`, `writeRateCache`, `recordBcvRate`; sin duplicar).
- Excepciones: calendario mensual con cerrado vs especial, estilos distintos + leyenda → Tasks 10, 11. Lista con chips de motivo (presets en el diálogo, texto libre en BD) → Tasks 9, 12. Editar/borrar con diálogos/acciones existentes → Task 12. Clic en día crea/edita → Tasks 11, 12.
- Accesos: `adminListRoles()` (email, rol, "por defecto"), cambio con `adminUpsertRole` + confirmación, auto-degradación bloqueada con explicación, nota de `ADMIN_EMAILS` → Tasks 13, 14.
- Sin pestaña de logs → Task 14 (test explícito).
- Tests pedidos: tabs+URL (T3, T15), steppers límites/teclado (T4), proyección (T5, T8), refresh (T1: fetch mockeado, auditoría e historial, owner-only), resaltado del calendario (T11, T12), roles (T13).

**2. Placeholders:** ninguno; cada paso de código trae el código completo.

**3. Consistencia de tipos/nombres:** `SettingsTab`, `parseSettingsTab`, `settingsTabHref` (T2) usados en T3/T14; `StepperBounds`, `stepValue`, `stepperKeyValue`, `parseStepperValue`, `NumberStepper` (T4) usados en T8; `projectRevenue` (T5) en T8; `rateAgeLabel`, `rateStampEs`, `rateFreshness` (T6) en T7; `adminRefreshBcvRate` / `RefreshBcvResult` (T1) en T7; `REASON_PRESETS`, `reasonKind`, `REASON_CHIP_CLASS` (T9) en T9/T12; `monthGrid`, `shiftMonth`, `monthLabelEs`, `WEEKDAYS_ES` (T10) en T11; `dayKind`, `ExceptionsCalendar` (T11) en T12; `ExceptionDialog.defaultDate` (T9) en T12; `RolesPanel`, `GeneralPanel`, `ExceptionsPanel` en T14. Props de `SettingsForm` (T14) coinciden entre página, componente y test.

## Desviaciones y preguntas abiertas (para el coordinador)

1. **`src/lib/audit.ts`**: se añade `'bcv.refresh'` a `AuditAction` (mandato del brief). El roadmap §3.2 lista ese tipo como contrato; no lo edito para evitar conflictos con PR 12 — conviene actualizar el roadmap al mergear, y que el visor de auditoría de **PR 12** tenga etiqueta para `bcv.refresh` (p. ej. "Tasa BCV actualizada").
2. **Constantes de frescura BCV duplicadas** en `bcv-age.ts` (1 h / 24 h) porque `src/lib/bcv.ts` no exporta `FRESH_MS`/`MAX_STALE_MS` y además importa `undici` (no apto para el bundle cliente). Alternativa futura: mover las constantes a un módulo puro compartido.
3. **"Mock fetch" en el test de la acción**: se mockea el módulo `@/lib/bcv` (`fetchBcvRate`), igual que `booking.test.ts`; el parseo de fuentes ya está cubierto por `bcv-sources.test.ts`.
4. **Sin zod en `adminRefreshBcvRate`**: no recibe input.
5. **e2e** lee las credenciales vía `ADMIN_CREDENTIALS_FILE` (el archivo vive en el repo principal, no en el worktree); sin él el spec se salta.
6. **Proyección**: se eligió mostrar el rango (todos niños ↔ todos adultos) en vez de suponer una mezcla; no descuenta excepciones de capacidad (se dice en pantalla).
