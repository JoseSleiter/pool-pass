# Rediseño del back-office admin — Diseño

Fecha: 2026-07-21
Rama: `feat/admin-backoffice-redesign`

## Contexto

El panel de administración (`/admin` "Hoy" y `/admin/settings` "Configuración") es funcional
pero visualmente austero y no comparte una estructura administrativa consistente. Los mockups de
referencia (`.superpowers/templates/admin/image.png`, `image copy.png`) y la especificación de
`.superpowers/brainstorm/custom1/plan.md` + `plan1.md` definen un rediseño estilo SaaS con shell
compartido, métricas, filtros, tarjetas de reserva y modales.

Pedidos explícitos del usuario:
1. Hacer **más prominente** el "Ver detalle" de cada reserva.
2. Mover el botón **Check-in a la parte inferior derecha** de la tarjeta para dar visibilidad a esa acción.
3. **Traducción al español** de todas las cadenas de UI.
4. Agregar `cursor: pointer` a **todos** los botones con funcionalidad.

## Descomposición en dos PRs

| PR | Alcance | Rama |
|----|---------|------|
| **PR 1 — este spec** | Rediseño completo del back-office admin: shell + topbar compartidos, vista Hoy, vista Configuración, backend de excepciones (`motivo` + cerrado/especial), modales Ver detalle y Aprobar check-in, español + `cursor:pointer` global. | `feat/admin-backoffice-redesign` |
| **PR 2 — futuro (worktree aparte)** | Verificación **manual** de pagos (registrar/aprobar/rechazar pagos por transferencia/efectivo) + **crear reservas presenciales** desde el panel. | worktree dedicado |

Motivo de la separación: hoy los pagos se **auto-confirman** vía Mercantil C2P
(`reservar → pagar → confirmed/failed`). `pending_payment` es un estado transitorio (retiene el
cupo ~10 min); no existe verificación manual. Construir ese flujo + creación presencial es un
subsistema grande e independiente, así que va en PR 2.

En **PR 1**, la tarjeta "Pagos por verificar" es **informativa**: cuenta reservas en
`pending_payment` y "Revisar pagos" **filtra** la lista a esas reservas. No introduce acción de
verificación manual.

## Enfoque

Un solo spec cohesivo, implementado en fases ordenadas para minimizar acoplamiento:
**primitivos compartidos → shell/topbar → vista Hoy → vista Configuración → backend de excepciones**.
Cada fase deja el panel en estado funcional.

## Dirección visual

Estilo SaaS profesional (según mockups): sidebar azul oscuro (`#0c4a6e`), área principal gris
azulada muy clara, tarjetas blancas con bordes redondeados y sombras suaves. Botones principales en
coral (primary actual), estados positivos verde suave, pendientes ámbar. Ayuda contextual debajo de
las etiquetas. Formularios progresivos (campos que aparecen solo cuando aplican). Confirmaciones
claras tras guardar/eliminar.

---

## Componentes por sección

### 1. Primitivos compartidos

**`src/components/ui/dialog.tsx`** — envuelve `@base-ui/react/dialog`.
- Exporta `Dialog`, `DialogTrigger`, `DialogPopup` (con backdrop), `DialogTitle`, `DialogClose`.
- Reutilizado por: Ver detalle, Aprobar check-in, Nueva excepción, Confirmar eliminación.
- Accesible: `role="dialog"`, foco atrapado (lo provee Base UI), cierre con Esc/backdrop.
- Nota: NO disparar `alert/confirm/prompt` nativos.

**`cursor:pointer` global** — agregar `cursor-pointer` a la clase base de `buttonVariants`
(`src/components/ui/button.tsx`), lo que cubre todos los `<Button>`. Agregarlo también a los
elementos `<button>`/`<Link>` crudos con función: nav del sidebar, hamburguesa móvil, chips de
filtro, botones de la barra de fecha, campana de notificaciones, chip de perfil.

**`src/components/ui/toast.tsx`** — toast ligero (éxito/error) con auto-dismiss (~3 s) y `role="status"`.
- API: un hook o componente controlado por estado local en la vista Hoy.
- Usos: "Check-in aprobado", "No se pudo guardar. Revisa la fecha y la capacidad.".

### 2. AdminShell + Topbar (compartido en `/admin` y `/admin/settings`)

Refactor de `src/components/admin/admin-shell.tsx`:

```
AdminShell
├── Sidebar
│   ├── Brand (🌊 Club La Piscina / Panel de administración)
│   ├── NavLinks (Hoy, Configuración — icono + estado activo + cursor-pointer)
│   └── AdminAccount (avatar + "Administrador", anclado abajo, menú con "Cerrar sesión")
└── MainWorkspace
    ├── Topbar (contexto izquierda · campana + chip Admin derecha)
    └── {children}
```

- **Nav**: estado activo = fondo azul más claro + texto/icono blanco, bordes redondeados,
  transición suave; estado normal = transparente + texto azul claro. `cursor-pointer`.
- **AdminAccount**: fondo azul más oscuro, avatar circular, "Administrador"; menú con Cerrar sesión
  (mueve el logout actual aquí).
- **Topbar** (nuevo, compartido): 
  - Izquierda = contexto: en Hoy la fecha larga; en Configuración "Panel administrativo".
  - Derecha = **campana** (fondo blanco, borde sutil, badge opcional, `cursor-pointer`; panel
    vacío/placeholder por ahora, NO persiste notificaciones) + **chip Admin** (avatar + "Admin",
    menú desplegable con acciones placeholder + Cerrar sesión).
- **Móvil**: mantener acceso a la navegación (hamburguesa o topbar adaptado); AdminAccount y topbar
  degradan a versión compacta.
- El contexto de la topbar se pasa por prop desde cada página (ej. `topbarContext`).

### 3. Vista Hoy (`/admin`)

`src/components/admin/day-view.tsx` + subcomponentes nuevos.

- **Encabezado de página**: "Reservas del día" + fecha larga en español.
- **Barra de fecha**: `[Seleccionar fecha]` (date input) · `‹ Ayer` · `Mañana ›` · botón destacado `Hoy`.
- **MetricGrid** (4 tarjetas, misma altura/padding/radio/estructura):
  - **Ocupación**: `confirmedPeople / capacity`, barra de progreso, tono por % (verde bajo, azul
    normal, naranja alto, rojo casi lleno), "N personas dentro".
  - **Ingresaron**: `checkedInParties` grupos, "N personas dentro".
  - **Ingresos del día**: `$revenueUsd`, secundario "Bs. revenueVes · N reservas".
  - **Pagos por verificar**: `pendingCount`. Si 0 → verde "Todo al día". Si >0 → fondo ámbar,
    número destacado, "Requiere atención", botón "Revisar pagos" (filtra la lista al chip Pendientes).
- **Alertas** (debajo de métricas, antes de la lista):
  - Error de correo (fondo rojo suave, icono advertencia, botón "Reintentar"), asociado a la reserva
    cuando sea posible.
  - Éxito (fondo verde suave, "Correo reenviado correctamente").
  - Pagos pendientes ("Hay N pagos pendientes de verificación." + "Revisar pagos").
- **Workspace de reservas** (tarjeta grande):
  - Título "Reservas programadas" + subtítulo "Consulta y gestiona los accesos del día" + botón Filtros.
  - **SearchBar**: icono, placeholder "Buscar por nombre, código o cédula…", botón limpiar cuando hay texto.
  - **Chips de filtro** con conteo: `Todas · N`, `Confirmadas · N`, `Ingresaron · N`,
    `Pendientes · N`, `Canceladas · N`. Activo = fondo azul + texto blanco. `cursor-pointer`.
  - Contador "N reservas encontradas".
- **ReservationCard** (`src/components/admin/reservation-card.tsx`, reemplaza el render inline de
  `reservations-table.tsx`):
  ```
  ReservationCard
  ├── Header       → código (mono) + chip de estado (arriba-derecha)
  ├── GuestInfo    → nombre (peso medio) + documento (secundario)
  ├── Details      → "N adultos · M niños · $total"
  └── Actions      → pie con separación clara información/acciones
  ```
  - **"Ver detalle"** como acción prominente (botón visible, no enlace pequeño).
  - **"Reenviar correo"** secundaria.
  - **"Check-in"** botón **primario anclado abajo-a-la-derecha** cuando `status === 'confirmed'`.
    Tras check-in exitoso → se reemplaza por chip "Ingreso registrado" (no botón muerto).
  - "Check-in" abre el **modal Aprobar check-in** (no ejecuta directo).
- **Modal Ver detalle**: código, datos del huésped, grupo, pago (USD + Bs), fecha, estado actual;
  acciones "Cerrar" / "Iniciar check-in" (si aplica).
- **Modal Aprobar check-in** (`checkin-card.tsx` reusa lógica de clasificación):
  - Título "Aprobar check-in".
  - Aviso si la fecha de la reserva ≠ hoy (advertencia ámbar).
  - Resumen del huésped, adultos/niños, información del pago.
  - Acciones "Cancelar" / "Aprobar check-in".
  - Éxito → toast "Check-in aprobado"; error → toast "No se pudo guardar. Revisa la fecha y la capacidad.".
- **Estados vacíos**:
  - Sin reservas: "No hay reservas para este día. Prueba con otra fecha o revisa las reservas futuras."
  - Día cerrado: "El club está cerrado en esta fecha. No se aceptarán nuevas reservas."

### 4. Vista Configuración (`/admin/settings`)

`src/components/admin/settings-form.tsx` refactor + modales.

- **Parámetros generales** (tarjeta):
  - Capacidad diaria (input + ayuda "Límite máximo de personas que pueden ingresar en un día normal.").
  - Precio adulto (USD), Precio niño (USD), cada uno con etiqueta y ayuda.
  - **Vista previa en vivo**: "Una reserva de 2 adultos y 1 niño tendrá un valor estimado de $X USD."
    (usa `totalUsd` de `src/lib/money.ts` con los precios del formulario).
  - Botón "Guardar configuración" con estados: `Guardar configuración → Guardando… → Configuración guardada`.
  - Indicador "Tienes cambios sin guardar." cuando el form difiere de lo persistido; tras guardar
    "Todos los cambios están guardados." (verde).
- **Excepciones de capacidad** (tarjeta):
  - Texto: "Usa una excepción cuando un día tenga una capacidad diferente o el club permanezca cerrado."
  - Botón "+ Nueva excepción" (arriba-derecha) → **modal Nueva excepción**:
    - Fecha (date input).
    - Tipo de día: `Capacidad especial` | `Día cerrado`.
    - Capacidad máxima (input) — **solo visible si "Capacidad especial"** (progresivo).
    - Motivo (opcional, texto libre, ej. "Mantenimiento de piscina").
    - Acciones "Cancelar" / "Guardar excepción".
  - **Lista de excepciones** como tarjetas/filas:
    - Fecha + descripción ("Capacidad limitada a N persona(s)" / "Club cerrado") + chip de tipo +
      acciones "Editar" · "Eliminar".
    - "Editar" reabre el modal precargado (upsert misma fecha).
    - "Eliminar" → **modal de confirmación**: "¿Eliminar esta excepción? Esta acción cambiará la
      capacidad disponible para ese día." (Cancelar / Eliminar).
    - **Estado vacío**: "No tienes excepciones configuradas. Agrega una fecha especial cuando la
      capacidad cambie."

### 5. Backend de excepciones

- **Migración** `supabase/migrations/0004_override_reason.sql`:
  `ALTER TABLE capacity_overrides ADD COLUMN reason text;` (nullable).
- `src/lib/db/reservations.ts`:
  - `OverrideRow` tipo `{ date: string; capacity: number; reason: string | null }`.
  - `listOverrides()` devuelve `reason`.
  - `upsertOverride(date, capacity, reason?)` persiste `reason`.
- `src/app/admin/actions.ts`:
  - `adminUpsertOverride(date, capacity, reason?)` valida y pasa `reason` (string opcional, longitud acotada).
  - `adminGetSettings` devuelve overrides con `reason`.
- Semántica: `capacity === 0` ⇒ "Día cerrado"; `capacity > 0` ⇒ "Capacidad especial". `reason` es
  metadato opcional mostrado en la lista.
- **Sin** otros cambios de servidor (pagos y reservas presenciales → PR 2).

### 6. Español + `cursor:pointer`

- Revisar todas las vistas admin y traducir cadenas restantes al español. Se mantiene el término
  "Check-in" como en los mockups; el resto en español.
- Verificar `cursor-pointer` en todo elemento clickeable (Button ya cubierto por la base; auditar
  `<button>`, `<Link>` con rol de botón, chips, iconos accionables).

## Datos y flujo

- **Vista Hoy**: server component (`page.tsx`) obtiene `adminListReservations(date)` +
  `adminGetDaySummary(date)`; el filtrado por chip y la búsqueda son **cliente** sobre las filas ya
  cargadas. Check-in / reenviar → server actions existentes (`adminCheckIn`, `adminResendVoucher`) +
  `router.refresh()`.
- **Configuración**: `adminGetSettings` (server) → form cliente; guardar/upsert/eliminar vía server
  actions + `router.refresh()`.
- **Excepciones**: `reason` fluye action → db; lectura en `adminGetSettings`.

## Manejo de errores

- Reenvío de correo fallido → alerta con "Reintentar" (asociada a la reserva).
- Check-in fallido (estado no confirmado / fecha) → toast de error, la tarjeta no cambia.
- Guardar configuración/excepción fallido → mensaje inline en el modal/tarjeta.
- Reserva inexistente en check-in QR → mensaje existente conservado.

## Estrategia de pruebas (TDD)

- **Unit/component (vitest + testing-library)**:
  - `reservation-card.test.tsx`: render de estados (confirmed muestra Check-in abajo-derecha;
    checked_in muestra "Ingreso registrado"; Ver detalle abre modal).
  - Filtros/chips: conteos correctos, filtro activo, búsqueda + limpiar, "N reservas encontradas".
  - `checkin-card.test.tsx`: actualizar a modal (aviso fecha distinta, aprobar → toast).
  - `settings-form.test.tsx` (nuevo): vista previa de precio, estados del botón guardar, modal Nueva
    excepción (campo capacidad condicional al tipo), confirmación de eliminación.
  - `reason` en overrides: actions/db reflejan el campo.
- **Integración**: extender `reservations.integration.test.ts` si aplica para `reason` en
  `capacity_overrides`.
- Mantener verde toda la suite existente (`npm test`).

## Fuera de alcance (PR 2)

- Verificación manual de pagos (registrar/aprobar/rechazar).
- Creación de reservas presenciales desde el panel.
- Notificaciones persistidas (la campana es placeholder visual en PR 1).
