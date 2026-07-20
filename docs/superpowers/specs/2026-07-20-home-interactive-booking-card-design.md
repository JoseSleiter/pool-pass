# Card de reserva interactivo en el home

**Fecha:** 2026-07-20
**Estado:** aprobado (pendiente revisión del spec)

## Problema

El card "Reserva tu pase" del hero de la home (`src/components/landing/hero.tsx`)
es una **réplica estática** del card real de `/reservar` (`BookingCard`). Sus tiles
de **Fecha de visita** y **Personas** son `<div>` con valores hardcodeados
(fecha de hoy, "2 adultos · 1 niño") y el **Total estimado** se calcula sobre esos
valores fijos. No tienen funcionalidad: el usuario no puede elegir nada hasta llegar
a `/reservar`, donde vuelve a empezar de cero.

## Objetivo

Hacer que los tiles de **Fecha** y **Personas** del home sean interactivos
(calendario / contador, total en vivo) y que al presionar **Continuar** esas
selecciones viajen a `/reservar` para que el usuario **no re-elija**.

## Principio de diseño

Una sola fuente de verdad para la UI de fecha y personas. Hoy la lógica de
"día no disponible" (pasado o lleno) y el stepper de personas viven privados dentro
de `booking-card.tsx`. Se extraen a componentes compartidos para que ambos cards
(home y `/reservar`) usen exactamente el mismo comportamiento y no se desincronicen.

## Componentes

### Piezas compartidas (nuevas)

- **`src/components/booking/count-row.tsx`** — mover el `CountRow` privado actual de
  `booking-card.tsx` a este módulo y exportarlo. Presentacional puro
  (label, hint, value, onChange, testId, límites 0–20).

- **`src/components/booking/date-picker-panel.tsx`** — editor de calendario compartido.
  Envuelve `Calendar` (locale `es`, `weekStartsOn=0`) con la lógica de deshabilitar:
  - días anteriores a hoy,
  - días con `availability[key] <= 0`.
  Props: `date: string`, `availability: Record<string, number>`,
  `onSelect(date: string)`, `onMonthChange(month: string)`.

- **`@/lib/dates` → `visitLabelEs(date: string): string`** — formateador
  "Vie, 17 Jul 2026" (capitaliza y quita puntos). Reemplaza los duplicados
  `visitDateLabel` (hero) y `longVisitLabel` (booking-card).

### Home

- **`src/components/landing/hero-booking-card.tsx`** (nuevo, `'use client'`) — el card
  interactivo que hoy está inline en `hero.tsx`. Estado local: `date`, `adults`,
  `children`, `editing: null | 'date' | 'people'`, `availability`. Tiles clickeables
  que abren `DatePickerPanel` / filas `CountRow`; total con `totalUsd`.
  **Continuar** = `Link` a `/reservar?date=<date>&adults=<n>&children=<n>&pay=1`.
  Props: `prices`, `remaining`, `initialAvailability`.

- **`src/components/landing/hero.tsx`** — sigue siendo server component (copy, pool
  mark, indicador "Piscina abierta / Agotado hoy"). Renderiza `<HeroBookingCard/>`
  en vez del bloque estático.

- **`src/app/page.tsx`** — además de `getPublicPrices()` y `getTodayRemaining()`,
  hace `getAvailability(todayCaracas().slice(0,7))` y lo pasa como
  `initialAvailability` al hero.

### `/reservar`

- **`src/app/reservar/page.tsx`** — `searchParams` ahora incluye `date`, `adults`,
  `children`. Se validan/clampan con un helper (ver abajo). El `month` para
  `getAvailability` se calcula desde la fecha recibida (para que la disponibilidad
  calce con lo que se muestra). Pasa `initialDate/initialAdults/initialChildren` a
  `BookingCard`.

- **`src/components/booking/booking-card.tsx`** — props opcionales
  `initialDate/initialAdults/initialChildren` usados como defaults de `useState`
  (fallback: hoy / 2 / 1). Importa `CountRow` y `DatePickerPanel` compartidos.
  Sin cambios de comportamiento cuando los props no llegan.

### Helper de parseo

- **`src/lib/booking/search-params.ts`** —
  `parseBookingParams({ date?, adults?, children? })` que devuelve
  `{ date, adults, children }` saneados:
  - `date`: si matchea `YYYY-MM-DD` y no es pasado (comparado con `todayCaracas()`),
    se usa; si no, `todayCaracas()`.
  - `adults` / `children`: entero, clamp a `[0, 20]`; si inválido, defaults 2 / 1.

## UX

- Todo elemento interactivo (tiles clickeables de Fecha/Personas, botones +/- del
  stepper, "Continuar", "Listo") lleva `cursor-pointer` para señalar que es clickeable.
  Aplica tanto al card del home como a `BookingCard` (verificar que los existentes ya lo
  tengan y agregarlo donde falte durante la extracción a compartidos).

## Flujo de datos

```
home page.tsx
  ├─ getPublicPrices, getTodayRemaining, getAvailability(mesActual)
  └─ Hero → HeroBookingCard (interactivo: date/adults/children)
       └─ Continuar → /reservar?date=..&adults=..&children=..&pay=1
            └─ reservar page.tsx: parseBookingParams → getAvailability(mes de date)
                 └─ BookingCard (arranca con esos valores, vista 'pay')
```

## Casos borde

- Params ausentes o inválidos en `/reservar` → defaults actuales (hoy / 2 / 1).
  Sin regresión respecto al comportamiento previo.
- Fecha pasada en el query → clamp a hoy.
- `adults + children === 0` → tile "Elige asistentes", total $0. `/reservar` ya fuerza
  el editor de personas en `goToPay` si el conteo es 0.
- Fecha en un mes futuro → `/reservar` pide la disponibilidad de ese mes al montar.

## Testing

- **Unit** para `parseBookingParams`: fecha válida futura, fecha pasada (→ hoy), fecha
  malformada (→ hoy), adults/children fuera de rango (→ clamp), ausentes (→ defaults).
- La cobertura e2e existente de `/reservar` se mantiene; ajustar solo si algún selector
  cambia por la extracción de componentes.

## Fuera de alcance (YAGNI)

- No se monta el flujo de pago completo en el home.
- No se persiste la selección más allá del query param (sin localStorage/estado global).
