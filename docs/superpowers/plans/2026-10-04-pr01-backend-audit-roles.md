# PR 01 — Backend: audit log, historial BCV y roles de admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir las tablas `audit_log`, `bcv_rate_history` y `admin_roles`, registrar en auditoría las 5 acciones admin que escriben, guardar historial de cada tasa BCV nueva, e introducir roles `owner`/`operator` en `requireAdmin` con acciones owner-only para gestionar roles y leer auditoría/historial.

**Architecture:** Tres migraciones SQL con RLS activado y sin políticas (solo `service_role` toca las tablas, igual que `0003`). Módulos de datos pequeños y separados (`src/lib/audit.ts`, `src/lib/bcv-history.ts`, `src/lib/db/admin-roles.ts`) más un helper de paginación compartido (`src/lib/db/paginate.ts`). `requireAdmin` sigue usando `ADMIN_EMAILS` como gate y ahora consulta el rol en `admin_roles` (sin fila = `owner`). El historial BCV entra por una dependencia opcional nueva `recordHistory` en `RateDeps`, que `getBcvRate` solo llama tras un fetch fresco.

**Tech Stack:** Next.js 16 (server actions), React 19, TypeScript, Supabase (Postgres + PostgREST vía `@supabase/supabase-js`), Zod 4, Vitest 4 (unit + integration), ESLint.

**Rama / worktree:** `feat/backend-audit-roles`, worktree `.worktrees/feat/backend-audit-roles` creado desde `origin/develop`. Todas las rutas de este plan son relativas a la raíz del worktree.

**Fuente de verdad:** `docs/superpowers/plans/2026-10-04-ux-overhaul-roadmap.md` §1–§3.

---

## Desviaciones del roadmap

1. **Ruta de `listBcvHistory`:** el roadmap dice `src/lib/bcv-history` sin extensión; se usa el archivo `src/lib/bcv-history.ts`. Ahí viven también `recordBcvRate` y el tipo `BcvHistoryRow`.
2. **Significado de `bcv_rate_history.source`:** `fetchBcvRate()` solo devuelve un número (no dice qué mirror ganó) y `RateDeps.fetchRate` es `() => Promise<number>`. Para no tocar ese contrato, `source` guarda **quién disparó el fetch**: `'auto'` (tráfico de la app) o `'manual'` (botón de refresco de PR 11). Tipo: `BcvRateSource = 'auto' | 'manual'`.
3. **Restricciones extra en SQL (compatibles con el contrato):** `audit_log.at` y `audit_log.details` son `not null`; `bcv_rate_history.rate` tiene `check (rate > 0)`; `admin_roles.email` tiene `check (email = lower(email))`. Además `audit_log` y `bcv_rate_history` son **append-only** para `service_role` (solo `select, insert`): la app nunca necesita borrar ni editar auditoría/historial.
4. **Error de rol:** `requireAdmin({ role: 'owner' })` lanza `Error('Forbidden')` (distinto de `'Unauthorized'`, que se mantiene para sin sesión / email fuera de la allowlist). Si falla la consulta del rol, `requireAdmin` lanza (fail closed), nunca asume `owner`.
5. **`adminGetSettings` también es owner-only** (el roadmap pide owner para "settings"). Para que un `operator` no vea una página de error en `/admin/settings` (el enlace sigue visible hasta PR 07), `settings/page.tsx` muestra un aviso en vez de llamar a `adminGetSettings` cuando el rol no es owner.
6. **Forma de `adminListRoles`:** devuelve un `AdminAccessEntry[] = { email, role, explicit }[]` construido a partir de `ADMIN_EMAILS` (no de la tabla sola), porque el rol efectivo de un email sin fila es `owner`. `explicit` dice si existe fila en `admin_roles`.
7. **`adminUpsertRole` solo acepta emails de `ADMIN_EMAILS`** (una fila para un email fuera de la allowlist no daría acceso y confundiría la UI).
8. **Sin `adminDeleteRole` ni `'role.delete'`:** con "sin fila = owner", borrar la fila de otra persona la ascendería en silencio a owner (escalada de privilegios). Los roles solo se cambian con `adminUpsertRole`; `AuditAction` del roadmap §3.2 se actualizó para quitar `'role.delete'`. Tampoco existe `deleteAdminRole` en la capa de datos.
9. **Firmas de las acciones de lectura paginada:** `adminListAudit(raw: unknown)` y `adminListBcvHistory(raw: unknown)` validan `{ page, pageSize }` con Zod (pageSize 1–100) y lanzan `'Invalid page'`, igual que `adminSearchReservations(raw: unknown)` del roadmap.

**Preguntas abiertas para el dueño (no bloquean el PR):**
- Quitar acceso = sacar el email de ADMIN_EMAILS; los roles solo se cambian, no se borran.
- `adminListBcvHistory` queda abierto a cualquier admin (operador incluido), porque el roadmap solo marca Auditoría como owner-only en la navegación.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/migrations/0005_audit_log.sql` | Crear | Tabla `audit_log` append-only |
| `supabase/migrations/0006_bcv_rate_history.sql` | Crear | Tabla `bcv_rate_history` append-only |
| `supabase/migrations/0007_admin_roles.sql` | Crear | Tabla `admin_roles` |
| `src/lib/db/paginate.ts` | Crear | `pageRange` + `paginate<T>` (select paginado con total) |
| `src/lib/db/paginate.test.ts` | Crear | Unit de `pageRange` |
| `src/lib/audit.ts` | Crear | `AuditAction`, `AuditRow`, `logAudit` (nunca lanza), `listAudit` |
| `src/lib/audit.test.ts` | Crear | Unit: `logAudit` nunca lanza |
| `src/lib/audit.integration.test.ts` | Crear | Round-trip, paginación, append-only, anon bloqueado |
| `src/lib/bcv-history.ts` | Crear | `BcvRateSource`, `BcvHistoryRow`, `recordBcvRate`, `listBcvHistory` |
| `src/lib/bcv-history.integration.test.ts` | Crear | Round-trip, paginación, check de tasa, append-only, anon |
| `src/lib/bcv.ts` | Modificar | `RateDeps.recordHistory?` + llamada en fetch fresco |
| `src/lib/bcv.test.ts` | Modificar | Casos de `recordHistory` |
| `src/app/actions/booking.ts` | Modificar | `rateDeps()` compartido con `recordHistory` → `recordBcvRate(..., 'auto')` |
| `src/app/actions/booking.test.ts` | Modificar | Test del cableado de historial |
| `src/lib/auth/admin.ts` | Modificar | `adminEmails()` |
| `src/lib/auth/admin.test.ts` | Modificar | Tests de `adminEmails()` |
| `src/lib/db/admin-roles.ts` | Crear | `AdminRole`, `AdminRoleRow`, `getAdminRole`, `listAdminRoles`, `upsertAdminRole` |
| `src/lib/db/admin-roles.integration.test.ts` | Crear | CRUD, case-insensitive, checks SQL, anon |
| `src/lib/auth/require-admin.ts` | Modificar | Nueva firma `requireAdmin(opts?)` → `{ email, role }` |
| `src/lib/auth/require-admin.test.ts` | Reescribir | Casos de rol |
| `src/app/admin/actions.ts` | Modificar | Gating owner, `logAudit`, acciones de roles y listados |
| `src/app/admin/actions.test.ts` | Modificar | Mocks nuevos + tests de rol, auditoría, roles y listados |
| `src/app/admin/(dashboard)/settings/page.tsx` | Modificar | Aviso para operator |

Sin cambios (verificado): `src/app/admin/checkin/[id]/page.tsx` llama `await requireAdmin()` e ignora el resultado — sigue compilando y funcionando. `src/middleware.ts` solo usa `isAdminEmail`.

---

### Task 0: Preparar el worktree y medir la línea base

**Files:** ninguno (solo entorno)

- [ ] **Step 1: Instalar dependencias y copiar el entorno local**

El worktree no trae `.env.local` (está en `.gitignore`) y `vitest.integration.config.ts` lo lee desde el cwd.

Run (desde `.worktrees/feat/backend-audit-roles`):
```bash
npm ci
cp ../../../.env.local .env.local
```
Expected: `npm ci` termina sin errores; `.env.local` existe.

- [ ] **Step 2: Levantar Supabase local**

Run:
```bash
npx supabase start
```
Expected: imprime `API URL: http://127.0.0.1:54321` (o "supabase start is already running"). Requiere Docker.

- [ ] **Step 3: Línea base de tests**

Run:
```bash
npm test
npm run test:integration
```
Expected: `npm test` en verde. En `test:integration` puede fallar **un caso preexistente**: `upsertOverride creates then updates a row visible via listOverrides` (en `src/lib/db/reservations.integration.test.ts`), porque desde `0004` `listOverrides` devuelve también `reason: null` y la expectativa no lo incluye. Anota el resultado.

- [ ] **Step 4: (Solo si el Step 3 mostró ese fallo) Corregir la expectativa preexistente**

En `src/lib/db/reservations.integration.test.ts`, dentro de `it('upsertOverride creates then updates a row visible via listOverrides', ...)`, reemplazar:
```ts
    expect(overrides).toContainEqual({ date: OV_DATE, capacity: 5 });
```
por:
```ts
    expect(overrides).toContainEqual({ date: OV_DATE, capacity: 5, reason: null });
```
y:
```ts
    expect(overrides).toContainEqual({ date: OV_DATE, capacity: 0 });
```
por:
```ts
    expect(overrides).toContainEqual({ date: OV_DATE, capacity: 0, reason: null });
```

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/reservations.integration.test.ts`
Expected: PASS.

```bash
git add src/lib/db/reservations.integration.test.ts
git commit -m "test(db): include override reason in listOverrides expectations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Migraciones 0005–0007

**Files:**
- Create: `supabase/migrations/0005_audit_log.sql`
- Create: `supabase/migrations/0006_bcv_rate_history.sql`
- Create: `supabase/migrations/0007_admin_roles.sql`

Nota: Supabase da por defecto `ALL` a `anon`, `authenticated` y `service_role` sobre tablas nuevas de `public`. Por eso cada migración revoca y vuelve a conceder solo lo necesario (mismo criterio que `0003`). Las pruebas de estas tablas (anon bloqueado, append-only, checks) están en los tests de integración de las Tasks 3, 4 y 8.

- [ ] **Step 1: Crear `supabase/migrations/0005_audit_log.sql`**

```sql
-- 0005_audit_log.sql
-- Audit trail of admin actions that write (check-in, resend voucher, settings,
-- capacity overrides, roles). The app inserts via logAudit() with the service
-- role. RLS enabled with no policy = deny for anon/authenticated (see 0003).
-- Append-only: even the service role may only read and insert.
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on audit_log (at desc, id desc);

alter table audit_log enable row level security;
revoke all on audit_log from anon, authenticated, service_role;
revoke all on sequence audit_log_id_seq from anon, authenticated, service_role;
grant select, insert on audit_log to service_role;
grant usage, select on sequence audit_log_id_seq to service_role;
```

- [ ] **Step 2: Crear `supabase/migrations/0006_bcv_rate_history.sql`**

```sql
-- 0006_bcv_rate_history.sql
-- One row per freshly fetched BCV rate (never on a cache read). `source` says
-- what triggered the fetch: 'auto' (app traffic) or 'manual' (admin refresh).
-- Service role only; append-only like audit_log.
create table bcv_rate_history (
  id bigserial primary key,
  fetched_at timestamptz not null,
  rate numeric(14,4) not null check (rate > 0),
  source text
);
create index bcv_rate_history_fetched_at_idx on bcv_rate_history (fetched_at desc, id desc);

alter table bcv_rate_history enable row level security;
revoke all on bcv_rate_history from anon, authenticated, service_role;
revoke all on sequence bcv_rate_history_id_seq from anon, authenticated, service_role;
grant select, insert on bcv_rate_history to service_role;
grant usage, select on sequence bcv_rate_history_id_seq to service_role;
```

- [ ] **Step 3: Crear `supabase/migrations/0007_admin_roles.sql`**

```sql
-- 0007_admin_roles.sql
-- Admin roles. The access gate is still the ADMIN_EMAILS allowlist; this table
-- only refines the role of an allowlisted email. An allowlisted email with no
-- row here is 'owner' (keeps current access working). Emails stored lowercase.
create table admin_roles (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('owner', 'operator'))
);

alter table admin_roles enable row level security;
revoke all on admin_roles from anon, authenticated, service_role;
grant select, insert, update, delete on admin_roles to service_role;
```

- [ ] **Step 4: Aplicar las migraciones al Supabase local**

Run:
```bash
npx supabase migration up --local
```
Expected: `Applying migration 0005_audit_log.sql...`, `0006_bcv_rate_history.sql`, `0007_admin_roles.sql` y "Local database is up to date." Si el comando falla por historial de migraciones desincronizado, usar `npx supabase db reset` (OJO: borra datos locales, incluidos usuarios de Auth; habrá que recrear el usuario admin en Studio).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_audit_log.sql supabase/migrations/0006_bcv_rate_history.sql supabase/migrations/0007_admin_roles.sql
git commit -m "feat(db): add audit_log, bcv_rate_history and admin_roles tables" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Helper de paginación

**Files:**
- Create: `src/lib/db/paginate.ts`
- Test: `src/lib/db/paginate.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/db/paginate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pageRange } from './paginate';

describe('pageRange', () => {
  it('maps a 1-based page to an inclusive PostgREST range', () => {
    expect(pageRange(1, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(3, 25)).toEqual({ from: 50, to: 74 });
  });

  it('accepts the max page size (100)', () => {
    expect(pageRange(2, 100)).toEqual({ from: 100, to: 199 });
  });

  it('rejects page < 1 or non-integer pages', () => {
    expect(() => pageRange(0, 10)).toThrow(RangeError);
    expect(() => pageRange(1.5, 10)).toThrow(RangeError);
  });

  it('rejects page sizes outside 1–100', () => {
    expect(() => pageRange(1, 0)).toThrow(RangeError);
    expect(() => pageRange(1, 101)).toThrow(RangeError);
    expect(() => pageRange(1, 2.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/lib/db/paginate.test.ts`
Expected: FAIL — `Failed to resolve import "./paginate"`.

- [ ] **Step 3: Implementar**

`src/lib/db/paginate.ts`:
```ts
import { serviceClient } from './service-client';

export const MAX_PAGE_SIZE = 100;

/** 1-based page → inclusive PostgREST range. Throws RangeError on bad input. */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  if (!Number.isInteger(page) || page < 1) throw new RangeError(`invalid page: ${page}`);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`invalid pageSize: ${pageSize}`);
  }
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export interface OrderBy {
  column: string;
  ascending: boolean;
}

/**
 * Paginated `select *` over a service-role table with the exact total.
 * A page past the end returns `rows: []` with the real total: PostgREST
 * answers an unsatisfiable range with error PGRST103 when count=exact.
 */
export async function paginate<T>(
  table: string,
  order: OrderBy[],
  page: number,
  pageSize: number,
): Promise<{ rows: T[]; total: number }> {
  const { from, to } = pageRange(page, pageSize);
  const db = serviceClient();
  let query = db.from(table).select('*', { count: 'exact' });
  for (const o of order) query = query.order(o.column, { ascending: o.ascending });
  const { data, error, count } = await query.range(from, to);
  if (error && error.code === 'PGRST103') {
    const head = await db.from(table).select('*', { count: 'exact', head: true });
    if (head.error) throw new Error(head.error.message);
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as T[], total: count ?? 0 };
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/lib/db/paginate.test.ts`
Expected: PASS (4 tests). `paginate()` se prueba contra la BD en las Tasks 3 y 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/paginate.ts src/lib/db/paginate.test.ts
git commit -m "feat(db): add shared pagination helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `src/lib/audit.ts` (`logAudit` + `listAudit`)

**Files:**
- Create: `src/lib/audit.ts`
- Test: `src/lib/audit.test.ts`
- Test: `src/lib/audit.integration.test.ts`

- [ ] **Step 1: Escribir el unit test que falla**

`src/lib/audit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock('@/lib/db/service-client', () => ({
  serviceClient: vi.fn(() => ({ from: vi.fn(() => ({ insert })) })),
}));

import { logAudit } from './audit';
import { serviceClient } from '@/lib/db/service-client';

// Silence the expected error logs; vi.clearAllMocks() resets its call history.
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
  });

  it('inserts the entry mapped to audit_log columns', async () => {
    await logAudit({ actor: 'owner@club.com', action: 'override.delete', target: '2030-01-01' });
    expect(insert).toHaveBeenCalledWith({
      actor_email: 'owner@club.com',
      action: 'override.delete',
      target: '2030-01-01',
      details: {},
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('passes details through and defaults target to null', async () => {
    await logAudit({ actor: 'owner@club.com', action: 'settings.update', details: { daily_capacity: 80 } });
    expect(insert).toHaveBeenCalledWith({
      actor_email: 'owner@club.com',
      action: 'settings.update',
      target: null,
      details: { daily_capacity: 80 },
    });
  });

  it('resolves and logs when the insert returns an error', async () => {
    insert.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(logAudit({ actor: 'a@b.c', action: 'role.upsert', target: 'x@y.z' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('resolves and logs when the insert rejects', async () => {
    insert.mockRejectedValue(new Error('network down'));
    await expect(logAudit({ actor: 'a@b.c', action: 'role.upsert' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('resolves and logs when the client cannot even be built', async () => {
    vi.mocked(serviceClient).mockImplementationOnce(() => {
      throw new Error('missing env');
    });
    await expect(logAudit({ actor: 'a@b.c', action: 'reservation.check_in', target: 'id' })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/lib/audit.test.ts`
Expected: FAIL — `Failed to resolve import "./audit"`.

- [ ] **Step 3: Implementar `src/lib/audit.ts`**

```ts
import { serviceClient } from '@/lib/db/service-client';
import { paginate } from '@/lib/db/paginate';

export type AuditAction =
  | 'reservation.check_in' | 'reservation.resend_voucher'
  | 'settings.update' | 'override.upsert' | 'override.delete'
  | 'role.upsert';

export interface AuditRow {
  id: number;
  at: string;
  actor_email: string;
  action: AuditAction;
  target: string | null;
  details: Record<string, unknown>;
}

/**
 * Records an admin action. NEVER throws: auditing must not break the action
 * it describes, so any failure is only reported via console.error.
 */
export async function logAudit(e: {
  actor: string;
  action: AuditAction;
  target?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await serviceClient().from('audit_log').insert({
      actor_email: e.actor,
      action: e.action,
      target: e.target ?? null,
      details: e.details ?? {},
    });
    if (error) console.error('audit: insert failed:', error.message);
  } catch (err) {
    console.error('audit: insert threw:', err);
  }
}

/** Newest first. `page` is 1-based; `pageSize` 1–100. */
export async function listAudit(p: { page: number; pageSize: number }): Promise<{ rows: AuditRow[]; total: number }> {
  return paginate<AuditRow>(
    'audit_log',
    [{ column: 'at', ascending: false }, { column: 'id', ascending: false }],
    p.page,
    p.pageSize,
  );
}
```

- [ ] **Step 4: Correr el unit test y ver que pasa**

Run: `npx vitest run src/lib/audit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Escribir el test de integración**

`src/lib/audit.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { logAudit, listAudit } from './audit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { transport: ws as never } }
);

// audit_log is append-only (no delete grant), so tests never clean up: they
// use a unique actor and compare against the total measured before inserting.
const actor = `it-audit-${Date.now()}@club.com`;

describe('audit log', () => {
  it('logAudit rows come back newest first through listAudit', async () => {
    const before = (await listAudit({ page: 1, pageSize: 1 })).total;
    await logAudit({ actor, action: 'settings.update', details: { daily_capacity: 80 } });
    await logAudit({ actor, action: 'override.delete', target: '2030-03-05' });

    const { rows, total } = await listAudit({ page: 1, pageSize: 2 });
    expect(total).toBe(before + 2);
    expect(rows.map((r) => r.action)).toEqual(['override.delete', 'settings.update']);
    expect(rows[0]).toMatchObject({ actor_email: actor, target: '2030-03-05', details: {} });
    expect(rows[1]).toMatchObject({ actor_email: actor, target: null, details: { daily_capacity: 80 } });
    expect(typeof rows[0].id).toBe('number');
    expect(Number.isNaN(Date.parse(rows[0].at))).toBe(false);
  });

  it('paginates newest first and returns an empty page past the end', async () => {
    await logAudit({ actor, action: 'override.upsert', target: 'p1' });
    await logAudit({ actor, action: 'override.upsert', target: 'p2' });
    await logAudit({ actor, action: 'override.upsert', target: 'p3' });

    const page1 = await listAudit({ page: 1, pageSize: 2 });
    expect(page1.rows.map((r) => r.target)).toEqual(['p3', 'p2']);
    const page2 = await listAudit({ page: 2, pageSize: 2 });
    expect(page2.rows[0].target).toBe('p1');
    expect(page2.total).toBe(page1.total);

    const beyond = await listAudit({ page: 100000, pageSize: 100 });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(page1.total);
  });

  it('is append-only even for the service role', async () => {
    const del = await supabase.from('audit_log').delete().eq('actor_email', actor);
    expect(del.error).not.toBeNull();
    const upd = await supabase.from('audit_log').update({ action: 'x' }).eq('actor_email', actor);
    expect(upd.error).not.toBeNull();
  });

  it('is closed to the anon role', async () => {
    const read = await supabaseAnon.from('audit_log').select('*');
    expect(read.error).not.toBeNull();
    const write = await supabaseAnon.from('audit_log').insert({ actor_email: 'evil@x.com', action: 'settings.update' });
    expect(write.error).not.toBeNull();
  });
});
```

- [ ] **Step 6: Correr el test de integración**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/audit.integration.test.ts`
Expected: PASS (4 tests). Si falla con `relation "audit_log" does not exist`, la migración no se aplicó: repetir Task 1 Step 4.

- [ ] **Step 7: Commit**

```bash
git add src/lib/audit.ts src/lib/audit.test.ts src/lib/audit.integration.test.ts
git commit -m "feat(audit): add logAudit and paginated listAudit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `src/lib/bcv-history.ts` (`recordBcvRate` + `listBcvHistory`)

**Files:**
- Create: `src/lib/bcv-history.ts`
- Test: `src/lib/bcv-history.integration.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

`src/lib/bcv-history.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { recordBcvRate, listBcvHistory } from './bcv-history';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { transport: ws as never } }
);

// bcv_rate_history is append-only. Rows are stamped slightly in the future so
// they sort before anything recorded earlier (including previous test runs).
describe('bcv rate history', () => {
  it('recorded rates come back newest first with numeric rates', async () => {
    const base = Date.now() + 60_000;
    await recordBcvRate(36.5, base, 'auto');
    await recordBcvRate(37.1234, base + 1000, 'manual');

    const { rows, total } = await listBcvHistory({ page: 1, pageSize: 2 });
    expect(total).toBeGreaterThanOrEqual(2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rate: 37.1234, source: 'manual' });
    expect(Date.parse(rows[0].fetched_at)).toBe(base + 1000);
    expect(rows[1]).toMatchObject({ rate: 36.5, source: 'auto' });
    expect(Date.parse(rows[1].fetched_at)).toBe(base);
  });

  it('returns an empty page past the end with the real total', async () => {
    const first = await listBcvHistory({ page: 1, pageSize: 1 });
    const beyond = await listBcvHistory({ page: 100000, pageSize: 100 });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(first.total);
  });

  it('rejects a non-positive rate at the database level', async () => {
    await expect(recordBcvRate(0, Date.now(), 'auto')).rejects.toThrow();
  });

  it('is append-only even for the service role', async () => {
    const del = await supabase.from('bcv_rate_history').delete().gt('id', 0);
    expect(del.error).not.toBeNull();
  });

  it('is closed to the anon role', async () => {
    const read = await supabaseAnon.from('bcv_rate_history').select('*');
    expect(read.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/bcv-history.integration.test.ts`
Expected: FAIL — `Failed to resolve import "./bcv-history"`.

- [ ] **Step 3: Implementar `src/lib/bcv-history.ts`**

```ts
import { serviceClient } from '@/lib/db/service-client';
import { paginate } from '@/lib/db/paginate';

/** What triggered the fetch: app traffic ('auto') or the admin refresh button ('manual'). */
export type BcvRateSource = 'auto' | 'manual';

export interface BcvHistoryRow {
  id: number;
  fetched_at: string;
  rate: number;
  source: string | null;
}

/** Appends one freshly fetched rate. Throws on DB error (callers decide). */
export async function recordBcvRate(rate: number, fetchedAt: number, source: BcvRateSource): Promise<void> {
  const { error } = await serviceClient()
    .from('bcv_rate_history')
    .insert({ rate, fetched_at: new Date(fetchedAt).toISOString(), source });
  if (error) throw new Error(error.message);
}

/** Newest first. `page` is 1-based; `pageSize` 1–100. */
export async function listBcvHistory(p: { page: number; pageSize: number }): Promise<{ rows: BcvHistoryRow[]; total: number }> {
  const { rows, total } = await paginate<BcvHistoryRow>(
    'bcv_rate_history',
    [{ column: 'fetched_at', ascending: false }, { column: 'id', ascending: false }],
    p.page,
    p.pageSize,
  );
  return { rows: rows.map((r) => ({ ...r, rate: Number(r.rate) })), total };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/bcv-history.integration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bcv-history.ts src/lib/bcv-history.integration.test.ts
git commit -m "feat(bcv): add rate history storage and paginated listing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `getBcvRate` registra historial solo en fetch fresco

**Files:**
- Modify: `src/lib/bcv.ts:4-30` (interfaz `RateDeps` y `getBcvRate`)
- Test: `src/lib/bcv.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Al final de `src/lib/bcv.test.ts` (fuera del `describe('getBcvRate')` existente) añadir:
```ts
describe('getBcvRate history recording', () => {
  it('records history with the fetched rate and time on a fresh fetch', async () => {
    const recordHistory = vi.fn(async () => {});
    const d = deps({ recordHistory });
    expect(await getBcvRate(d)).toBe(36.5);
    expect(recordHistory).toHaveBeenCalledWith(36.5, NOW);
  });

  it('does not record history when serving a fresh cache', async () => {
    const recordHistory = vi.fn(async () => {});
    const d = deps({
      recordHistory,
      readCache: vi.fn(async () => ({ rate: 36.1, fetchedAt: NOW - 30 * 60_000 })),
    });
    expect(await getBcvRate(d)).toBe(36.1);
    expect(recordHistory).not.toHaveBeenCalled();
  });

  it('does not record history when the fetch fails (stale fallback)', async () => {
    const recordHistory = vi.fn(async () => {});
    const d = deps({
      recordHistory,
      fetchRate: vi.fn(async () => { throw new Error('down'); }),
      readCache: vi.fn(async () => ({ rate: 36.1, fetchedAt: NOW - 5 * 60 * 60_000 })),
    });
    expect(await getBcvRate(d)).toBe(36.1);
    expect(recordHistory).not.toHaveBeenCalled();
  });

  it('still returns the fetched rate when recordHistory throws', async () => {
    const d = deps({ recordHistory: vi.fn(async () => { throw new Error('db down'); }) });
    expect(await getBcvRate(d)).toBe(36.5);
    expect(d.writeCache).toHaveBeenCalledWith(36.5, NOW);
  });

  it('records history even when the cache write fails', async () => {
    const recordHistory = vi.fn(async () => {});
    const d = deps({
      recordHistory,
      writeCache: vi.fn(async () => { throw new Error('db down'); }),
    });
    expect(await getBcvRate(d)).toBe(36.5);
    expect(recordHistory).toHaveBeenCalledWith(36.5, NOW);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/lib/bcv.test.ts`
Expected: FAIL — TypeScript/Vitest reporta `recordHistory` no llamado (`expected "spy" to be called with arguments: [ 36.5, 1894708800000 ]`). Los 8 tests existentes siguen pasando.

- [ ] **Step 3: Implementar**

En `src/lib/bcv.ts`, reemplazar el bloque desde `export interface RateDeps {` hasta el cierre de `getBcvRate` por:
```ts
export interface RateDeps {
  fetchRate: () => Promise<number>;
  readCache: () => Promise<{ rate: number; fetchedAt: number } | null>;
  writeCache: (rate: number, fetchedAt: number) => Promise<void>;
  /** Optional: append the freshly fetched rate to bcv_rate_history. */
  recordHistory?: (rate: number, fetchedAt: number) => Promise<void>;
  now: () => number;
}

/** Returns the BCV VES/USD rate, or null if no acceptable rate is available. */
export async function getBcvRate(deps: RateDeps): Promise<number | null> {
  const cached = await deps.readCache();
  const now = deps.now();

  if (cached && now - cached.fetchedAt < FRESH_MS) return cached.rate;

  try {
    const rate = await deps.fetchRate();
    try {
      await deps.writeCache(rate, now);
    } catch (e) {
      console.error('bcv: cache write failed (rate still served):', e);
    }
    if (deps.recordHistory) {
      try {
        await deps.recordHistory(rate, now);
      } catch (e) {
        console.error('bcv: history write failed (rate still served):', e);
      }
    }
    return rate;
  } catch (e) {
    console.error('bcv: rate fetch failed:', e);
    if (cached && now - cached.fetchedAt < MAX_STALE_MS) return cached.rate;
    return null;
  }
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/lib/bcv.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bcv.ts src/lib/bcv.test.ts
git commit -m "feat(bcv): record rate history on fresh fetches" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cablear el historial en `src/app/actions/booking.ts`

**Files:**
- Modify: `src/app/actions/booking.ts` (imports, `submitBookingAndPay.getRate`, `getCurrentRate`)
- Test: `src/app/actions/booking.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/app/actions/booking.test.ts`, añadir debajo del último `vi.mock(...)` existente (antes de los `import`):
```ts
vi.mock('@/lib/bcv', () => ({
  getBcvRate: vi.fn(async () => 36.5),
  fetchBcvRate: vi.fn(),
}));
vi.mock('@/lib/bcv-history', () => ({
  recordBcvRate: vi.fn(async () => {}),
}));
```
Reemplazar la línea:
```ts
import { submitBookingAndPay } from './booking';
```
por:
```ts
import { submitBookingAndPay, getCurrentRate } from './booking';
import { getBcvRate } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
```
Y al final del archivo añadir:
```ts
describe('BCV rate history wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getCurrentRate passes a recordHistory dep that stores the rate as source auto', async () => {
    expect(await getCurrentRate()).toBe(36.5);
    const deps = vi.mocked(getBcvRate).mock.calls[0][0];
    expect(deps.recordHistory).toBeTypeOf('function');
    await deps.recordHistory!(40.1, 1_900_000_000_000);
    expect(recordBcvRate).toHaveBeenCalledWith(40.1, 1_900_000_000_000, 'auto');
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/app/actions/booking.test.ts`
Expected: FAIL — `expected undefined to be type of function` (aún no se pasa `recordHistory`).

- [ ] **Step 3: Implementar**

En `src/app/actions/booking.ts`:

Reemplazar:
```ts
import { getBcvRate, fetchBcvRate } from '@/lib/bcv';
```
por:
```ts
import { getBcvRate, fetchBcvRate, type RateDeps } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
```

Debajo de `const BOOKING_MAX_PER_MINUTE = 8;` añadir:
```ts

// Shared BCV deps. A fresh fetch refreshes the settings cache AND appends a
// bcv_rate_history row ('auto' = triggered by app traffic, not the admin).
function rateDeps(): RateDeps {
  return {
    fetchRate: fetchBcvRate,
    readCache: readRateCache,
    writeCache: writeRateCache,
    recordHistory: (rate, fetchedAt) => recordBcvRate(rate, fetchedAt, 'auto'),
    now: Date.now,
  };
}
```

Dentro de `submitBookingAndPay`, reemplazar:
```ts
    getRate: () =>
      getBcvRate({
        fetchRate: fetchBcvRate,
        readCache: readRateCache,
        writeCache: writeRateCache,
        now: Date.now,
      }),
```
por:
```ts
    getRate: () => getBcvRate(rateDeps()),
```

Reemplazar la función completa `getCurrentRate` por:
```ts
export async function getCurrentRate(): Promise<number | null> {
  return getBcvRate(rateDeps());
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/app/actions/booking.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/booking.ts src/app/actions/booking.test.ts
git commit -m "feat(bcv): store fetched rates in history from booking actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `adminEmails()` en `src/lib/auth/admin.ts`

**Files:**
- Modify: `src/lib/auth/admin.ts`
- Test: `src/lib/auth/admin.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/auth/admin.test.ts`, reemplazar la línea `import { isAdminEmail } from './admin';` por:
```ts
import { isAdminEmail, adminEmails } from './admin';
```
y al final del archivo añadir:
```ts
describe('adminEmails', () => {
  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it('returns the allowlist trimmed, lowercased and deduplicated, in order', () => {
    process.env.ADMIN_EMAILS = ' Owner@Club.com, ops@club.com ,OWNER@club.com,, ';
    expect(adminEmails()).toEqual(['owner@club.com', 'ops@club.com']);
  });

  it('returns [] when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(adminEmails()).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/lib/auth/admin.test.ts`
Expected: FAIL — `adminEmails is not a function`.

- [ ] **Step 3: Implementar**

Reemplazar el contenido completo de `src/lib/auth/admin.ts` por:
```ts
/**
 * Admin allowlist. A logged-in Supabase user is NOT automatically an admin;
 * their email must appear in the ADMIN_EMAILS env var (comma-separated).
 * Fails closed: an empty/unset list grants no one admin access.
 */
export function adminEmails(): string[] {
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/lib/auth/admin.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/admin.ts src/lib/auth/admin.test.ts
git commit -m "feat(auth): expose the normalized admin allowlist" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Capa de datos `src/lib/db/admin-roles.ts`

**Files:**
- Create: `src/lib/db/admin-roles.ts`
- Test: `src/lib/db/admin-roles.integration.test.ts`

- [ ] **Step 1: Escribir el test de integración que falla**

`src/lib/db/admin-roles.integration.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { getAdminRole, listAdminRoles, upsertAdminRole } from './admin-roles';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { transport: ws as never } }
);

const EMAIL = 'it-roles@club.com';

describe('admin roles data layer', () => {
  beforeEach(async () => {
    await supabase.from('admin_roles').delete().eq('email', EMAIL);
  });

  it('getAdminRole returns null when there is no row', async () => {
    expect(await getAdminRole(EMAIL)).toBeNull();
  });

  it('upsert creates the row, then updates it', async () => {
    await upsertAdminRole(EMAIL, 'operator');
    expect(await getAdminRole(EMAIL)).toBe('operator');
    await upsertAdminRole(EMAIL, 'owner');
    expect(await getAdminRole(EMAIL)).toBe('owner');
  });

  it('normalizes email case on write and read', async () => {
    await upsertAdminRole('IT-Roles@Club.com', 'operator');
    expect(await getAdminRole('it-roles@club.com')).toBe('operator');
    expect(await getAdminRole('IT-ROLES@CLUB.COM')).toBe('operator');
  });

  it('listAdminRoles includes the stored row', async () => {
    await upsertAdminRole(EMAIL, 'operator');
    expect(await listAdminRoles()).toContainEqual({ email: EMAIL, role: 'operator' });
  });

  it('rejects unknown roles and non-lowercase emails at the database level', async () => {
    const badRole = await supabase.from('admin_roles').insert({ email: EMAIL, role: 'admin' });
    expect(badRole.error).not.toBeNull();
    const badEmail = await supabase.from('admin_roles').insert({ email: 'IT-Roles@club.com', role: 'owner' });
    expect(badEmail.error).not.toBeNull();
  });

  it('is closed to the anon role', async () => {
    const read = await supabaseAnon.from('admin_roles').select('*');
    expect(read.error).not.toBeNull();
    const write = await supabaseAnon.from('admin_roles').insert({ email: 'evil@x.com', role: 'owner' });
    expect(write.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/admin-roles.integration.test.ts`
Expected: FAIL — `Failed to resolve import "./admin-roles"`.

- [ ] **Step 3: Implementar `src/lib/db/admin-roles.ts`**

No hay función de borrado a propósito: con "sin fila = owner", borrar una fila ascendería a esa persona a owner. Los tests limpian con el cliente service directo.

```ts
import { serviceClient } from './service-client';

export type AdminRole = 'owner' | 'operator';

export interface AdminRoleRow {
  email: string;
  role: AdminRole;
}

/** Explicit role for an email, or null when there is no row (caller decides the default). */
export async function getAdminRole(email: string): Promise<AdminRole | null> {
  const { data, error } = await serviceClient()
    .from('admin_roles').select('role').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as AdminRole | undefined) ?? null;
}

export async function listAdminRoles(): Promise<AdminRoleRow[]> {
  const { data, error } = await serviceClient()
    .from('admin_roles').select('email, role').order('email');
  if (error) throw new Error(error.message);
  return data as AdminRoleRow[];
}

export async function upsertAdminRole(email: string, role: AdminRole): Promise<void> {
  const { error } = await serviceClient()
    .from('admin_roles').upsert({ email: email.toLowerCase(), role });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run -c vitest.integration.config.ts src/lib/db/admin-roles.integration.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/admin-roles.ts src/lib/db/admin-roles.integration.test.ts
git commit -m "feat(db): add admin roles data layer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `requireAdmin(opts?)` devuelve `{ email, role }`

**Files:**
- Modify: `src/lib/auth/require-admin.ts`
- Test: `src/lib/auth/require-admin.test.ts` (reescritura)
- Modify: `src/app/admin/actions.test.ts:1-36` (cabecera de mocks; sin esto los tests de acciones llamarían a la BD real)

Callers de `requireAdmin` (verificado con `grep -rn "requireAdmin" src`): `src/app/admin/actions.ts` (8 llamadas) y `src/app/admin/checkin/[id]/page.tsx` (1). Ambos usan `await requireAdmin()` sin leer el resultado, así que la nueva firma es compatible; el gating owner se añade en la Task 10.

- [ ] **Step 1: Reescribir el test (falla)**

Reemplazar el contenido completo de `src/lib/auth/require-admin.test.ts` por:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));
vi.mock('@/lib/db/admin-roles', () => ({
  getAdminRole: vi.fn(async () => null),
}));

import { requireAdmin } from './require-admin';
import { getAdminRole } from '@/lib/db/admin-roles';

const ADMIN_EMAIL = 'admin@club.com';
process.env.ADMIN_EMAILS = ADMIN_EMAIL;

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminRole).mockResolvedValue(null);
  });

  it('throws Unauthorized when there is no session', async () => {
    mockUser = null;
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
    expect(getAdminRole).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the session email is not on the allowlist', async () => {
    mockUser = { id: 'u1', email: 'intruder@evil.com' };
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
    expect(getAdminRole).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the session has no email', async () => {
    mockUser = { id: 'u1' };
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
  });

  it('treats an allowlisted email without a role row as owner', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    await expect(requireAdmin()).resolves.toEqual({ email: ADMIN_EMAIL, role: 'owner' });
    expect(getAdminRole).toHaveBeenCalledWith(ADMIN_EMAIL);
  });

  it('returns the lowercased email and looks the role up lowercased', async () => {
    mockUser = { id: 'u1', email: 'Admin@Club.com' };
    await expect(requireAdmin()).resolves.toEqual({ email: ADMIN_EMAIL, role: 'owner' });
    expect(getAdminRole).toHaveBeenCalledWith(ADMIN_EMAIL);
  });

  it('returns the stored role (operator)', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(requireAdmin()).resolves.toEqual({ email: ADMIN_EMAIL, role: 'operator' });
  });

  it('throws Forbidden when owner is required and the role is operator', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(requireAdmin({ role: 'owner' })).rejects.toThrow('Forbidden');
  });

  it('passes the owner requirement for the default (no row) owner', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    await expect(requireAdmin({ role: 'owner' })).resolves.toEqual({ email: ADMIN_EMAIL, role: 'owner' });
  });

  it('fails closed when the role lookup errors', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    vi.mocked(getAdminRole).mockRejectedValue(new Error('db down'));
    await expect(requireAdmin()).rejects.toThrow('db down');
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/lib/auth/require-admin.test.ts`
Expected: FAIL — p. ej. `expected undefined to deeply equal { email: 'admin@club.com', role: 'owner' }`.

- [ ] **Step 3: Implementar**

Reemplazar el contenido completo de `src/lib/auth/require-admin.ts` por:
```ts
import 'server-only';
import { ssrClient } from '@/lib/db/ssr-client';
import { getAdminRole, type AdminRole } from '@/lib/db/admin-roles';
import { isAdminEmail } from './admin';

export type { AdminRole } from '@/lib/db/admin-roles';

/**
 * Backend admin gate. Validates the Supabase auth token server-side and checks
 * the user's email against the ADMIN_EMAILS allowlist ('Unauthorized'
 * otherwise). The role comes from admin_roles; an allowlisted email with no
 * row is 'owner'. With `{ role: 'owner' }` an operator gets 'Forbidden'.
 * A failed role lookup throws (fail closed). Call this in every admin server
 * action AND any server component that reads customer data.
 */
export async function requireAdmin(opts?: { role?: 'owner' }): Promise<{ email: string; role: AdminRole }> {
  const supabase = await ssrClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) throw new Error('Unauthorized');
  const email = user.email.toLowerCase();
  const role: AdminRole = (await getAdminRole(email)) ?? 'owner';
  if (opts?.role === 'owner' && role !== 'owner') throw new Error('Forbidden');
  return { email, role };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/lib/auth/require-admin.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Actualizar la cabecera de `src/app/admin/actions.test.ts`**

`requireAdmin` ahora importa `@/lib/db/admin-roles`; sin mock, `actions.test.ts` intentaría crear un cliente Supabase real. Reemplazar todo desde la línea 1 hasta la línea `import { sendVoucherEmail } from '@/lib/email/send';` (inclusive) por:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

const ADMIN_EMAIL = 'admin@club.com';
const OPS_EMAIL = 'ops@club.com';
process.env.ADMIN_EMAILS = `${ADMIN_EMAIL},${OPS_EMAIL}`;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));
vi.mock('@/lib/db/reservations', () => ({
  listReservationsByDate: vi.fn(),
  getReservation: vi.fn(),
  checkInReservation: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listOverrides: vi.fn(),
  upsertOverride: vi.fn(),
  deleteOverride: vi.fn(),
}));
vi.mock('@/lib/db/admin-roles', () => ({
  getAdminRole: vi.fn(async () => null),
  listAdminRoles: vi.fn(async () => []),
  upsertAdminRole: vi.fn(async () => {}),
}));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(async () => {}),
  listAudit: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock('@/lib/bcv-history', () => ({
  listBcvHistory: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock('@/lib/email/send', () => ({
  sendVoucherEmail: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  adminListReservations, adminGetDaySummary, adminCheckIn, adminResendVoucher,
  adminGetSettings, adminUpdateSettings, adminUpsertOverride, adminDeleteOverride,
} from './actions';
import {
  listReservationsByDate, getReservation, checkInReservation, getSettings,
  updateSettings, listOverrides, upsertOverride, deleteOverride,
} from '@/lib/db/reservations';
import { sendVoucherEmail } from '@/lib/email/send';
import { getAdminRole } from '@/lib/db/admin-roles';

// Default for every test: an allowlisted email with no admin_roles row = owner.
// (vi.clearAllMocks only clears call history, so a test that switches the role
// must not leak it — this resets it before every test.)
beforeEach(() => {
  vi.mocked(getAdminRole).mockResolvedValue(null);
});
```

- [ ] **Step 6: Correr la suite unitaria completa**

Run: `npm test`
Expected: PASS (todos; `actions.test.ts` sigue verde sin cambios en sus casos).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/require-admin.ts src/lib/auth/require-admin.test.ts src/app/admin/actions.test.ts
git commit -m "feat(auth): resolve admin role in requireAdmin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Settings y overrides exigen rol owner

**Files:**
- Modify: `src/app/admin/actions.ts` (`adminGetSettings`, `adminUpdateSettings`, `adminUpsertOverride`, `adminDeleteOverride`)
- Modify: `src/app/admin/(dashboard)/settings/page.tsx`
- Test: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Al final de `src/app/admin/actions.test.ts` añadir:
```ts
describe('owner-only actions reject an operator', () => {
  const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'ops-1', email: OPS_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
  });

  it('adminGetSettings rejects with Forbidden and never reads', async () => {
    await expect(adminGetSettings()).rejects.toThrow('Forbidden');
    expect(getSettings).not.toHaveBeenCalled();
    expect(listOverrides).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings rejects with Forbidden and never writes', async () => {
    await expect(
      adminUpdateSettings({ daily_capacity: 100, adult_price_usd: 10, child_price_usd: 5 })
    ).rejects.toThrow('Forbidden');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride rejects with Forbidden and never writes', async () => {
    await expect(adminUpsertOverride('2030-01-15', 5)).rejects.toThrow('Forbidden');
    expect(upsertOverride).not.toHaveBeenCalled();
  });

  it('adminDeleteOverride rejects with Forbidden and never writes', async () => {
    await expect(adminDeleteOverride('2030-01-15')).rejects.toThrow('Forbidden');
    expect(deleteOverride).not.toHaveBeenCalled();
  });

  it('an operator can still check guests in', async () => {
    vi.mocked(checkInReservation).mockResolvedValue(undefined);
    await expect(adminCheckIn(ID)).resolves.toEqual({ ok: true });
    expect(checkInReservation).toHaveBeenCalledWith(ID);
  });

  it('an operator can still read the day list', async () => {
    vi.mocked(listReservationsByDate).mockResolvedValue([]);
    await expect(adminListReservations('2030-01-15')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — 4 tests `promise resolved ... instead of rejecting` / `expected [Function] to throw 'Forbidden'`.

- [ ] **Step 3: Implementar el gating**

En `src/app/admin/actions.ts`, cambiar la primera línea del cuerpo de estas 4 funciones de `await requireAdmin();` a `await requireAdmin({ role: 'owner' });`:
- `adminGetSettings`
- `adminUpdateSettings`
- `adminUpsertOverride`
- `adminDeleteOverride`

Resultado esperado (ejemplo `adminGetSettings`):
```ts
export async function adminGetSettings() {
  await requireAdmin({ role: 'owner' });
  const [settings, overrides] = await Promise.all([getSettings(), listOverrides()]);
  return { settings, overrides };
}
```
(La Task 11 vuelve a escribir las otras 3 completas.)

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Aviso para operator en la página de configuración**

Reemplazar el contenido completo de `src/app/admin/(dashboard)/settings/page.tsx` por:
```tsx
import { adminGetSettings } from '../../actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  // Settings are owner-only; show a notice instead of an error page to operators.
  const me = await requireAdmin();
  if (me.role !== 'owner') {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Solo un owner puede ver y cambiar la configuración.
      </p>
    );
  }
  const { settings, overrides } = await adminGetSettings();
  return <SettingsForm settings={settings} overrides={overrides} />;
}
```

- [ ] **Step 6: Typecheck rápido**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts "src/app/admin/(dashboard)/settings/page.tsx"
git commit -m "feat(admin): restrict settings and overrides to owners" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `logAudit` en las 5 acciones que escriben (solo en éxito)

**Files:**
- Modify: `src/app/admin/actions.ts` (imports + `adminCheckIn`, `adminResendVoucher`, `adminUpdateSettings`, `adminUpsertOverride`, `adminDeleteOverride`)
- Test: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/app/admin/actions.test.ts`, debajo de `import { getAdminRole } from '@/lib/db/admin-roles';` añadir:
```ts
import { logAudit } from '@/lib/audit';
```
Al final del archivo añadir:
```ts
describe('admin write actions record an audit entry on success only', () => {
  const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
  const reservation = {
    id: ID, code: 'PP-ABCDE', date: '2030-01-15', first_name: 'Ana', last_name: 'Pérez',
    email: 'ana@example.com', id_type: 'V', id_number: '123', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
    payment_ref: 'REF-1', expires_at: null, checked_in_at: null, created_at: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
  });

  it('adminCheckIn logs reservation.check_in', async () => {
    vi.mocked(checkInReservation).mockResolvedValue(undefined);
    await expect(adminCheckIn(ID)).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({ actor: ADMIN_EMAIL, action: 'reservation.check_in', target: ID });
  });

  it('adminCheckIn does not log when the check-in fails', async () => {
    vi.mocked(checkInReservation).mockRejectedValue(new Error('reservation not in expected status'));
    const res = await adminCheckIn(ID);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminResendVoucher logs reservation.resend_voucher with the code', async () => {
    vi.mocked(getReservation).mockResolvedValue(reservation as never);
    vi.mocked(sendVoucherEmail).mockResolvedValue(undefined);
    await expect(adminResendVoucher(ID)).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({
      actor: ADMIN_EMAIL, action: 'reservation.resend_voucher', target: ID, details: { code: 'PP-ABCDE' },
    });
  });

  it('adminResendVoucher does not log when the email fails', async () => {
    vi.mocked(getReservation).mockResolvedValue(reservation as never);
    vi.mocked(sendVoucherEmail).mockRejectedValue(new Error('smtp down'));
    const res = await adminResendVoucher(ID);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminResendVoucher does not log for a non-resendable reservation', async () => {
    vi.mocked(getReservation).mockResolvedValue({ ...reservation, status: 'pending_payment' } as never);
    const res = await adminResendVoucher(ID);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings logs settings.update with the saved values', async () => {
    vi.mocked(updateSettings).mockResolvedValue(undefined);
    const values = { daily_capacity: 80, adult_price_usd: 15, child_price_usd: 5 };
    await expect(adminUpdateSettings(values)).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({ actor: ADMIN_EMAIL, action: 'settings.update', details: values });
  });

  it('adminUpdateSettings does not log when the save fails', async () => {
    vi.mocked(updateSettings).mockRejectedValue(new Error('db down'));
    const res = await adminUpdateSettings({ daily_capacity: 80, adult_price_usd: 15, child_price_usd: 5 });
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings does not log invalid input', async () => {
    const res = await adminUpdateSettings({ daily_capacity: -1, adult_price_usd: 15, child_price_usd: 5 });
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride logs override.upsert with capacity and reason', async () => {
    vi.mocked(upsertOverride).mockResolvedValue(undefined);
    await expect(adminUpsertOverride('2030-02-01', 25, '  Mantenimiento ')).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({
      actor: ADMIN_EMAIL, action: 'override.upsert', target: '2030-02-01',
      details: { capacity: 25, reason: 'Mantenimiento' },
    });
  });

  it('adminUpsertOverride does not log when the save fails', async () => {
    vi.mocked(upsertOverride).mockRejectedValue(new Error('db down'));
    const res = await adminUpsertOverride('2030-02-01', 25);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminDeleteOverride logs override.delete', async () => {
    vi.mocked(deleteOverride).mockResolvedValue(undefined);
    await expect(adminDeleteOverride('2030-02-01')).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({ actor: ADMIN_EMAIL, action: 'override.delete', target: '2030-02-01' });
  });

  it('adminDeleteOverride does not log when the delete fails', async () => {
    vi.mocked(deleteOverride).mockRejectedValue(new Error('db down'));
    const res = await adminDeleteOverride('2030-02-01');
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });
});
```

Nota: el test existente `adminUpsertOverride forwards reason to db` no fija la implementación de `upsertOverride`; como `mockRejectedValue` de este bloque persistiría tras `vi.clearAllMocks()`, si ese test corre después fallaría. Vitest ejecuta los `describe` en orden de archivo y este bloque va al final, así que no le afecta. Aun así, para que sea robusto, en `it('adminUpsertOverride forwards reason to db', ...)` añadir como primera línea:
```ts
    vi.mocked(upsertOverride).mockResolvedValue(undefined);
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — los 5 tests "logs ..." con `expected "spy" to be called with arguments`.

- [ ] **Step 3: Implementar**

En `src/app/admin/actions.ts`, debajo de `import { sendVoucherEmail } from '@/lib/email/send';` añadir:
```ts
import { logAudit } from '@/lib/audit';
```

Reemplazar `adminCheckIn` completa por:
```ts
export async function adminCheckIn(id: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin();
  try {
    await checkInReservation(id);
  } catch {
    // status guard: reservation not confirmed (already checked in, pending, failed…)
    return { ok: false, message: 'La reserva no está en estado confirmado.' };
  }
  await logAudit({ actor: me.email, action: 'reservation.check_in', target: id });
  revalidatePath('/admin');
  return { ok: true };
}
```

Reemplazar `adminResendVoucher` completa por:
```ts
export async function adminResendVoucher(id: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin();
  let code: string;
  try {
    const r = await getReservation(id);
    if (!r || !['confirmed', 'checked_in'].includes(r.status)) {
      return { ok: false, message: 'Reserva no reenviable.' };
    }
    await sendVoucherEmail({
      reservationId: r.id, code: r.code, email: r.email,
      firstName: r.first_name, lastName: r.last_name,
      idType: r.id_type, idNumber: r.id_number,
      date: r.date, adults: r.adults, children: r.children,
      totalUsd: Number(r.total_usd), totalVes: Number(r.total_ves ?? 0), bcvRate: Number(r.bcv_rate ?? 0),
    });
    code = r.code;
  } catch {
    return { ok: false, message: 'No se pudo reenviar el correo.' };
  }
  await logAudit({ actor: me.email, action: 'reservation.resend_voucher', target: id, details: { code } });
  return { ok: true };
}
```

Reemplazar `adminUpdateSettings` completa por:
```ts
export async function adminUpdateSettings(raw: unknown): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Valores inválidos.' };
  try {
    await updateSettings(parsed.data);
  } catch {
    return { ok: false, message: 'No se pudo guardar.' };
  }
  await logAudit({ actor: me.email, action: 'settings.update', details: parsed.data });
  revalidatePath('/admin/settings');
  return { ok: true };
}
```

Reemplazar `adminUpsertOverride` completa por:
```ts
export async function adminUpsertOverride(
  date: string,
  capacity: number,
  reason?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(capacity) || capacity < 0 || capacity > 10000) {
    return { ok: false, message: 'Valores inválidos.' };
  }
  try {
    await upsertOverride(date, capacity, cleanReason || null);
  } catch {
    return { ok: false, message: 'No se pudo guardar.' };
  }
  await logAudit({
    actor: me.email, action: 'override.upsert', target: date,
    details: { capacity, reason: cleanReason || null },
  });
  revalidatePath('/admin/settings');
  return { ok: true };
}
```

Reemplazar `adminDeleteOverride` completa por:
```ts
export async function adminDeleteOverride(date: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Fecha inválida.' };
  try {
    await deleteOverride(date);
  } catch {
    return { ok: false, message: 'No se pudo eliminar.' };
  }
  await logAudit({ actor: me.email, action: 'override.delete', target: date });
  revalidatePath('/admin/settings');
  return { ok: true };
}
```

Nota: `revalidatePath` queda fuera del `try` a propósito: antes un fallo de `revalidatePath` se reportaba como "No se pudo guardar." aunque la BD ya se hubiera escrito.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "feat(admin): audit check-in, voucher resend, settings and overrides" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Acciones owner-only de roles

**Files:**
- Modify: `src/app/admin/actions.ts` (imports + `AdminAccessEntry`, `adminListRoles`, `adminUpsertRole`)
- Test: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/app/admin/actions.test.ts`:

Reemplazar el bloque:
```ts
import {
  adminListReservations, adminGetDaySummary, adminCheckIn, adminResendVoucher,
  adminGetSettings, adminUpdateSettings, adminUpsertOverride, adminDeleteOverride,
} from './actions';
```
por:
```ts
import {
  adminListReservations, adminGetDaySummary, adminCheckIn, adminResendVoucher,
  adminGetSettings, adminUpdateSettings, adminUpsertOverride, adminDeleteOverride,
  adminListRoles, adminUpsertRole,
} from './actions';
```
Reemplazar:
```ts
import { getAdminRole } from '@/lib/db/admin-roles';
```
por:
```ts
import { getAdminRole, listAdminRoles, upsertAdminRole } from '@/lib/db/admin-roles';
```
Al final del archivo añadir:
```ts
describe('role management (owner only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
    vi.mocked(listAdminRoles).mockResolvedValue([]);
    vi.mocked(upsertAdminRole).mockResolvedValue(undefined);
  });

  it('rejects without a session', async () => {
    mockUser = null;
    await expect(adminListRoles()).rejects.toThrow('Unauthorized');
    await expect(adminUpsertRole({ email: OPS_EMAIL, role: 'operator' })).rejects.toThrow('Unauthorized');
    expect(upsertAdminRole).not.toHaveBeenCalled();
  });

  it('rejects an operator with Forbidden', async () => {
    mockUser = { id: 'ops-1', email: OPS_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(adminListRoles()).rejects.toThrow('Forbidden');
    await expect(adminUpsertRole({ email: ADMIN_EMAIL, role: 'operator' })).rejects.toThrow('Forbidden');
    expect(upsertAdminRole).not.toHaveBeenCalled();
  });

  it('adminListRoles lists every allowlisted email with its effective role', async () => {
    vi.mocked(listAdminRoles).mockResolvedValue([
      { email: OPS_EMAIL, role: 'operator' },
      { email: 'gone@club.com', role: 'owner' }, // row for an email no longer allowlisted
    ]);
    await expect(adminListRoles()).resolves.toEqual([
      { email: ADMIN_EMAIL, role: 'owner', explicit: false },
      { email: OPS_EMAIL, role: 'operator', explicit: true },
    ]);
  });

  it('adminUpsertRole stores a normalized email and audits it', async () => {
    await expect(adminUpsertRole({ email: '  OPS@Club.com ', role: 'operator' })).resolves.toEqual({ ok: true });
    expect(upsertAdminRole).toHaveBeenCalledWith(OPS_EMAIL, 'operator');
    expect(logAudit).toHaveBeenCalledWith({
      actor: ADMIN_EMAIL, action: 'role.upsert', target: OPS_EMAIL, details: { role: 'operator' },
    });
  });

  it('adminUpsertRole rejects an unknown role', async () => {
    const res = await adminUpsertRole({ email: OPS_EMAIL, role: 'superadmin' });
    expect(res.ok).toBe(false);
    expect(upsertAdminRole).not.toHaveBeenCalled();
  });

  it('adminUpsertRole rejects an email outside ADMIN_EMAILS', async () => {
    const res = await adminUpsertRole({ email: 'stranger@club.com', role: 'operator' });
    expect(res).toEqual({ ok: false, message: 'Ese correo no está en ADMIN_EMAILS.' });
    expect(upsertAdminRole).not.toHaveBeenCalled();
  });

  it('adminUpsertRole forbids an owner from demoting themself', async () => {
    const res = await adminUpsertRole({ email: ADMIN_EMAIL, role: 'operator' });
    expect(res).toEqual({ ok: false, message: 'No puedes quitarte tu propio rol de owner.' });
    expect(upsertAdminRole).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpsertRole reports a DB failure without auditing', async () => {
    vi.mocked(upsertAdminRole).mockRejectedValue(new Error('db down'));
    const res = await adminUpsertRole({ email: OPS_EMAIL, role: 'operator' });
    expect(res).toEqual({ ok: false, message: 'No se pudo guardar.' });
    expect(logAudit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — `adminListRoles is not a function` (y similares).

- [ ] **Step 3: Implementar**

En `src/app/admin/actions.ts`:

Reemplazar:
```ts
import { requireAdmin } from '@/lib/auth/require-admin';
```
por:
```ts
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminEmails, isAdminEmail } from '@/lib/auth/admin';
import { listAdminRoles, upsertAdminRole, type AdminRole } from '@/lib/db/admin-roles';
```

Al final del archivo añadir:
```ts
// ── Roles (owner only) ──────────────────────────────────────────────────────

export interface AdminAccessEntry {
  email: string;
  role: AdminRole;
  /** true when admin_roles has a row; false = default owner. */
  explicit: boolean;
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const roleSchema = z.object({
  email: emailSchema,
  role: z.enum(['owner', 'operator']),
});

/** Every allowlisted email with its effective role (no row = owner). */
export async function adminListRoles(): Promise<AdminAccessEntry[]> {
  await requireAdmin({ role: 'owner' });
  const rows = await listAdminRoles();
  const byEmail = new Map(rows.map((r) => [r.email, r.role]));
  return adminEmails().map((email) => ({
    email,
    role: byEmail.get(email) ?? 'owner',
    explicit: byEmail.has(email),
  }));
}

/**
 * The only way to change a role. There is deliberately no delete: with
 * "no row = owner", removing someone's row would silently promote them.
 * To revoke access, remove the email from ADMIN_EMAILS.
 */
export async function adminUpsertRole(raw: unknown): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Valores inválidos.' };
  const { email, role } = parsed.data;
  if (!isAdminEmail(email)) return { ok: false, message: 'Ese correo no está en ADMIN_EMAILS.' };
  if (email === me.email && role !== 'owner') {
    return { ok: false, message: 'No puedes quitarte tu propio rol de owner.' };
  }
  try {
    await upsertAdminRole(email, role);
  } catch {
    return { ok: false, message: 'No se pudo guardar.' };
  }
  await logAudit({ actor: me.email, action: 'role.upsert', target: email, details: { role } });
  revalidatePath('/admin/settings');
  return { ok: true };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "feat(admin): add owner-only role management actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: `adminListAudit` (owner) y `adminListBcvHistory`

**Files:**
- Modify: `src/app/admin/actions.ts` (imports + 2 acciones)
- Test: `src/app/admin/actions.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `src/app/admin/actions.test.ts`:

En el bloque de import de `./actions`, reemplazar la línea:
```ts
  adminListRoles, adminUpsertRole,
```
por:
```ts
  adminListRoles, adminUpsertRole, adminListAudit, adminListBcvHistory,
```
Reemplazar:
```ts
import { logAudit } from '@/lib/audit';
```
por:
```ts
import { logAudit, listAudit } from '@/lib/audit';
import { listBcvHistory } from '@/lib/bcv-history';
```
Al final del archivo añadir:
```ts
describe('paginated read actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
  });

  it('adminListAudit forwards the page to listAudit for an owner', async () => {
    const page = {
      rows: [{
        id: 1, at: '2030-01-01T00:00:00Z', actor_email: ADMIN_EMAIL,
        action: 'settings.update' as const, target: null, details: {},
      }],
      total: 1,
    };
    vi.mocked(listAudit).mockResolvedValue(page);
    await expect(adminListAudit({ page: 2, pageSize: 25 })).resolves.toEqual(page);
    expect(listAudit).toHaveBeenCalledWith({ page: 2, pageSize: 25 });
  });

  it('adminListAudit rejects an operator with Forbidden', async () => {
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(adminListAudit({ page: 1, pageSize: 10 })).rejects.toThrow('Forbidden');
    expect(listAudit).not.toHaveBeenCalled();
  });

  it('adminListAudit rejects invalid paging', async () => {
    await expect(adminListAudit({ page: 0, pageSize: 10 })).rejects.toThrow('Invalid page');
    await expect(adminListAudit({ page: 1, pageSize: 500 })).rejects.toThrow('Invalid page');
    await expect(adminListAudit('nope')).rejects.toThrow('Invalid page');
    expect(listAudit).not.toHaveBeenCalled();
  });

  it('adminListBcvHistory is available to an operator', async () => {
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    const page = { rows: [{ id: 1, fetched_at: '2030-01-01T00:00:00Z', rate: 36.5, source: 'auto' }], total: 1 };
    vi.mocked(listBcvHistory).mockResolvedValue(page);
    await expect(adminListBcvHistory({ page: 1, pageSize: 10 })).resolves.toEqual(page);
    expect(listBcvHistory).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('adminListBcvHistory rejects without a session and with invalid paging', async () => {
    await expect(adminListBcvHistory({ page: 1.5, pageSize: 10 })).rejects.toThrow('Invalid page');
    mockUser = null;
    await expect(adminListBcvHistory({ page: 1, pageSize: 10 })).rejects.toThrow('Unauthorized');
    expect(listBcvHistory).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: FAIL — `adminListAudit is not a function`.

- [ ] **Step 3: Implementar**

En `src/app/admin/actions.ts`, reemplazar:
```ts
import { logAudit } from '@/lib/audit';
```
por:
```ts
import { logAudit, listAudit, type AuditRow } from '@/lib/audit';
import { listBcvHistory, type BcvHistoryRow } from '@/lib/bcv-history';
```
Al final del archivo añadir:
```ts
// ── Paginated read-only listings ────────────────────────────────────────────

const pageSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

export async function adminListAudit(raw: unknown): Promise<{ rows: AuditRow[]; total: number }> {
  await requireAdmin({ role: 'owner' });
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid page');
  return listAudit(parsed.data);
}

export async function adminListBcvHistory(raw: unknown): Promise<{ rows: BcvHistoryRow[]; total: number }> {
  await requireAdmin();
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid page');
  return listBcvHistory(parsed.data);
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/app/admin/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions.test.ts
git commit -m "feat(admin): add audit log and BCV history listing actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Verificación final

**Files:** ninguno (si algo falla, corregir en el archivo correspondiente y hacer commit `fix(...)` antes de seguir).

- [ ] **Step 1: Confirmar que no quedan callers con la firma vieja**

Run: `grep -rn "requireAdmin" src`
Expected: solo `src/lib/auth/require-admin.ts`, su test, `src/app/admin/actions.ts`, `src/app/admin/checkin/[id]/page.tsx`, `src/app/admin/(dashboard)/settings/page.tsx` y el comentario de `src/middleware.ts`. Ninguno espera `Promise<void>`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores ni warnings nuevos.

- [ ] **Step 3: Unit tests**

Run: `npm test`
Expected: todos PASS.

- [ ] **Step 4: Integration tests**

Run:
```bash
npx supabase status   # debe mostrar el stack corriendo; si no: npx supabase start
npm run test:integration
```
Expected: todos PASS, incluidos `audit.integration.test.ts`, `bcv-history.integration.test.ts`, `admin-roles.integration.test.ts` y los preexistentes.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully` y sin errores de tipos. (Si el build se queja de que un archivo `'use server'` exporta algo que no es una función async, revisar que `AdminAccessEntry` se exporte como `interface` — los tipos sí están permitidos.)

- [ ] **Step 6: Revisar el diff completo**

Run: `git log --oneline origin/develop..HEAD && git diff --stat origin/develop...HEAD`
Expected: solo los archivos del "Mapa de archivos" (más `reservations.integration.test.ts` si se aplicó la Task 0 Step 4).

---

### Task 15: Abrir el PR

**Files:** ninguno

- [ ] **Step 1: Push**

Run:
```bash
git push -u origin feat/backend-audit-roles
```
Expected: rama publicada. (Si SSH falla con `Permission denied (publickey)`, ver §5 del roadmap: `gh auth setup-git` y remoto HTTPS.)

- [ ] **Step 2: Crear el PR**

Run:
```bash
gh pr create --base develop --assignee JoseSleiter --label "area:backend,enhancement" \
  --title "feat(backend): auditoría, historial BCV y roles de admin" \
  --body-file - <<'EOF'
## Resumen

Primer PR de la ola 1 del roadmap UX (`docs/superpowers/plans/2026-10-04-ux-overhaul-roadmap.md`, PR 01). Solo backend: no cambia la UI salvo un aviso en `/admin/settings` para operadores.

### Migraciones
- `0005_audit_log.sql`: tabla `audit_log` (append-only para el service role).
- `0006_bcv_rate_history.sql`: tabla `bcv_rate_history` (append-only, `rate > 0`).
- `0007_admin_roles.sql`: tabla `admin_roles` (`owner` | `operator`, email en minúsculas).
- Las tres con RLS activado y sin políticas; `anon`/`authenticated` sin permisos (mismo criterio que `0003`).

### Auditoría
- `src/lib/audit.ts`: `logAudit` (nunca lanza; si falla, `console.error`) y `listAudit` paginado.
- Se registra, solo en éxito: check-in, reenvío de voucher, cambio de configuración, crear/editar excepción, borrar excepción, y cambios de roles.

### Historial BCV
- `getBcvRate` acepta la dependencia opcional `recordHistory`, que se llama únicamente tras traer una tasa nueva (nunca al leer la caché).
- `src/lib/bcv-history.ts`: `recordBcvRate` y `listBcvHistory` paginado. `source` = `'auto'` (tráfico) o `'manual'` (botón de refresco del PR 11).

### Roles
- `requireAdmin(opts?)` devuelve `{ email, role }`. El gate sigue siendo `ADMIN_EMAILS`; un email permitido sin fila en `admin_roles` es `owner`. Con `{ role: 'owner' }` un operador recibe `Forbidden`. Si la consulta de rol falla, se deniega.
- Owner-only: configuración, excepciones, roles y auditoría.
- Acciones nuevas: `adminListRoles`, `adminUpsertRole` (un owner no puede degradarse a sí mismo), `adminListAudit`, `adminListBcvHistory`.
- No hay borrado de roles: con "sin fila = owner", borrar una fila ascendería a esa persona. Quitar acceso = sacar el email de `ADMIN_EMAILS`; los roles solo se cambian.

### Desviaciones del roadmap
Documentadas al inicio de `docs/superpowers/plans/2026-10-04-pr01-backend-audit-roles.md`.

## Pruebas
- `npm run lint`
- `npm test`
- `npm run test:integration` (con `npx supabase start`)
- `npm run build`

## Despliegue
Aplicar migraciones en Supabase cloud con `npx supabase db push`. Sin variables de entorno nuevas. Nadie pierde acceso: sin filas en `admin_roles`, todos los emails de `ADMIN_EMAILS` siguen siendo owner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```
Expected: imprime la URL del PR.

---

## Self-review (hecho al escribir el plan)

- **Cobertura del alcance:** migraciones 0005–0007 (Task 1); `logAudit`/`listAudit` (Task 3); historial BCV en fetch fresco + `listBcvHistory` (Tasks 4–6); `requireAdmin(opts?)` → `{ email, role }`, sin fila = owner (Task 9); callers actualizados (`actions.ts` Tasks 10–13, `checkin/[id]/page.tsx` compatible sin cambio, `settings/page.tsx` Task 10); `logAudit` en las 5 acciones solo en éxito (Task 11); settings/overrides owner-only (Task 10); `adminListRoles`/`adminUpsertRole` con protección contra auto-degradación, sin acción de borrado de roles (Task 12); `adminListAudit`/`adminListBcvHistory` (Task 13); verificación y PR (Tasks 14–15).
- **Consistencia de nombres:** `AuditAction`, `AuditRow`, `logAudit`, `listAudit` (audit.ts); `BcvRateSource`, `BcvHistoryRow`, `recordBcvRate`, `listBcvHistory` (bcv-history.ts); `AdminRole`, `AdminRoleRow`, `getAdminRole`, `listAdminRoles`, `upsertAdminRole` (admin-roles.ts); `pageRange`, `paginate`, `OrderBy`, `MAX_PAGE_SIZE` (paginate.ts); `adminEmails`, `isAdminEmail` (admin.ts); `RateDeps.recordHistory`. Usados igual en todas las tasks.
- **Mocks:** `actions.test.ts` mockea `@/lib/db/admin-roles`, `@/lib/audit` y `@/lib/bcv-history` desde la Task 9, y un `beforeEach` de nivel superior restablece `getAdminRole → null` para que ningún test filtre el rol `operator` a otro.
