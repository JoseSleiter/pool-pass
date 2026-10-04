# UX Overhaul — Roadmap maestro (landing + admin + backend)

> **For agentic workers:** este documento NO es un plan ejecutable. Es el índice y la fuente de verdad de decisiones y contratos compartidos. Cada PR tiene su propio plan detallado (`2026-10-04-prNN-*.md`) que se ejecuta con superpowers:subagent-driven-development o superpowers:executing-plans. Si un plan detallado contradice este documento, gana este documento.

**Goal:** Implementar las mejoras de UX/UI pedidas en `docs/gemini-code-1791108647206.md` (landing + admin) y `docs/gemini-code-1791108651772.md` (admin enterprise), más el backend que necesitan, en PRs pequeños e incrementales, cada uno en su propio worktree.

**Fuentes:** los dos `.md` de Gemini + `docs/resumen-tecnico.md` (mapa actual de la app).

---

## 1. Decisiones tomadas (con el dueño del proyecto)

| Tema | Decisión |
|---|---|
| Rama base | `develop` (la más actualizada; `main` va atrasada). Cada PR apunta a `develop`. |
| Backend | Entra ahora: audit log, historial BCV, roles de admin, búsqueda paginada server-side. |
| Idioma | Admin: solo español. Landing + `/reservar`: español por defecto, con selector a inglés. El email del voucher queda en español (fuera de alcance). |
| Assignee | `JoseSleiter` en todos los PRs. |
| Reviewer | GitHub no permite pedir review al autor del PR. No se asigna reviewer (el dueño revisa como assignee). |
| Worktrees | Uno por PR en `.worktrees/<rama>` (ver §5). |

## 2. Conflictos entre los dos `.md` y cómo se resuelven

| Conflicto | Resolución |
|---|---|
| Botón de check-in: "REGISTRAR ENTRADA" vs "Aprobar Ingreso" | **"Registrar entrada"** en la pantalla QR (`/admin/checkin/[id]`), **"Aprobar check-in"** en el diálogo del dashboard (ya es así hoy). |
| Textos en inglés en el `.md` admin ("Showing 1–10 of 142", "Verify", "Resend Voucher") | Todo en español: "Mostrando 1–10 de 142 reservas", "Verificar", "Reenviar voucher". |
| Estados de filtro distintos (`Todas/Confirmadas/Ingresaron/Pendientes/Canceladas` vs `confirmed/pending_payment/checked_in/expired`) | Se usan los 5 estados reales de la BD. Chips: Todas · Confirmadas · Ingresaron · Pendientes · Canceladas (= `failed` + `expired`). |
| Filtro "Currency Paid" | **Descartado.** Todo pago es C2P en VES con precio en USD; no hay otra moneda que filtrar. |
| Filtro "Guest Type (Family vs Individual)" | Derivado, sin columna nueva: `individual` = 1 persona en total; `family` = 2 o más personas. |
| Colores de ocupación | Rangos del `.md` admin: 0–70 % teal `#0bc4c7`, 71–90 % ámbar, 91–100 % coral `#ff7657`. |
| "🔥 24 tickets booked this weekend" | **Solo con datos reales**: suma de personas `confirmed`+`checked_in` del próximo fin de semana (sáb+dom, hora Caracas). Se oculta si la suma es < 10. Nunca un número fijo. |
| Badge "Procesamiento Seguro AES-256" | Permitido: los campos sensibles C2P sí van cifrados con AES-256 (`src/lib/mercantil/encrypt.ts`, AES-256-CBC). Texto: "Datos de pago cifrados (AES-256)". |
| Badge "Pago Móvil C2P Directo Banco Mercantil" | Permitido (es el procesador real). |
| Logos de bancos en el selector | Sin imágenes de marcas de terceros. Se usa chip con el código del banco (ej. `0105`) + nombre. |
| Hover en fecha mostrando cupos | Se usa `availability` que ya devuelve `getAvailability(month)`; el calendario muestra "Quedan N" en cada día (no solo en hover, para móvil). |
| Notificaciones (campana) | Sin tabla nueva: la campana muestra el conteo de `pending_payment` vigentes y enlaza a `/admin/reservations?status=pending_payment`. |
| ⌘K búsqueda global | Abre un diálogo de búsqueda que navega a `/admin/reservations?q=...`. |

## 3. Contratos compartidos (no cambiar sin actualizar este doc)

### 3.1 Migraciones (PR 01)
- `0005_audit_log.sql` — tabla `audit_log(id bigserial pk, at timestamptz default now(), actor_email text not null, action text not null, target text, details jsonb default '{}')`. RLS activado, sin políticas (igual que el resto, ver 0003).
- `0006_bcv_rate_history.sql` — tabla `bcv_rate_history(id bigserial pk, fetched_at timestamptz not null, rate numeric(14,4) not null, source text)`. Se inserta una fila cada vez que se trae una tasa nueva (no en cada lectura de caché).
- `0007_admin_roles.sql` — tabla `admin_roles(email text pk, role text not null check (role in ('owner','operator')))`. El gate sigue siendo `ADMIN_EMAILS`; el rol se busca en esta tabla. **Un email permitido sin fila = `owner`** (así no se rompe el acceso actual).

### 3.2 Tipos y funciones (TypeScript)
```ts
// src/lib/audit.ts (PR 01)
export type AuditAction =
  | 'reservation.check_in' | 'reservation.resend_voucher'
  | 'settings.update' | 'override.upsert' | 'override.delete'
  | 'role.upsert' | 'bcv.refresh';
export async function logAudit(e: { actor: string; action: AuditAction; target?: string; details?: Record<string, unknown> }): Promise<void>; // nunca lanza error: si falla, console.error
export async function listAudit(p: { page: number; pageSize: number }): Promise<{ rows: AuditRow[]; total: number }>;

// src/lib/auth/require-admin.ts (PR 01) — cambia la firma:
export type AdminRole = 'owner' | 'operator';
export async function requireAdmin(opts?: { role?: 'owner' }): Promise<{ email: string; role: AdminRole }>;
// role 'owner' requerido para: settings, overrides, roles, ver audit log.

// src/lib/db/reservations.ts (PR 02)
export interface ReservationQuery {
  dateFrom?: string; dateTo?: string;           // YYYY-MM-DD, inclusive
  statuses?: ReservationRow['status'][];
  q?: string;                                    // nombre, apellido, código PP-XXXX o número de documento
  guestType?: 'individual' | 'family';
  sort?: { by: 'date' | 'code' | 'name' | 'guests' | 'total_usd' | 'status'; dir: 'asc' | 'desc' };
  page: number;                                  // 1-based
  pageSize: 10 | 25 | 50;
}
export async function searchReservations(q: ReservationQuery): Promise<{ rows: ReservationRow[]; total: number }>;

// src/app/admin/actions.ts (PR 02)
export async function adminSearchReservations(raw: unknown): Promise<{ rows: ReservationRow[]; total: number }>;
// DaySummary gana: checkinsByHour: { hour: number; people: number }[]  (hora Caracas, 0–23)

// src/app/actions/booking.ts (PR 02)
export async function getWeekendBookedPeople(): Promise<number | null>; // null si < 10

// src/lib/bcv-history (PR 01)
export async function listBcvHistory(p: { page: number; pageSize: number }): Promise<{ rows: BcvHistoryRow[]; total: number }>;
```

### 3.3 i18n (PR 03)
- Sin librería. `src/lib/i18n/{types.ts, es.ts, en.ts, index.ts}`. `es.ts` es la fuente; `en.ts` debe tener las mismas claves (lo garantiza el tipo `Dictionary = typeof es`).
- Locale guardado en cookie `pp_lang` (`'es' | 'en'`, default `'es'`). Sin prefijo en rutas.
- Server: `getLocale()` lee la cookie; `getDictionary(locale)`. Cliente: `<I18nProvider dict locale>` + `useT()`.
- Selector `ES | EN` en `SiteHeader`, cambia la cookie con una server action `setLocale(locale)` y hace `router.refresh()`.
- Fechas: `date-fns` con `es` o `enUS` según locale. Zona horaria siempre `America/Caracas`.
- Todo texto nuevo de landing/booking en PRs 04–06 entra **por diccionario**, nunca en duro.

### 3.4 Admin UI (PR 07)
- Rutas nuevas bajo `src/app/admin/(dashboard)/`: `reservations/`, `finance/transactions/`, `finance/bcv/`, `audit/`, `settings/` (ya existe).
- Navegación en `src/components/admin/nav-config.ts`: grupos **Operaciones** (Hoy `/admin`, Reservas `/admin/reservations`), **Finanzas** (Transacciones C2P `/admin/finance/transactions`, Tasas BCV `/admin/finance/bcv`), **Gestión** (Configuración `/admin/settings`, Auditoría `/admin/audit` — solo owner).
- Touch targets ≥ 44px (`components/admin/ui-constants.ts`). Colores de estado en un solo lugar (`ui-constants.ts`).

## 4. PRs, olas y dependencias

Una ola empieza cuando la anterior está mergeada en `develop`. Dentro de una ola los PRs van en paralelo.

| PR | Rama | Alcance | Labels | Depende de | Ola |
|---|---|---|---|---|---|
| 00 | `fix/real-address` | Llevar a `develop` el commit `6a1ebb0` que quedó fuera del PR #10 | `bug` | — | 1 |
| 01 | `feat/backend-audit-roles` | Migraciones 0005–0007, `logAudit`, historial BCV, roles + `requireAdmin` con rol, auditoría en las 5 acciones admin que escriben | `area:backend`, `enhancement` | — | 1 |
| 02 | `feat/backend-reservation-search` | `searchReservations` + `adminSearchReservations`, `checkinsByHour`, `getWeekendBookedPeople` | `area:backend`, `enhancement` | — | 1 |
| 03 | `feat/i18n-landing` | Infra i18n + extraer textos actuales de landing y `/reservar` + selector ES/EN | `area:i18n`, `area:landing`, `enhancement` | — | 1 |
| 04 | `feat/landing-hero` | Hero navy+glass, badge vivo (pulso verde / ámbar <20 % / agotado), chip de prueba social real, HeroBookingCard en 3 pasos con cupos por día, total USD + VES, CTA coral | `area:landing`, `ux` | 02, 03 | 2 |
| 05 | `feat/landing-sections` | "Cómo funciona" en 4 pasos con conectores y animación, bento de amenidades (usa `landingContent.amenities`), reglas y horario | `area:landing`, `ux` | 03 | 2 |
| 06 | `feat/booking-checkout` | Resumen con desglose BCV, teléfono con autoformato, selector de banco con chip, PIN con mostrar/ocultar, badges de confianza, voucher imprimible/descargable + WhatsApp | `area:booking`, `ux` | 03 | 2 |
| 07 | `feat/admin-shell` | Sidebar colapsable por grupos, drawer móvil 44px, topbar con breadcrumb, badge BCV, campana de pendientes, fecha Caracas, pill de perfil con rol, ⌘K | `area:admin`, `ux` | 01 | 2 |
| 08 | `feat/admin-checkin-gate` | Pantalla de puerta a pantalla completa, alto contraste, botón 60px, 4 estados | `area:admin`, `ux` | — | 2 |
| 09 | `feat/admin-metrics` | KPIs: gauge de ocupación con rangos de color, velocidad de check-in por hora, ingresos USD/VES por estado, cola C2P pulsante | `area:admin`, `ux` | 02, 07 | 3 |
| 10 | `feat/admin-reservations` | Página `/admin/reservations`: búsqueda, filtros (rango de fechas, estado, tipo de grupo), chips descartables, tabla ordenable, paginación 10/25/50, acciones por fila, drawer de detalle | `area:admin`, `ux` | 02, 07 | 3 |
| 11 | `feat/admin-settings-tabs` | Pestañas: General (steppers + proyección de ingresos), Excepciones (calendario + motivos), Accesos (roles); refresco manual de BCV | `area:admin`, `ux` | 01, 07 | 3 |
| 12 | `feat/admin-finance-audit` | Páginas Transacciones C2P, Tasas BCV y Auditoría (solo lectura, paginadas) | `area:admin`, `ux` | 01, 02, 07 | 3 |

**Labels a crear una sola vez** (antes del primer PR):
```bash
gh label create "area:backend" --color 5319e7 --description "Supabase, server actions, migraciones"
gh label create "area:landing" --color 0bc4c7 --description "Landing pública"
gh label create "area:booking" --color ff7657 --description "Flujo /reservar y checkout C2P"
gh label create "area:admin"   --color 0b2a4a --description "Dashboard administrativo"
gh label create "area:i18n"    --color fbca04 --description "Idiomas / traducciones"
gh label create "ux"           --color e8fbf7 --description "Mejora de UX/UI"
```

## 5. Flujo por PR (igual para todos)

```bash
# 1. Worktree desde develop actualizado
git fetch origin develop
git worktree add .worktrees/<rama> -b <rama> origin/develop
cd .worktrees/<rama> && npm ci

# 2. Ejecutar el plan detallado del PR (TDD, commits pequeños)

# 3. Verificación antes del PR
npm run lint && npm test && npm run build
# PRs con migración o DB: npm run test:integration (requiere `supabase start`)
# PRs con UI de landing/booking: npm run test:e2e

# 4. PR
git push -u origin <rama>
gh pr create --base develop --assignee JoseSleiter --label "<labels>" \
  --title "<tipo>(<area>): <resumen>" --body-file <cuerpo>.md

# 5. Tras el merge
git worktree remove .worktrees/<rama>
```

`.worktrees/` debe estar en `.gitignore` (lo añade el PR 00 si no está).

**Remoto:** `origin` usa el alias SSH `git@me:JoseSleiter/pool-pass.git` (llave `~/.ssh/id_rsa_me`); `git@github.com:` no tiene llave asociada en esta máquina.

## 6. Estado de los planes detallados

| PR | Plan detallado |
|---|---|
| 00 | No necesita (cherry-pick de un commit) |
| 01 | `2026-10-04-pr01-backend-audit-roles.md` |
| 02 | `2026-10-04-pr02-backend-reservation-search.md` |
| 03 | `2026-10-04-pr03-i18n-landing.md` |
| 04–12 | Se escriben al empezar su ola, sobre el código ya mergeado de la ola anterior (así no quedan desactualizados). Deben respetar §2 y §3. |

## 7. Fuera de alcance
- Traducir el email del voucher y el admin.
- Escáner de cámara dentro de la app (el QR ya abre `/admin/checkin/[id]` desde la cámara del teléfono).
- Fotos reales de la piscina: el bento de PR 05 usa placeholders hasta que el dueño entregue fotos (`public/amenities/*.webp`).
