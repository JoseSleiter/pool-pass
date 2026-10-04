# PR 07 — Admin shell (sidebar, drawer, topbar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el shell del panel `/admin` por uno navegable por grupos (sidebar navy colapsable en desktop, drawer accesible en móvil, topbar con breadcrumb, badge BCV, campana de pendientes y fecha de Caracas, pill de perfil con rol) y forzar `<html lang="es">` en todo `/admin/*`.

**Architecture:** La navegación vive en datos (`nav-config.ts`): grupos → ítems con `ready` y `ownerOnly`; funciones puras filtran por rol, marcan la ruta activa y derivan el breadcrumb. El layout `(dashboard)` (server component) llama `requireAdmin()` para obtener `{email, role}` y `loadShellStatus()` para la tasa BCV en caché y el conteo de `pending_payment`, y se los pasa al `AdminShell` (client). Para el `lang`, el middleware (que ya corre en todo `/admin/:path*`) reenvía un header de petición `x-pp-scope: admin` que el root layout lee con `headers()`.

**Tech Stack:** Next.js 16.2 App Router (middleware, `headers()`, `redirect()`), React 19 (`useSyncExternalStore`), Tailwind v4 con tokens de `globals.css` (`navy`, `navy-deep`, `teal`, `teal-soft`, `coral`, `mint`, `font-heading`), `@base-ui/react/dialog` (drawer con focus trap/Escape/aria), lucide-react 1.23, Vitest + Testing Library, Playwright.

---

## Contexto y reglas para quien ejecuta

- **Worktree:** todo se hace en `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-shell` (rama `feat/admin-shell`, base `develop`). No crear worktree, no hacer push, no abrir PR (lo hace el coordinador).
- **Node:** el Node por defecto es v16. Todo comando npm/npx va precedido de `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null &&`. En los comandos de abajo se abrevia como `N20 &&`; escríbelo completo al ejecutar:
  ```bash
  cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-shell && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && <comando>
  ```
- **Supabase local** ya corre y es compartido: prohibido `supabase start/stop/db reset/migration`. Este PR no necesita migraciones.
- **E2E serializado** con lock:
  ```bash
  L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"
  ```
- **Commits:** conventional, cuerpo opcional, y SIEMPRE terminan con una línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Admin = español en duro.** No usar diccionarios i18n en componentes de `/admin`.
- **Next 16:** `headers()` es async y de solo lectura (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/headers.md`); `redirect()` lanza una excepción y debe llamarse fuera del `try` (`.../04-functions/redirect.md`); la convención `middleware` está deprecada en favor de `proxy` pero sigue funcionando (`.../03-file-conventions/proxy.md`). Para reenviar headers a la app se usa `NextResponse.next({ request: { headers } })` (sección "Setting Headers"), nunca `NextResponse.next({ headers })`. El worktree aún no tiene `node_modules`; tras la Task 0 los docs están en `node_modules/next/dist/docs/`.
- **Fuera de alcance (anotado, no construir):** búsqueda global ⌘K → PR 10 (la página `/admin/reservations` aún no existe). Las páginas Reservas / Transacciones C2P / Tasas BCV / Auditoría las crean PR 10–12, que cambian `ready: false` → `true` en `nav-config.ts`.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/admin/nav-config.ts` | Crear | Datos de navegación (grupos, ítems, iconos, `ready`, `ownerOnly`) + `visibleNavGroups`, `isActiveHref`, `breadcrumbFor` |
| `src/components/admin/nav-config.test.ts` | Crear | Filtro ready+rol, ruta activa, breadcrumb, contrato del roadmap §3.4 |
| `src/lib/admin-scope.ts` | Crear | Nombre/valor del header de ámbito admin y `documentLocale()` puro |
| `src/lib/admin-scope.test.ts` | Crear | `documentLocale` |
| `src/middleware.ts` | Modificar | Reenviar `x-pp-scope: admin` en toda petición `/admin/*` (también tras refrescar cookies) |
| `src/middleware.test.ts` | Crear | Header reenviado, cookies refrescadas, redirect intacto |
| `src/app/layout.tsx` | Modificar | `lang` (y metadata) = `es` cuando llega el header de ámbito admin |
| `e2e/admin-lang.spec.ts` | Crear | `pp_lang=en` → landing `en`, `/admin/login` `es` |
| `src/components/admin/use-sidebar-collapsed.ts` | Crear | Estado colapsado persistido en localStorage (try/catch, default expandido, sin mismatch de hidratación) |
| `src/components/admin/use-sidebar-collapsed.test.tsx` | Crear | Default, lectura, persistencia, storage bloqueado |
| `src/components/admin/ui-constants.ts` | Modificar | `ADMIN_NAV_ITEM` (fila de navegación de 44px) |
| `src/components/admin/admin-nav-links.tsx` | Crear | Lista de grupos/enlaces compartida por sidebar y drawer |
| `src/components/admin/admin-nav-links.test.tsx` | Crear | Grupos, `aria-current`, modo colapsado |
| `src/components/admin/profile-pill.tsx` | Crear | Email + badge de rol ("Dueño"/"Operador") + cerrar sesión |
| `src/components/admin/profile-pill.test.tsx` | Crear | Rol y logout |
| `src/components/admin/admin-drawer.tsx` | Crear | Hamburguesa 44px + drawer móvil (base-ui Dialog: focus trap, Escape, aria) |
| `src/components/admin/admin-drawer.test.tsx` | Crear | Abrir/cerrar, foco, Escape, navegación cierra |
| `src/components/admin/topbar-data.ts` | Crear | `ShellStatus` + `loadShellStatus()` (server-only; tasa en caché + conteo pendientes + hoy) |
| `src/components/admin/topbar-data.test.ts` | Crear | Mapeo, nulls y tolerancia a fallos |
| `src/components/admin/topbar.tsx` | Crear | `Topbar`, `Breadcrumb`, `BcvBadge`, `PendingBell` |
| `src/components/admin/topbar.test.tsx` | Crear | Breadcrumb, badge null, campana, fecha |
| `src/components/admin/admin-shell.tsx` | Reescribir | Composición: sidebar desktop colapsable + barra móvil + topbar |
| `src/components/admin/admin-shell.test.tsx` | Reescribir | Owner/operator, ítems no listos ocultos, colapso persistido |
| `src/app/admin/(dashboard)/layout.tsx` | Modificar | `requireAdmin()` + redirect en Unauthorized/Forbidden + `loadShellStatus()` |
| `src/app/admin/(dashboard)/layout.test.ts` | Crear | Props al shell, redirects, fail-closed |

---

### Task 0: Preparar el worktree

**Files:** ninguno.

- [ ] **Step 1: Instalar dependencias** (el worktree no tiene `node_modules`)

Run: `cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-shell && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci`
Expected: termina sin errores.

- [ ] **Step 2: Línea base de tests**

Run: `N20 && npm test`
Expected: PASS (todos los tests unitarios actuales en verde). Si algo falla aquí, detente y repórtalo: no es culpa de este PR.

---

### Task 1: `nav-config.ts` — datos de navegación y funciones puras

**Files:**
- Create: `src/components/admin/nav-config.ts`
- Test: `src/components/admin/nav-config.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/components/admin/nav-config.test.ts
import { describe, it, expect } from 'vitest';
import { House } from 'lucide-react';
import {
  NAV_GROUPS, visibleNavGroups, isActiveHref, breadcrumbFor, type NavGroup,
} from './nav-config';

const hrefs = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));

describe('NAV_GROUPS (roadmap §3.4 contract)', () => {
  it('declares every admin route in its group, with only Hoy and Configuración ready', () => {
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
        { href: '/admin/finance/transactions', label: 'Transacciones C2P', ownerOnly: false, ready: false },
        { href: '/admin/finance/bcv', label: 'Tasas BCV', ownerOnly: false, ready: false },
      ] },
      { label: 'Gestión', items: [
        { href: '/admin/settings', label: 'Configuración', ownerOnly: true, ready: true },
        { href: '/admin/audit', label: 'Auditoría', ownerOnly: true, ready: false },
      ] },
    ]);
  });
});

describe('visibleNavGroups', () => {
  it('shows an owner only the ready items and drops empty groups', () => {
    const groups = visibleNavGroups('owner');
    expect(groups.map((g) => g.label)).toEqual(['Operaciones', 'Gestión']);
    expect(hrefs(groups)).toEqual(['/admin', '/admin/settings']);
  });

  it('hides owner-only items from an operator', () => {
    const groups = visibleNavGroups('operator');
    expect(groups.map((g) => g.label)).toEqual(['Operaciones']);
    expect(hrefs(groups)).toEqual(['/admin']);
  });

  it('applies ready and role independently', () => {
    const fixture: NavGroup[] = [{
      label: 'G',
      items: [
        { href: '/a', label: 'A', icon: House, ready: true },
        { href: '/b', label: 'B', icon: House, ready: false },
        { href: '/c', label: 'C', icon: House, ready: true, ownerOnly: true },
        { href: '/d', label: 'D', icon: House, ready: false, ownerOnly: true },
      ],
    }];
    expect(hrefs(visibleNavGroups('owner', fixture))).toEqual(['/a', '/c']);
    expect(hrefs(visibleNavGroups('operator', fixture))).toEqual(['/a']);
  });
});

describe('isActiveHref', () => {
  it('matches /admin only exactly', () => {
    expect(isActiveHref('/admin', '/admin')).toBe(true);
    expect(isActiveHref('/admin', '/admin/settings')).toBe(false);
  });

  it('matches nested routes of other items, not lookalike prefixes', () => {
    expect(isActiveHref('/admin/settings', '/admin/settings')).toBe(true);
    expect(isActiveHref('/admin/settings', '/admin/settings/roles')).toBe(true);
    expect(isActiveHref('/admin/settings', '/admin/settingsx')).toBe(false);
  });
});

describe('breadcrumbFor', () => {
  it('names group and page for known routes', () => {
    expect(breadcrumbFor('/admin')).toEqual({ group: 'Operaciones', label: 'Hoy', href: '/admin' });
    expect(breadcrumbFor('/admin/settings')).toEqual({ group: 'Gestión', label: 'Configuración', href: '/admin/settings' });
  });

  it('prefers the most specific item for nested routes', () => {
    expect(breadcrumbFor('/admin/finance/bcv')).toEqual({ group: 'Finanzas', label: 'Tasas BCV', href: '/admin/finance/bcv' });
    expect(breadcrumbFor('/admin/reservations/abc')).toEqual({ group: 'Operaciones', label: 'Reservas', href: '/admin/reservations' });
  });

  it('returns null for routes outside the nav', () => {
    expect(breadcrumbFor('/admin/unknown')).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/nav-config.test.ts`
Expected: FAIL — `Failed to resolve import "./nav-config"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/components/admin/nav-config.ts
import {
  CalendarDays, ChartLine, House, ReceiptText, ScrollText, Settings, type LucideIcon,
} from 'lucide-react';
import type { AdminRole } from '@/lib/db/admin-roles';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only owners see it (settings, roles, audit log — roadmap §3.2). */
  ownerOnly?: boolean;
  /** False until the route exists. The PR that ships the page flips it to true. */
  ready: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_HOME = '/admin';

/** Admin navigation (roadmap §3.4). Only `ready` items render. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      { href: ADMIN_HOME, label: 'Hoy', icon: House, ready: true },
      { href: '/admin/reservations', label: 'Reservas', icon: CalendarDays, ready: false },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/admin/finance/transactions', label: 'Transacciones C2P', icon: ReceiptText, ready: false },
      { href: '/admin/finance/bcv', label: 'Tasas BCV', icon: ChartLine, ready: false },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/admin/settings', label: 'Configuración', icon: Settings, ownerOnly: true, ready: true },
      { href: '/admin/audit', label: 'Auditoría', icon: ScrollText, ownerOnly: true, ready: false },
    ],
  },
];

/** Groups with the items this role may see; groups left empty are dropped. */
export function visibleNavGroups(role: AdminRole, groups: NavGroup[] = NAV_GROUPS): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.ready && (!item.ownerOnly || role === 'owner')),
    }))
    .filter((group) => group.items.length > 0);
}

/** `/admin` is active only on itself; every other item also covers its nested routes. */
export function isActiveHref(href: string, pathname: string): boolean {
  if (href === ADMIN_HOME) return pathname === ADMIN_HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface Crumb {
  group: string;
  label: string;
  href: string;
}

/** Group + page for the topbar, from the most specific matching item (ready or not). */
export function breadcrumbFor(pathname: string, groups: NavGroup[] = NAV_GROUPS): Crumb | null {
  let best: Crumb | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (isActiveHref(item.href, pathname) && (!best || item.href.length > best.href.length)) {
        best = { group: group.label, label: item.label, href: item.href };
      }
    }
  }
  return best;
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/nav-config.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/nav-config.ts src/components/admin/nav-config.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add grouped nav config with ready and role filtering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `admin-scope.ts` — locale del documento según ámbito

**Files:**
- Create: `src/lib/admin-scope.ts`
- Test: `src/lib/admin-scope.test.ts`

**Por qué este enfoque:** el root layout no conoce el pathname. El middleware ya corre en todo `/admin/:path*`, así que es el lugar natural para marcar la petición; el layout lo lee con `headers()` (ya es dinámico porque lee `cookies()`, no cambia el modo de render). Alternativas descartadas: varios root layouts con route groups (mueve todo el árbol de rutas, invasivo y choca con PR 04–06) o fijar `document.documentElement.lang` desde el cliente (el HTML del servidor seguiría con `lang="en"`).

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/admin-scope.test.ts
import { describe, it, expect } from 'vitest';
import { ADMIN_SCOPE, ADMIN_SCOPE_HEADER, documentLocale } from './admin-scope';

describe('documentLocale', () => {
  it('forces Spanish in the admin scope whatever the cookie says', () => {
    expect(documentLocale('en', ADMIN_SCOPE)).toBe('es');
    expect(documentLocale('es', ADMIN_SCOPE)).toBe('es');
  });

  it('keeps the cookie locale everywhere else', () => {
    expect(documentLocale('en', null)).toBe('en');
    expect(documentLocale('es', null)).toBe('es');
    expect(documentLocale('en', 'something-else')).toBe('en');
  });

  it('uses a lowercase request header name', () => {
    expect(ADMIN_SCOPE_HEADER).toBe('x-pp-scope');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/lib/admin-scope.test.ts`
Expected: FAIL — `Failed to resolve import "./admin-scope"`.

- [ ] **Step 3: Implementación mínima**

```ts
// src/lib/admin-scope.ts
import type { Locale } from '@/lib/i18n/types';

/**
 * Request header the middleware sets on every /admin/* request so the root
 * layout (which cannot see the pathname) knows it is rendering the admin.
 */
export const ADMIN_SCOPE_HEADER = 'x-pp-scope';
export const ADMIN_SCOPE = 'admin';

/** The admin is Spanish-only: its documents are lang="es" whatever pp_lang says. */
export function documentLocale(cookieLocale: Locale, scope: string | null): Locale {
  return scope === ADMIN_SCOPE ? 'es' : cookieLocale;
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/lib/admin-scope.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-scope.ts src/lib/admin-scope.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add admin scope header and document locale helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Middleware reenvía el header de ámbito admin

**Files:**
- Modify: `src/middleware.ts` (función completa)
- Test: `src/middleware.test.ts`

Nota: `NextResponse.next({ request: { headers } })` codifica los headers reenviados en la respuesta como `x-middleware-request-<nombre>` (ver `node_modules/next/dist/server/web/spec-extension/response.js`); el test lo usa para verificar. `request.cookies.set()` escribe en `request.headers` (cookie `cookie`), por eso reconstruimos los headers después de `setAll` para no perder la sesión refrescada.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
let mockUser: { email: string } | null = null;
let rotateSession = false;

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (cookies: CookieToSet[]) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        if (rotateSession) opts.cookies.setAll([{ name: 'sb-token', value: 'fresh', options: { path: '/' } }]);
        return { data: { user: mockUser } };
      },
    },
  }),
}));

import { middleware } from './middleware';

process.env.ADMIN_EMAILS = 'boss@club.com';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';

const FORWARDED_SCOPE = 'x-middleware-request-x-pp-scope';

describe('middleware', () => {
  beforeEach(() => {
    mockUser = null;
    rotateSession = false;
  });

  it('marks /admin/login as admin scope for the root layout', async () => {
    const res = await middleware(new NextRequest('http://localhost/admin/login'));
    expect(res.status).toBe(200);
    expect(res.headers.get(FORWARDED_SCOPE)).toBe('admin');
  });

  it('overrides a scope header sent by the client', async () => {
    const req = new NextRequest('http://localhost/admin/login', { headers: { 'x-pp-scope': 'spoofed' } });
    const res = await middleware(req);
    expect(res.headers.get(FORWARDED_SCOPE)).toBe('admin');
  });

  it('keeps the scope and the refreshed session cookie when Supabase rotates it', async () => {
    mockUser = { email: 'boss@club.com' };
    rotateSession = true;
    const res = await middleware(new NextRequest('http://localhost/admin'));
    expect(res.headers.get(FORWARDED_SCOPE)).toBe('admin');
    expect(res.headers.get('x-middleware-request-cookie')).toContain('sb-token=fresh');
    expect(res.cookies.get('sb-token')?.value).toBe('fresh');
  });

  it('still redirects non-admins to the login with next', async () => {
    mockUser = { email: 'guest@example.com' };
    const res = await middleware(new NextRequest('http://localhost/admin/settings'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/admin/login?next=%2Fadmin%2Fsettings');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/middleware.test.ts`
Expected: FAIL — los 3 primeros tests fallan con `expected null to be 'admin'`; el de redirect pasa.

- [ ] **Step 3: Implementación**

Reemplaza la función `middleware` de `src/middleware.ts` (el `config` y los imports existentes se mantienen; se añade el import de `admin-scope`):

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/auth/admin';
import { ADMIN_SCOPE, ADMIN_SCOPE_HEADER } from '@/lib/admin-scope';

export async function middleware(request: NextRequest) {
  // Every matched request is /admin/*: tell the root layout so it renders
  // lang="es" regardless of pp_lang. Rebuilt after setAll so refreshed auth
  // cookies (written into request.headers) are forwarded too.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set(ADMIN_SCOPE_HEADER, ADMIN_SCOPE);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
  const isLogin = request.nextUrl.pathname === '/admin/login';

  // A session alone is not enough: pages that render customer PII require an
  // allowlisted admin email, mirroring the server-action requireAdmin gate.
  if (isAdminPath && !isLogin && !isAdminEmail(user?.email)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/admin/:path*'] };
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/middleware.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): forward admin scope header from middleware

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Root layout usa `lang="es"` en `/admin/*`

**Files:**
- Modify: `src/app/layout.tsx` (imports, `generateMetadata`, `RootLayout`)
- Test: `e2e/admin-lang.spec.ts`

- [ ] **Step 1: Escribir el test e2e que falla**

```ts
// e2e/admin-lang.spec.ts
import { test, expect } from '@playwright/test';

test('admin pages are lang="es" even when pp_lang is en', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'pp_lang', value: 'en', url: baseURL! }]);

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/admin/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-shell && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx playwright test e2e/admin-lang.spec.ts; rmdir "$L"
```
Expected: FAIL — `Expected: "es"  Received: "en"` en `/admin/login`.

- [ ] **Step 3: Implementación**

En `src/app/layout.tsx`:

1. Añade imports (junto a los existentes):
```tsx
import { headers } from "next/headers";
import { ADMIN_SCOPE_HEADER, documentLocale } from "@/lib/admin-scope";
```

2. Añade este helper justo antes de `generateMetadata`:
```tsx
/** pp_lang locale, except on /admin/* (marked by the middleware), which is Spanish-only. */
async function requestLocale() {
  const [locale, requestHeaders] = await Promise.all([getLocale(), headers()]);
  return documentLocale(locale, requestHeaders.get(ADMIN_SCOPE_HEADER));
}
```

3. En `generateMetadata`, cambia
```tsx
  const t = getDictionary(await getLocale());
```
por
```tsx
  const t = getDictionary(await requestLocale());
```

4. En `RootLayout`, cambia
```tsx
  const locale = await getLocale();
```
por
```tsx
  const locale = await requestLocale();
```

(`getLocale` sigue importado porque lo usa `requestLocale`.)

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: el mismo comando del Step 2.
Expected: PASS (1 test).

- [ ] **Step 5: Comprobar que el e2e de i18n sigue verde**

Run: igual que el Step 2 pero con `npx playwright test e2e/i18n.spec.ts`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx e2e/admin-lang.spec.ts
git commit -m "$(cat <<'EOF'
fix(admin): render admin pages with lang="es" regardless of pp_lang

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Hook `useSidebarCollapsed` (localStorage con try/catch)

**Files:**
- Create: `src/components/admin/use-sidebar-collapsed.ts`
- Test: `src/components/admin/use-sidebar-collapsed.test.tsx`

**Diseño:** `useSyncExternalStore` con snapshot de servidor `false` → el HTML del servidor y la hidratación salen expandidos (default) y el valor guardado se aplica justo después, sin mismatch y sin `setState` en un efecto (regla `react-hooks/set-state-in-effect` de eslint-config-next 16). Si localStorage lanza (modo privado, datos bloqueados) el toggle sigue funcionando en memoria durante la sesión.

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/use-sidebar-collapsed.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  SIDEBAR_COLLAPSED_KEY, resetSidebarCollapsedMemory, useSidebarCollapsed,
} from './use-sidebar-collapsed';

describe('useSidebarCollapsed', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSidebarCollapsedMemory();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to expanded', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it('reads the stored choice', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it('toggles and persists', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0');
  });

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/use-sidebar-collapsed.test.tsx`
Expected: FAIL — `Failed to resolve import "./use-sidebar-collapsed"`.

- [ ] **Step 3: Implementación**

```ts
// src/components/admin/use-sidebar-collapsed.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export const SIDEBAR_COLLAPSED_KEY = 'pp_admin_sidebar_collapsed';

const listeners = new Set<() => void>();
// Session fallback when localStorage is unavailable: the toggle still works,
// it just isn't remembered across reloads.
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function write(collapsed: boolean): void {
  memory = collapsed;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Not persisted; `memory` keeps the choice for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server render and hydration are expanded (the default); the stored choice applies right after. */
export function useSidebarCollapsed(): [collapsed: boolean, toggle: () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => write(!read()), []);
  return [collapsed, toggle];
}

/** Test helper: forget the in-memory fallback between tests. */
export function resetSidebarCollapsedMemory(): void {
  memory = null;
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/use-sidebar-collapsed.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/use-sidebar-collapsed.ts src/components/admin/use-sidebar-collapsed.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): persist sidebar collapsed state with safe storage access

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `AdminNavLinks` + constante `ADMIN_NAV_ITEM`

**Files:**
- Modify: `src/components/admin/ui-constants.ts` (añadir al final)
- Create: `src/components/admin/admin-nav-links.tsx`
- Test: `src/components/admin/admin-nav-links.test.tsx`

**Dirección visual:** sobre navy, el ítem activo se marca con una barra teal a la izquierda + fondo `white/10` + icono teal; inactivos `white/70`. Etiquetas de grupo en minúscula de oración y tono atenuado (sin mayúsculas sostenidas ni tracking). Transiciones solo de color y desactivadas con `motion-reduce`.

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/admin-nav-links.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminNavLinks } from './admin-nav-links';
import { visibleNavGroups } from './nav-config';

describe('AdminNavLinks', () => {
  it('renders group labels and marks the active route', () => {
    render(<AdminNavLinks groups={visibleNavGroups('owner')} pathname="/admin/settings" />);
    expect(screen.getByText('Operaciones')).toBeInTheDocument();
    expect(screen.getByText('Gestión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current');
  });

  it('keeps accessible names when collapsed but hides labels visually', () => {
    render(<AdminNavLinks groups={visibleNavGroups('owner')} pathname="/admin" collapsed />);
    const link = screen.getByRole('link', { name: 'Hoy' });
    expect(link).toHaveAttribute('title', 'Hoy');
    expect(screen.getByText('Hoy')).toHaveClass('sr-only');
    expect(screen.getByText('Operaciones')).toHaveClass('sr-only');
  });

  it('lays out every link as a 44px touch target', () => {
    render(<AdminNavLinks groups={visibleNavGroups('owner')} pathname="/admin" />);
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveClass('min-h-11');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/admin-nav-links.test.tsx`
Expected: FAIL — `Failed to resolve import "./admin-nav-links"`.

- [ ] **Step 3a: Añadir la constante** al final de `src/components/admin/ui-constants.ts`:

```ts

/** Sidebar / drawer navigation row: full-width 44px touch target. */
export const ADMIN_NAV_ITEM = 'min-h-11 px-3';
```

- [ ] **Step 3b: Crear el componente**

```tsx
// src/components/admin/admin-nav-links.tsx
'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { isActiveHref, type NavGroup } from './nav-config';
import { ADMIN_NAV_ITEM } from './ui-constants';

export function AdminNavLinks(props: {
  groups: NavGroup[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegación del panel" className="flex flex-col gap-5">
      {props.groups.map((group) => (
        <div key={group.label}>
          <p className={cn('mb-1 px-3 text-xs font-medium text-white/50', props.collapsed && 'sr-only')}>
            {group.label}
          </p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActiveHref(item.href, props.pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={props.onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={props.collapsed ? item.label : undefined}
                    className={cn(
                      ADMIN_NAV_ITEM,
                      'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors motion-reduce:transition-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                      props.collapsed && 'justify-center px-0',
                      active
                        ? 'bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-teal'
                        : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon aria-hidden className={cn('size-5 shrink-0', active && 'text-teal')} />
                    <span className={cn(props.collapsed && 'sr-only')}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/admin-nav-links.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ui-constants.ts src/components/admin/admin-nav-links.tsx src/components/admin/admin-nav-links.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add grouped nav links with active route highlight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `ProfilePill` — email, rol y cerrar sesión

**Files:**
- Create: `src/components/admin/profile-pill.tsx`
- Test: `src/components/admin/profile-pill.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/profile-pill.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut } }) }));

import { ProfilePill } from './profile-pill';

describe('ProfilePill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the email and "Dueño" for owners', () => {
    render(<ProfilePill email="dueno@club.com" role="owner" />);
    expect(screen.getByText('dueno@club.com')).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
  });

  it('shows "Operador" for operators', () => {
    render(<ProfilePill email="op@club.com" role="operator" />);
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  it('signs out and goes to the login', async () => {
    render(<ProfilePill email="op@club.com" role="operator" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/admin/login');
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps email and role readable by screen readers when collapsed', () => {
    render(<ProfilePill email="op@club.com" role="operator" collapsed />);
    expect(screen.getByText('op@club.com').closest('div')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveClass('size-11');
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/profile-pill.test.tsx`
Expected: FAIL — `Failed to resolve import "./profile-pill"`.

- [ ] **Step 3: Implementación**

```tsx
// src/components/admin/profile-pill.tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { browserClient } from '@/lib/db/browser-client';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION } from './ui-constants';

export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Dueño', operator: 'Operador' };

export function ProfilePill(props: { email: string; role: AdminRole; collapsed?: boolean }) {
  const router = useRouter();
  const initial = props.email.charAt(0).toUpperCase() || 'A';

  async function logout() {
    await browserClient().auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10',
        props.collapsed && 'flex-col',
      )}
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-teal font-heading text-base font-semibold text-navy"
      >
        {initial}
      </span>
      <div className={cn('min-w-0 flex-1', props.collapsed && 'sr-only')}>
        <p className="truncate text-sm text-white" title={props.email}>{props.email}</p>
        <span
          className={cn(
            'mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
            props.role === 'owner' ? 'bg-teal text-navy' : 'bg-white/15 text-white',
          )}
        >
          {ROLE_LABEL[props.role]}
        </span>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className={cn(
          ADMIN_ICON_ACTION,
          'grid shrink-0 cursor-pointer place-items-center rounded-xl text-white/70 transition-colors motion-reduce:transition-none',
          'hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal',
        )}
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/profile-pill.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/profile-pill.tsx src/components/admin/profile-pill.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add profile pill with role badge and logout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `AdminDrawer` — hamburguesa 44px + drawer móvil

**Files:**
- Create: `src/components/admin/admin-drawer.tsx`
- Test: `src/components/admin/admin-drawer.test.tsx`

**Diseño:** se construye sobre `@base-ui/react/dialog` (el mismo primitivo que `src/components/ui/dialog.tsx`): modal por defecto → focus trap, Escape cierra, foco vuelve al disparador, el `Trigger` pone `aria-haspopup="dialog"`, `aria-expanded` y `aria-controls`; `Dialog.Title` da el nombre accesible. Se desliza desde la izquierda con `data-[starting-style]`/`data-[ending-style]` y `motion-reduce:transition-none`.

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/admin-drawer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut: vi.fn() } }) }));
// Plain anchor so clicking a link does not need the App Router context.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { AdminDrawer } from './admin-drawer';
import { visibleNavGroups } from './nav-config';

function renderDrawer() {
  render(
    <AdminDrawer groups={visibleNavGroups('owner')} pathname="/admin" email="dueno@club.com" role="owner" />,
  );
  return screen.getByRole('button', { name: 'Abrir menú' });
}

describe('AdminDrawer', () => {
  it('has a 44px trigger announcing a closed dialog', () => {
    const trigger = renderDrawer();
    expect(trigger).toHaveClass('size-11');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a named dialog with nav and profile, and moves focus inside', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Menú de administración' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes with the close button', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes after choosing a destination', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('link', { name: 'Configuración' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/admin-drawer.test.tsx`
Expected: FAIL — `Failed to resolve import "./admin-drawer"`.

- [ ] **Step 3: Implementación**

```tsx
// src/components/admin/admin-drawer.tsx
'use client';

import { useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { AdminNavLinks } from './admin-nav-links';
import type { NavGroup } from './nav-config';
import { ProfilePill } from './profile-pill';
import { ADMIN_ICON_ACTION } from './ui-constants';

const ICON_BUTTON = cn(
  ADMIN_ICON_ACTION,
  'grid cursor-pointer place-items-center rounded-xl text-white transition-colors motion-reduce:transition-none',
  'hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-teal',
);

/** Mobile navigation: a modal drawer (focus trap, Escape, focus return via base-ui Dialog). */
export function AdminDrawer(props: { groups: NavGroup[]; pathname: string; email: string; role: AdminRole }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger aria-label="Abrir menú" className={ICON_BUTTON}>
        <Menu aria-hidden className="size-6" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-navy-deep/60 transition-opacity duration-200 motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-navy p-4 shadow-xl',
            'transition-transform duration-200 motion-reduce:transition-none',
            'data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menú de administración</DialogPrimitive.Title>
          <div className="flex items-center justify-between">
            <Logo variant="chip" className="h-8 w-auto" sizes="96px" />
            <DialogPrimitive.Close aria-label="Cerrar menú" className={ICON_BUTTON}>
              <X aria-hidden className="size-6" />
            </DialogPrimitive.Close>
          </div>
          <AdminNavLinks groups={props.groups} pathname={props.pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-auto">
            <ProfilePill email={props.email} role={props.role} />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/admin-drawer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-drawer.tsx src/components/admin/admin-drawer.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add accessible mobile nav drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `topbar-data.ts` — estado del shell (server-only)

**Files:**
- Create: `src/components/admin/topbar-data.ts`
- Test: `src/components/admin/topbar-data.test.ts`

**Reglas:** la tasa sale SOLO de la caché en `settings` (`last_bcv_rate`, `last_bcv_rate_at`), nunca de `getBcvRate`/`fetchBcvRate`. El conteo usa `searchReservations` con `statuses: ['pending_payment']` (su `total` es el `count: 'exact'`). Un fallo de cualquiera de las dos lecturas no debe tumbar el panel: se registra con `console.error` y ese dato queda en `null` (la UI no inventa valores).

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/components/admin/topbar-data.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/reservations', () => ({
  getSettings: vi.fn(),
  searchReservations: vi.fn(),
}));
vi.mock('@/lib/dates', () => ({ todayCaracas: () => '2026-10-04' }));

import { loadShellStatus } from './topbar-data';
import { getSettings, searchReservations } from '@/lib/db/reservations';

const settings = (rate: number | string | null, at: string | null) => ({
  daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1,
  last_bcv_rate: rate as number | null, last_bcv_rate_at: at,
});

describe('loadShellStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getSettings).mockResolvedValue(settings(36.4512, '2026-10-04T13:00:00Z'));
    vi.mocked(searchReservations).mockResolvedValue({ rows: [], total: 3 });
  });

  it('returns the cached rate, the pending count and today in Caracas', async () => {
    await expect(loadShellStatus()).resolves.toEqual({
      bcv: { rate: 36.4512, at: '2026-10-04T13:00:00Z' },
      pendingCount: 3,
      today: '2026-10-04',
    });
    expect(searchReservations).toHaveBeenCalledWith({ statuses: ['pending_payment'], page: 1, pageSize: 10 });
  });

  it('coerces a numeric string rate from PostgREST', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings('36.4512', null));
    expect((await loadShellStatus()).bcv).toEqual({ rate: 36.4512, at: null });
  });

  it('reports no rate when the cache is empty', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings(null, null));
    expect((await loadShellStatus()).bcv).toBeNull();
  });

  it('degrades each value independently when a read fails', async () => {
    vi.mocked(getSettings).mockRejectedValue(new Error('db down'));
    const a = await loadShellStatus();
    expect(a.bcv).toBeNull();
    expect(a.pendingCount).toBe(3);

    vi.mocked(getSettings).mockResolvedValue(settings(36, null));
    vi.mocked(searchReservations).mockRejectedValue(new Error('db down'));
    const b = await loadShellStatus();
    expect(b.bcv).toEqual({ rate: 36, at: null });
    expect(b.pendingCount).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/topbar-data.test.ts`
Expected: FAIL — `Failed to resolve import "./topbar-data"`.

- [ ] **Step 3: Implementación**

```ts
// src/components/admin/topbar-data.ts
import 'server-only';
import { getSettings, searchReservations } from '@/lib/db/reservations';
import { todayCaracas } from '@/lib/dates';

export interface ShellStatus {
  /** Last cached BCV rate from settings (never fetched here); null when there is none. */
  bcv: { rate: number; at: string | null } | null;
  /** pending_payment reservations; null when the count could not be loaded. */
  pendingCount: number | null;
  /** Today in America/Caracas (YYYY-MM-DD). */
  today: string;
}

/** Topbar data for the admin shell. Each read degrades to null on its own instead of failing the page. */
export async function loadShellStatus(): Promise<ShellStatus> {
  const [settings, pending] = await Promise.allSettled([
    getSettings(),
    searchReservations({ statuses: ['pending_payment'], page: 1, pageSize: 10 }),
  ]);
  if (settings.status === 'rejected') console.error('admin shell: settings unavailable', settings.reason);
  if (pending.status === 'rejected') console.error('admin shell: pending count unavailable', pending.reason);

  const s = settings.status === 'fulfilled' ? settings.value : null;
  return {
    bcv: s && s.last_bcv_rate != null
      ? { rate: Number(s.last_bcv_rate), at: s.last_bcv_rate_at }
      : null,
    pendingCount: pending.status === 'fulfilled' ? pending.value.total : null,
    today: todayCaracas(),
  };
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/topbar-data.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/topbar-data.ts src/components/admin/topbar-data.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): load cached BCV rate and pending count for the shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `Topbar` — breadcrumb, badge BCV, campana, fecha

**Files:**
- Create: `src/components/admin/topbar.tsx`
- Test: `src/components/admin/topbar.test.tsx`

Notas: `import type { ShellStatus } from './topbar-data'` es solo de tipo y se borra al compilar, así que no arrastra `server-only` al bundle de cliente. La campana enlaza a `/admin` (`PENDING_HREF`) hasta que PR 10 cree `/admin/reservations`; PR 10 debe cambiar esa constante a `/admin/reservations?status=pending_payment` (roadmap §2).

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/admin/topbar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let pathname = '/admin/settings';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { BcvBadge, Breadcrumb, PendingBell, Topbar } from './topbar';

describe('Breadcrumb', () => {
  it('shows group and current page from the nav config', () => {
    render(<Breadcrumb pathname="/admin/settings" />);
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toBeInTheDocument();
    expect(screen.getByText('Gestión')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to "Panel" outside the nav', () => {
    render(<Breadcrumb pathname="/admin/unknown" />);
    expect(screen.getByText('Panel')).toHaveAttribute('aria-current', 'page');
  });
});

describe('BcvBadge', () => {
  it('shows the cached rate with two decimals', () => {
    render(<BcvBadge bcv={{ rate: 36.4512, at: '2026-10-04T13:00:00Z' }} />);
    expect(screen.getByText('BCV · Bs. 36.45')).toBeInTheDocument();
  });

  it('says "sin tasa" when there is no cached rate', () => {
    render(<BcvBadge bcv={null} />);
    expect(screen.getByText('BCV · sin tasa')).toBeInTheDocument();
  });
});

describe('PendingBell', () => {
  it('links to the admin home with the pending count', () => {
    render(<PendingBell count={3} />);
    const bell = screen.getByRole('link', { name: '3 pagos pendientes por verificar' });
    expect(bell).toHaveAttribute('href', '/admin');
    expect(bell).toHaveClass('size-11');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('uses the singular for one payment', () => {
    render(<PendingBell count={1} />);
    expect(screen.getByRole('link', { name: '1 pago pendiente por verificar' })).toBeInTheDocument();
  });

  it('shows no counter at zero and caps it at 99+', () => {
    const { rerender } = render(<PendingBell count={0} />);
    expect(screen.getByRole('link', { name: '0 pagos pendientes por verificar' })).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
    rerender(<PendingBell count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not invent a number when the count failed to load', () => {
    render(<PendingBell count={null} />);
    expect(screen.getByRole('link', { name: 'Pagos pendientes' })).toBeInTheDocument();
  });
});

describe('Topbar', () => {
  it('combines breadcrumb, Caracas date, BCV badge and bell for the current path', () => {
    pathname = '/admin';
    render(<Topbar status={{ bcv: null, pendingCount: 2, today: '2026-10-04' }} />);
    expect(screen.getByText('Hoy')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/4 de octubre/)).toHaveAttribute('dateTime', '2026-10-04');
    expect(screen.getByText('BCV · sin tasa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 pagos pendientes por verificar' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/topbar.test.tsx`
Expected: FAIL — `Failed to resolve import "./topbar"`.

- [ ] **Step 3: Implementación**

```tsx
// src/components/admin/topbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight } from 'lucide-react';
import { longDateEs } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { breadcrumbFor } from './nav-config';
import type { ShellStatus } from './topbar-data';
import { ADMIN_ICON_ACTION } from './ui-constants';

/** Pending payments are reviewed from "Hoy" until PR 10 ships /admin/reservations. */
export const PENDING_HREF = '/admin';

export function Breadcrumb(props: { pathname: string }) {
  const crumb = breadcrumbFor(props.pathname);
  return (
    <nav aria-label="Ruta" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumb && (
          <li className="hidden items-center gap-1 text-muted-foreground sm:flex">
            {crumb.group}
            <ChevronRight aria-hidden className="size-4" />
          </li>
        )}
        <li aria-current="page" className="truncate font-heading text-base font-semibold text-navy">
          {crumb?.label ?? 'Panel'}
        </li>
      </ol>
    </nav>
  );
}

function updatedAt(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Cached BCV rate only; this component never triggers a fetch. */
export function BcvBadge(props: { bcv: ShellStatus['bcv'] }) {
  const base = 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium';
  if (!props.bcv) {
    return <span className={cn(base, 'bg-slate-100 text-slate-600')}>BCV · sin tasa</span>;
  }
  const title = props.bcv.at ? `Tasa en caché, actualizada ${updatedAt(props.bcv.at)}` : 'Tasa en caché';
  return (
    <span title={title} className={cn(base, 'bg-mint text-navy')}>
      <span aria-hidden className="size-2 rounded-full bg-teal" />
      {`BCV · Bs. ${props.bcv.rate.toFixed(2)}`}
    </span>
  );
}

export function PendingBell(props: { count: number | null }) {
  const n = props.count ?? 0;
  const label =
    props.count === null ? 'Pagos pendientes'
      : n === 1 ? '1 pago pendiente por verificar'
        : `${n} pagos pendientes por verificar`;
  return (
    <Link
      href={PENDING_HREF}
      aria-label={label}
      title={label}
      className={cn(
        ADMIN_ICON_ACTION,
        'relative grid shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-navy transition-colors motion-reduce:transition-none',
        'hover:bg-mint focus-visible:outline-2 focus-visible:outline-teal',
      )}
    >
      <Bell aria-hidden className="size-5" />
      {n > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs font-semibold text-white"
        >
          {n > 99 ? '99+' : n}
        </span>
      )}
    </Link>
  );
}

export function Topbar(props: { status: ShellStatus }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
      <Breadcrumb pathname={pathname} />
      <div className="flex shrink-0 items-center gap-2">
        <time dateTime={props.status.today} className="hidden text-sm capitalize text-muted-foreground lg:block">
          {longDateEs(props.status.today)}
        </time>
        <BcvBadge bcv={props.status.bcv} />
        <PendingBell count={props.status.pendingCount} />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/topbar.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/topbar.tsx src/components/admin/topbar.test.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add topbar with breadcrumb, BCV badge, pending bell and date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `AdminShell` — composición final

**Files:**
- Modify (reescritura completa): `src/components/admin/admin-shell.tsx`
- Modify (reescritura completa): `src/components/admin/admin-shell.test.tsx`

La prop `topbar` se elimina (ningún llamador la usa; el breadcrumb la reemplaza) y `email` pasa a `user: { email, role }` + `status`.

- [ ] **Step 1: Reescribir el test (falla con el shell actual)**

```tsx
// src/components/admin/admin-shell.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut: vi.fn() } }) }));

import { AdminShell } from './admin-shell';
import { SIDEBAR_COLLAPSED_KEY, resetSidebarCollapsedMemory } from './use-sidebar-collapsed';
import type { ShellStatus } from './topbar-data';

const status: ShellStatus = { bcv: { rate: 36.45, at: '2026-10-04T13:00:00Z' }, pendingCount: 2, today: '2026-10-04' };

function renderShell(role: 'owner' | 'operator' = 'owner') {
  return render(
    <AdminShell user={{ email: `${role}@club.com`, role }} status={status}>
      <p>contenido</p>
    </AdminShell>,
  );
}

describe('AdminShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSidebarCollapsedMemory();
  });

  it('renders brand, owner nav, profile, topbar and content', () => {
    renderShell('owner');
    expect(screen.getAllByAltText('Complejo Turístico Villa Victoria').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByText('owner@club.com')).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
    expect(screen.getByText('BCV · Bs. 36.45')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 pagos pendientes por verificar' })).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('hides owner-only items from operators', () => {
    renderShell('operator');
    expect(screen.queryByRole('link', { name: 'Configuración' })).toBeNull();
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  it('does not render routes that are not ready yet', () => {
    renderShell('owner');
    for (const name of ['Reservas', 'Transacciones C2P', 'Tasas BCV', 'Auditoría']) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
  });

  it('has a 44px mobile menu button', () => {
    renderShell('owner');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveClass('size-11');
  });

  it('collapses the sidebar and remembers it', async () => {
    renderShell('owner');
    await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('title', 'Hoy');
  });

  it('starts collapsed when that was the stored choice', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    renderShell('owner');
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run src/components/admin/admin-shell.test.tsx`
Expected: FAIL — p. ej. `Unable to find an accessible element with the role "link" and name "Hoy"` con `aria-current`, `Unable to find ... "Dueño"`, `"Contraer menú"`.

- [ ] **Step 3: Reescribir el shell**

```tsx
// src/components/admin/admin-shell.tsx
'use client';

import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { AdminDrawer } from './admin-drawer';
import { AdminNavLinks } from './admin-nav-links';
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

// ⌘K global search is deferred to PR 10 (needs /admin/reservations).
export function AdminShell(props: { user: AdminUser; status: ShellStatus; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
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
        <div id="admin-sidebar-nav" className="min-h-0 flex-1 overflow-y-auto">
          <AdminNavLinks groups={groups} pathname={pathname} collapsed={collapsed} />
        </div>
        <ProfilePill email={props.user.email} role={props.user.role} collapsed={collapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-navy px-3 py-2 md:hidden">
        <Logo variant="chip" className="h-7 w-auto" sizes="96px" />
        <AdminDrawer groups={groups} pathname={pathname} email={props.user.email} role={props.user.role} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar status={props.status} />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run src/components/admin/admin-shell.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck (el layout aún usa la prop `email` antigua)**

Run: `N20 && npx tsc --noEmit`
Expected: FAIL solo en `src/app/admin/(dashboard)/layout.tsx` (`Property 'user' is missing` / `'email' does not exist`). Se arregla en la Task 12; no hagas commit de un árbol roto: continúa directamente con la Task 12 y commitea ambas juntas.

---

### Task 12: Layout `(dashboard)` con `requireAdmin()` y estado del shell

**Files:**
- Modify (reescritura completa): `src/app/admin/(dashboard)/layout.tsx`
- Test: `src/app/admin/(dashboard)/layout.test.ts`

**Gate:** el middleware ya redirige a `/admin/login?next=…` a quien no está en `ADMIN_EMAILS`; el layout es la segunda barrera en servidor (y la fuente del rol). `requireAdmin()` sin opciones solo lanza `Unauthorized` (o `Forbidden` si alguien le pasa `role`) → `redirect('/admin/login')`. Cualquier otro error (p. ej. falla la lectura de `admin_roles`) se relanza: fail closed. `redirect()` se llama fuera del `try/catch` (docs de Next 16).

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/app/admin/(dashboard)/layout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/components/admin/topbar-data', () => ({ loadShellStatus: vi.fn() }));
vi.mock('@/components/admin/admin-shell', () => ({ AdminShell: () => null }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

import AdminDashboardLayout from './layout';
import { requireAdmin } from '@/lib/auth/require-admin';
import { loadShellStatus } from '@/components/admin/topbar-data';
import { AdminShell } from '@/components/admin/admin-shell';
import { redirect } from 'next/navigation';

const status = { bcv: null, pendingCount: 0, today: '2026-10-04' };

describe('AdminDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadShellStatus).mockResolvedValue(status);
  });

  it('passes {email, role} from requireAdmin and the shell status', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ email: 'op@club.com', role: 'operator' });
    const el = await AdminDashboardLayout({ children: 'x' });
    expect(el.type).toBe(AdminShell);
    expect(el.props).toMatchObject({ user: { email: 'op@club.com', role: 'operator' }, status, children: 'x' });
  });

  it.each(['Unauthorized', 'Forbidden'])('redirects to the login on %s', async (message) => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error(message));
    await expect(AdminDashboardLayout({ children: 'x' })).rejects.toThrow('REDIRECT:/admin/login');
    expect(loadShellStatus).not.toHaveBeenCalled();
  });

  it('fails closed on any other error', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('role lookup failed'));
    await expect(AdminDashboardLayout({ children: 'x' })).rejects.toThrow('role lookup failed');
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `N20 && npx vitest run "src/app/admin/(dashboard)/layout.test.ts"`
Expected: FAIL — el layout actual importa `ssrClient` (sin mock, falla al crear el cliente o no llama `requireAdmin`); `el.props.user` indefinido y los tests de redirect no lanzan `REDIRECT:/admin/login`.

- [ ] **Step 3: Implementación**

```tsx
// src/app/admin/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { loadShellStatus } from '@/components/admin/topbar-data';

function isAuthError(e: unknown): boolean {
  return e instanceof Error && (e.message === 'Unauthorized' || e.message === 'Forbidden');
}

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects non-allowlisted users; this is the server-side
  // gate and the source of the role the shell shows. Other errors (e.g. the
  // role lookup failing) are rethrown: fail closed.
  const user = await requireAdmin().catch((e: unknown) => {
    if (isAuthError(e)) return null;
    throw e;
  });
  if (!user) redirect('/admin/login');

  const status = await loadShellStatus();
  return <AdminShell user={user} status={status}>{children}</AdminShell>;
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `N20 && npx vitest run "src/app/admin/(dashboard)/layout.test.ts" src/components/admin/admin-shell.test.tsx`
Expected: PASS (4 + 6 tests).

- [ ] **Step 5: Typecheck**

Run: `N20 && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit (Task 11 + 12 juntas)**

```bash
git add src/components/admin/admin-shell.tsx src/components/admin/admin-shell.test.tsx "src/app/admin/(dashboard)/layout.tsx" "src/app/admin/(dashboard)/layout.test.ts"
git commit -m "$(cat <<'EOF'
feat(admin): grouped collapsible shell with role-aware profile and topbar

The dashboard layout now gates with requireAdmin(), redirects to the
login on Unauthorized/Forbidden, and feeds the shell the cached BCV rate
and the pending_payment count. Global ⌘K search is deferred to PR 10.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Verificación final

**Files:** ninguno (solo correcciones si algo falla).

- [ ] **Step 1: Typecheck**

Run: `N20 && npx tsc --noEmit`
Expected: sin salida, exit 0.

- [ ] **Step 2: Lint**

Run: `N20 && npm run lint`
Expected: 0 errores. Si `react-hooks/*` se queja de algo, corrígelo en el archivo señalado (no desactives la regla).

- [ ] **Step 3: Tests unitarios**

Run: `N20 && npm test`
Expected: PASS, incluidos los 11 archivos de test nuevos/reescritos de este PR.

- [ ] **Step 4: Build**

Run: `N20 && npm run build`
Expected: build OK; `/admin` y `/admin/settings` aparecen como rutas dinámicas (ƒ). Ningún error de "server-only imported from client component" (si aparece, revisa que `topbar.tsx` y `admin-shell.tsx` importen `ShellStatus` con `import type`).

- [ ] **Step 5: E2E completo** (el root layout afecta a landing y `/reservar`)

Run:
```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/admin-shell && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:e2e; rmdir "$L"
```
Expected: PASS (`booking`, `i18n`, `landing`, `admin-lang`).

- [ ] **Step 6: Revisión manual rápida** (opcional si hay credenciales admin locales): `npm run dev`, entrar a `/admin` con un admin; comprobar en 1280px (sidebar, colapsar, recargar → sigue colapsado) y en 390px (barra navy, hamburguesa, Tab no sale del drawer, Escape cierra), y que el `<html>` tiene `lang="es"` con `pp_lang=en`.

- [ ] **Step 7: Estado limpio**

Run: `git status --short`
Expected: vacío (todo commiteado). No hacer push ni abrir PR.

---

## Desviaciones y preguntas abiertas

1. **Archivos nuevos fuera de la tabla de propiedad:** `admin-nav-links.tsx`, `profile-pill.tsx`, `admin-drawer.tsx`, `use-sidebar-collapsed.ts` (+tests), `src/lib/admin-scope.ts` (+test), `src/middleware.test.ts`, `src/app/admin/(dashboard)/layout.test.ts` y `e2e/admin-lang.spec.ts`. Son archivos nuevos que ningún otro PR de la ola 2 toca, así que no generan conflictos; se separaron para que `admin-shell.tsx` no crezca demasiado.
2. **Destino de la campana:** el roadmap §2 dice `/admin/reservations?status=pending_payment`, pero esa página la crea PR 10. Por ahora enlaza a `/admin` mediante `PENDING_HREF` en `topbar.tsx`; PR 10 debe cambiar esa constante.
3. **"Pendientes vigentes":** `searchReservations({ statuses: ['pending_payment'] })` cuenta también los `pending_payment` cuyo `expires_at` ya pasó si nadie los ha pasado a `expired`. ¿Basta así o hace falta un filtro por `expires_at` (cambio de backend, fuera de este PR)?
4. **Colores de estado "en `ui-constants.ts`" (roadmap §3.4):** ya están centralizados en `STATUS_CHIP_CLASS` (`src/lib/reservation-status.ts`). No se mueven aquí para no tocar consumidores; PR 09/10 puede decidir si los traslada.
5. **`middleware.ts` → `proxy.ts`:** Next 16 depreca el nombre `middleware`. No se renombra en este PR (no hace falta y cambiaría un archivo sensible a la seguridad); se puede hacer luego con `npx @next/codemod@canary middleware-to-proxy .`.
6. **`lang` en navegación del lado del cliente:** el root layout no se vuelve a renderizar en una navegación suave. Hoy no hay enlaces entre landing y admin, así que toda entrada a `/admin` es una carga completa y el header lo cubre. Si algún día se enlazan, habría que añadir un ajuste en el cliente.
7. **Redirect del layout:** cuando el layout redirige (sesión caída entre el middleware y el render), va a `/admin/login` sin `?next=` porque el layout no conoce el pathname. El middleware, que es el camino habitual, sí conserva `next`.
8. **⌘K:** diferido a PR 10, como se pidió. Solo queda un comentario en `admin-shell.tsx`.
