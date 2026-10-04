# PR 05 — Secciones de la landing (Cómo funciona + bento de amenidades + horario/normas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer "Cómo funciona" como un recorrido de 4 pasos con conectores y una animación de aparición accesible, y añadir una sección nueva de amenidades en formato bento con etiquetas de vidrio, horario y un bloque de normas que solo aparece cuando el dueño cargue normas reales.

**Architecture:** `src/components/landing/sections.tsx` sigue siendo un módulo de Server Components que recibe `t: Dictionary`. La única pieza de cliente es una isla mínima nueva, `RevealOnScroll` (`landing/reveal-on-scroll.tsx`), que solo *oculta* contenido después de hidratar, si hay `IntersectionObserver`, si no hay `prefers-reduced-motion` y si el elemento está bajo el pliegue; el HTML del servidor siempre trae todo visible. Los datos no traducibles (lista de amenidades con `image?` opcional y lista de ids de normas, vacía) viven en `src/lib/landing-content.ts`; todo texto visible va en `es.ts`/`en.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 (tokens de `src/app/globals.css`), lucide-react 1.23, `next/image`, Vitest 4 + Testing Library (jsdom), Playwright (proyecto `mobile-chrome`, Pixel 7).

---

## Entorno (obligatorio, leer antes de empezar)

- Directorio de trabajo: `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections` (rama `feat/landing-sections`, ya creada desde `develop`). El plan **no** crea worktree, **no** hace push y **no** abre PR.
- Node por defecto es v16. Todo comando `npm`/`npx` va precedido de `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null &&`.
- Supabase local ya está corriendo y es compartido: **prohibido** `supabase start/stop/db reset/migration`. Este PR no necesita migraciones.
- Los e2e se serializan con un lock:
  `L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"`
- Commits en formato conventional, terminando con una línea en blanco y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Diccionarios: solo se tocan los namespaces que posee este PR: `content`, `features`, `howItWorks`, `finalCta` y el nuevo `amenities` (al final del objeto). Las claves nuevas van **al final** de su namespace.
- `src/lib/i18n/dictionaries.test.ts` exige: mismas claves en `es` y `en`, ningún string vacío, y que **ningún valor de `en` sea idéntico al de `es`**. Todas las cadenas nuevas de este plan ya cumplen eso.

## Decisiones de diseño (resumen)

- Paleta solo con tokens (`navy`, `navy-deep`, `teal`, `teal-soft`, `mint`, `coral` vía `primary`); Fredoka (`font-heading`) en títulos, Rubik en cuerpo.
- Un solo momento de movimiento: el recorrido de "Cómo funciona" aparece escalonado (120 ms entre pasos). El bento no se anima. Con `prefers-reduced-motion: reduce` no se oculta nada y no hay transición.
- Conectores: verticales a la izquierda en móvil, horizontales entre íconos desde `md`. Son decorativos (`aria-hidden`) y no se animan, así el recorrido se entiende aunque el JS falle.
- Bento: 4 columnas × 3 filas en `md` (`pool` 2×2, `food`, `shade` y `showers` de 2 columnas), 2 columnas en móvil; `grid-flow-row-dense` para que `parking` rellene el hueco junto a `lifeguards`. Todos los tonos son oscuros (navy/teal) para que la etiqueta de vidrio blanca tenga contraste.
- Sin fotos reales: placeholder de olas en SVG + brillo radial + ícono Lucide grande y tenue. Si una amenidad trae `image`, se usa `next/image` con `fill` y un velo inferior para que la etiqueta se lea.
- Íconos: pasos `Calendar`, `Users`, `CreditCard`, `QrCode` (lo pide el brief); amenidades `WavesLadder` (lucide 1.x no tiene `Waves`), `LifeBuoy`, `UtensilsCrossed`, `CircleParking`, `Umbrella`, `ShowerHead`; horario `Clock`.
- Ancla `#como-funciona` pasa de `Features` a `HowItWorks` (el header enlaza ahí y el texto del enlace es "Cómo funciona"). `#precios` se queda en `FinalCta`. Nueva ancla `#amenidades`.
- Normas: `landingContent.rules` es una lista de ids (vacía, con TODO para el dueño) que apuntan a `t.amenities.rules` (objeto vacío en ambos idiomas). El componente recibe los textos ya resueltos por prop (`rules?: readonly string[]`) para poder probar ambos casos.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/landing-content.ts` | Modificar | Tipo `Amenity` con `image?`, amenidades sin emoji, lista `rules` vacía con TODO |
| `src/lib/landing-content.test.ts` | Modificar | Reglas de `image`, cobertura de ids de normas y textos de `amenities` |
| `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts` | Modificar | `howItWorks.details` y namespace nuevo `amenities` |
| `src/components/landing/reveal-on-scroll.tsx` | Crear | Isla cliente de aparición al hacer scroll (sin librerías) |
| `src/components/landing/reveal-on-scroll.test.tsx` | Crear | Tests de la isla (sin IO, reduced motion, sobre el pliegue, revelado) |
| `src/components/landing/sections.tsx` | Modificar | `HowItWorks` nuevo, `Amenities` nuevo, `Features` sin ancla |
| `src/components/landing/sections.test.tsx` | Modificar | Tests de anclas, pasos, conectores, SSR visible, bento, horario y normas |
| `src/app/page.tsx` | Modificar (desviación, 2 líneas) | Montar `<Amenities t={t} />` entre `HowItWorks` y `FinalCta` |
| `public/amenities/.gitkeep` | Crear | Carpeta donde el dueño pondrá `<id>.webp` |
| `e2e/landing-sections.spec.ts` | Crear | Ancla, recorrido completo visible tras scroll, reduced motion, bento + horario |

---

### Task 0: Preparar dependencias y línea base

**Files:** ninguno.

- [ ] **Step 1: Instalar dependencias si faltan** (el worktree se creó sin `node_modules`)

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && ls node_modules >/dev/null 2>&1 || (source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm ci)
```
Expected: termina sin errores (si ya existía `node_modules`, no imprime nada).

- [ ] **Step 2: Correr la suite unitaria como línea base**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm test
```
Expected: todos los tests en verde. Si algo ya falla en `develop`, anotarlo y no arreglarlo en este PR.

---

### Task 1: Datos de amenidades y normas + namespace `amenities`

**Files:**
- Modify: `src/lib/landing-content.ts` (archivo completo)
- Modify: `src/lib/i18n/es.ts` (final del objeto, después de `party`)
- Modify: `src/lib/i18n/en.ts` (final del objeto, después de `party`)
- Test: `src/lib/landing-content.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar `src/lib/landing-content.test.ts` completo por:

```ts
import { describe, it, expect } from 'vitest';
import { landingContent, whatsappUrl, instagramUrl } from './landing-content';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('landing content', () => {
  it('has six amenities and four steps', () => {
    expect(landingContent.amenities).toHaveLength(6);
    expect(landingContent.steps).toHaveLength(4);
  });
  it('every step and amenity id has text in both dictionaries', () => {
    for (const s of landingContent.steps) {
      expect(es.content.steps[s.id]).toBeTruthy();
      expect(en.content.steps[s.id]).toBeTruthy();
    }
    for (const a of landingContent.amenities) {
      expect(es.content.amenities[a.id]).toBeTruthy();
      expect(en.content.amenities[a.id]).toBeTruthy();
    }
  });
  it('amenity photos, when set, live in public/amenities and are named after the amenity', () => {
    for (const a of landingContent.amenities) {
      if (a.image !== undefined) expect(a.image).toBe(`/amenities/${a.id}.webp`);
    }
  });
  it('every pool rule id has text in both dictionaries', () => {
    // `amenities.rules` is `{}` until the owner adds rules; widen it to index by id.
    const esRules = es.amenities.rules as Record<string, string>;
    const enRules = en.amenities.rules as Record<string, string>;
    for (const id of landingContent.rules) {
      expect(esRules[id], id).toBeTruthy();
      expect(enRules[id], id).toBeTruthy();
    }
  });
  it('has the amenities section copy in both languages', () => {
    for (const key of ['heading', 'body', 'scheduleHeading', 'rulesHeading'] as const) {
      expect(es.amenities[key], key).toBeTruthy();
      expect(en.amenities[key], key).toBeTruthy();
    }
  });
  it('builds the club wa.me link', () => {
    expect(whatsappUrl()).toBe('https://wa.me/584249196984');
  });
  it('builds the club instagram link', () => {
    expect(instagramUrl()).toBe('https://instagram.com/finca_villa_victoria');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/landing-content.test.ts
```
Expected: FAIL en "every pool rule id..." y "has the amenities section copy..." con `TypeError: Cannot read properties of undefined (reading 'rules')` / `(reading 'heading')`.

- [ ] **Step 3: Añadir el namespace `amenities` a `es.ts`**

En `src/lib/i18n/es.ts`, el final del objeto pasa de:

```ts
  party: {
    adultOne: '{count} adulto',
    adultOther: '{count} adultos',
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
};
```

a:

```ts
  party: {
    adultOne: '{count} adulto',
    adultOther: '{count} adultos',
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
  amenities: {
    heading: 'Lo que encuentras en el complejo',
    body: 'Piscina, sombra, comida y todo lo necesario para pasar el día completo.',
    scheduleHeading: 'Horario',
    rulesHeading: 'Normas de la piscina',
    // Texts for the ids listed in landingContent.rules (src/lib/landing-content.ts).
    // Empty on purpose: only the owner can provide the real rules.
    rules: {},
  },
};
```

- [ ] **Step 4: Añadir el namespace `amenities` a `en.ts`**

En `src/lib/i18n/en.ts`, el final del objeto pasa de:

```ts
  party: {
```
…(bloque `party` existente sin cambios)…
```ts
  },
};
```

a (añadir después del cierre de `party`, antes del `};` final):

```ts
  amenities: {
    heading: "What you'll find at the club",
    body: 'Pool, shade, food and everything you need to stay all day.',
    scheduleHeading: 'Opening hours',
    rulesHeading: 'Pool rules',
    rules: {},
  },
```

- [ ] **Step 5: Reescribir `src/lib/landing-content.ts`**

Archivo completo:

```ts
import type { Dictionary } from '@/lib/i18n/types';

type StepId = keyof Dictionary['content']['steps'];
type AmenityId = keyof Dictionary['content']['amenities'];
type RuleId = keyof Dictionary['amenities']['rules'];

export interface Amenity {
  id: AmenityId;
  /**
   * Optional photo served from `public/amenities/<id>.webp`, e.g.
   * `image: '/amenities/pool.webp'`. While unset, the landing shows an
   * aquatic placeholder for the tile.
   */
  image?: string;
}

/**
 * Non-translatable landing data. Every visible sentence (tagline, subtitle,
 * step and amenity texts, opening hours, pool rules) lives in the i18n
 * dictionaries; steps, amenities and rules carry an `id` that points into
 * `t.content.steps` / `t.content.amenities` / `t.amenities.rules`.
 */
const steps: readonly { icon: string; id: StepId }[] = [
  { icon: '📅', id: 'chooseDate' },
  { icon: '📲', id: 'payC2p' },
  { icon: '✉️', id: 'getQr' },
  { icon: '🏊', id: 'walkIn' },
];

/** Order matters: it is the reading order of the bento grid. */
const amenities: readonly Amenity[] = [
  { id: 'pool' },
  { id: 'lifeguards' },
  { id: 'food' },
  { id: 'parking' },
  { id: 'shade' },
  { id: 'showers' },
];

/**
 * Pool rules shown next to the opening hours. Each id needs its text in
 * `es.amenities.rules` and `en.amenities.rules`. The landing hides the rules
 * block while this list is empty.
 */
// TODO(owner): add the club's real pool rules here (never invent them).
const rules: readonly RuleId[] = [];

export const landingContent = {
  clubName: 'Complejo Turístico Villa Victoria',
  steps,
  amenities,
  rules,
  address: 'Tumeremo, Bolívar, Venezuela',
  whatsapp: '+58 424-9196984',
  instagram: 'finca_villa_victoria',
} as const;

export function whatsappUrl(): string {
  return `https://wa.me/${landingContent.whatsapp.replace(/\D/g, '')}`;
}

export function instagramUrl(): string {
  return `https://instagram.com/${landingContent.instagram}`;
}
```

Nota: el campo emoji `icon` de las amenidades se elimina porque nadie lo usa (verificado con `grep`); los íconos pasan a Lucide en `sections.tsx`. `steps` no se toca.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/landing-content.test.ts src/lib/i18n/dictionaries.test.ts && npx tsc --noEmit
```
Expected: PASS en ambos archivos; `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git add src/lib/landing-content.ts src/lib/landing-content.test.ts src/lib/i18n/es.ts src/lib/i18n/en.ts && git commit -m "$(cat <<'EOF'
feat(landing): add amenity photos slot and empty pool rules list

Amenities gain an optional image (public/amenities/<id>.webp) and the
landing content gets a rules id list, empty until the owner provides
the real rules. New amenities dictionary namespace in es/en.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Isla `RevealOnScroll`

**Files:**
- Create: `src/components/landing/reveal-on-scroll.tsx`
- Test: `src/components/landing/reveal-on-scroll.test.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/components/landing/reveal-on-scroll.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevealOnScroll } from './reveal-on-scroll';

/** Minimal IntersectionObserver double: records targets and lets the test fire entries. */
class FakeObserver {
  static last: FakeObserver | null = null;
  targets: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  fire(isIntersecting: boolean) {
    this.callback(
      this.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver
    );
  }
}

/** Real-browser-like environment: IO available, motion preference and element position configurable. */
function stubBrowser({ reducedMotion = false, top = 2000 }: { reducedMotion?: boolean; top?: number } = {}) {
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedMotion && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
}

function renderReveal(delayMs?: number) {
  render(
    <RevealOnScroll delayMs={delayMs}>
      <p>Step content</p>
    </RevealOnScroll>
  );
  return screen.getByText('Step content').parentElement as HTMLElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeObserver.last = null;
});

describe('RevealOnScroll', () => {
  it('keeps content visible when IntersectionObserver is unavailable', () => {
    // jsdom has no IntersectionObserver: same path as an old browser.
    const box = renderReveal();
    expect(box).not.toHaveAttribute('data-reveal');
  });

  it('hides below-the-fold content and reveals it once it scrolls into view', () => {
    stubBrowser();
    const box = renderReveal();
    expect(box).toHaveAttribute('data-reveal', 'hidden');

    FakeObserver.last!.fire(false);
    expect(box).toHaveAttribute('data-reveal', 'hidden');

    FakeObserver.last!.fire(true);
    expect(box).toHaveAttribute('data-reveal', 'shown');
    expect(FakeObserver.last!.disconnected).toBe(true);
  });

  it('never hides anything under prefers-reduced-motion', () => {
    stubBrowser({ reducedMotion: true });
    const box = renderReveal();
    expect(box).not.toHaveAttribute('data-reveal');
    expect(FakeObserver.last).toBeNull();
  });

  it('never hides content that is already on screen when it hydrates', () => {
    stubBrowser({ top: 100 });
    const box = renderReveal();
    expect(box).not.toHaveAttribute('data-reveal');
  });

  it('applies the stagger delay as a transition delay', () => {
    expect(renderReveal(240).style.transitionDelay).toBe('240ms');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/reveal-on-scroll.test.tsx
```
Expected: FAIL con `Failed to resolve import "./reveal-on-scroll"`.

- [ ] **Step 3: Implementar la isla**

Crear `src/components/landing/reveal-on-scroll.tsx`:

```tsx
'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fades its children up the first time they scroll into view.
 *
 * Progressive enhancement: the server renders the content fully visible and
 * this island only hides it after hydration, and only when (a) the browser
 * has IntersectionObserver, (b) the visitor has not asked for reduced motion
 * and (c) the element is still below the fold. Without JS, with reduced
 * motion, or for content already on screen, nothing is ever hidden.
 */
export function RevealOnScroll({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger between siblings, applied as `transition-delay`. */
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.setAttribute('data-reveal', 'hidden');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.setAttribute('data-reveal', 'shown');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      // Never leave content hidden behind a torn-down observer.
      if (el.getAttribute('data-reveal') === 'hidden') el.removeAttribute('data-reveal');
    };
  }, []);

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn(
        // Tailwind v4 translate utilities use the `translate` property, not `transform`.
        'motion-safe:transition-[opacity,translate] motion-safe:duration-700 motion-safe:ease-out',
        'data-[reveal=hidden]:translate-y-6 data-[reveal=hidden]:opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/reveal-on-scroll.test.tsx && npx eslint src/components/landing/reveal-on-scroll.tsx src/components/landing/reveal-on-scroll.test.tsx
```
Expected: 5 tests PASS; eslint sin salida.

- [ ] **Step 5: Commit**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git add src/components/landing/reveal-on-scroll.tsx src/components/landing/reveal-on-scroll.test.tsx && git commit -m "$(cat <<'EOF'
feat(landing): add RevealOnScroll island

IntersectionObserver-based fade-up with no animation library. Content
is server-rendered visible and only hidden after hydration when it is
below the fold and the visitor allows motion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: "Cómo funciona" como recorrido de 4 pasos

**Files:**
- Modify: `src/lib/i18n/es.ts` (namespace `howItWorks`)
- Modify: `src/lib/i18n/en.ts` (namespace `howItWorks`)
- Modify: `src/components/landing/sections.tsx` (archivo completo)
- Test: `src/components/landing/sections.test.tsx` (archivo completo)

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar `src/components/landing/sections.test.tsx` completo por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Features, HowItWorks, FinalCta } from './sections';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

const stepKeys = ['date', 'group', 'pay', 'voucher'] as const;

describe('landing sections', () => {
  it('render the Spanish copy', () => {
    render(<><Features t={es} /><HowItWorks t={es} /><FinalCta t={es} /></>);
    expect(screen.getByRole('heading', { name: /todo lo que necesitas/i })).toBeInTheDocument();
    expect(screen.getByText('Reserva en minutos')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Recibe tu voucher')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reservar mi pase/i })).toHaveAttribute('href', '/reservar');
  });

  it('render the English copy', () => {
    render(<><Features t={en} /><HowItWorks t={en} /><FinalCta t={en} /></>);
    expect(screen.getByRole('heading', { name: /everything you need/i })).toBeInTheDocument();
    expect(screen.getByText('How your booking works')).toBeInTheDocument();
    expect(screen.getByText(en.howItWorks.details.pay)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /book my pass/i })).toBeInTheDocument();
  });

  it('keeps the header anchors: #como-funciona on the steps, #precios on the final CTA', () => {
    const { container } = render(<><Features t={es} /><HowItWorks t={es} /><FinalCta t={es} /></>);
    const howItWorks = container.querySelectorAll('#como-funciona');
    expect(howItWorks).toHaveLength(1);
    expect(howItWorks[0]).toContainElement(screen.getByRole('heading', { name: es.howItWorks.heading }));
    const prices = container.querySelectorAll('#precios');
    expect(prices).toHaveLength(1);
    expect(prices[0]).toContainElement(screen.getByRole('link', { name: /reservar mi pase/i }));
  });
});

describe('HowItWorks', () => {
  it('renders the four steps in order, each with its title and detail', () => {
    render(<HowItWorks t={es} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    stepKeys.forEach((key, i) => {
      expect(within(items[i]).getByRole('heading', { name: es.howItWorks.steps[key] })).toBeInTheDocument();
      expect(within(items[i]).getByText(es.howItWorks.details[key])).toBeInTheDocument();
      expect(within(items[i]).getByText(String(i + 1).padStart(2, '0'))).toBeInTheDocument();
    });
  });

  it('joins the steps with three connectors (none after the last step)', () => {
    const { container } = render(<HowItWorks t={es} />);
    expect(container.querySelectorAll('[data-slot="step-connector"]')).toHaveLength(3);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[3].querySelector('[data-slot="step-connector"]')).toBeNull();
  });

  it('server-renders every step visible, so nothing depends on JS to appear', () => {
    const html = renderToString(<HowItWorks t={es} />);
    expect(html).not.toContain('data-reveal');
    for (const key of stepKeys) {
      expect(html).toContain(es.howItWorks.steps[key]);
      expect(html).toContain(es.howItWorks.details[key]);
    }
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/sections.test.tsx
```
Expected: FAIL. "keeps the header anchors" falla porque `#como-funciona` hoy envuelve a `Features` (no contiene el heading "Así funciona tu reserva"); los tests de `HowItWorks` fallan porque no existe `role="list"` ni `es.howItWorks.details` (`TypeError: Cannot read properties of undefined`).

- [ ] **Step 3: Añadir `howItWorks.details` en `es.ts`**

En `src/lib/i18n/es.ts`, el namespace `howItWorks` queda así (se añade `details` al final):

```ts
  howItWorks: {
    heading: 'Así funciona tu reserva',
    steps: {
      date: 'Elige la fecha',
      group: 'Registra tu grupo',
      pay: 'Paga con C2P',
      voucher: 'Recibe tu voucher',
    },
    details: {
      date: 'Escoge un día con cupo disponible en el calendario.',
      group: 'Indica cuántos adultos y niños vienen contigo.',
      pay: 'Paga en bolívares desde tu banco con Pago Móvil C2P.',
      voucher: 'Te llega por email con el QR que muestras en la entrada.',
    },
  },
```

- [ ] **Step 4: Añadir `howItWorks.details` en `en.ts`**

En `src/lib/i18n/en.ts`, el namespace `howItWorks` queda así:

```ts
  howItWorks: {
    heading: 'How your booking works',
    steps: {
      date: 'Pick the date',
      group: 'Register your group',
      pay: 'Pay with C2P',
      voucher: 'Get your voucher',
    },
    details: {
      date: 'Choose a day with open spots on the calendar.',
      group: 'Tell us how many adults and kids are coming with you.',
      pay: 'Pay in bolívares from your bank with Pago Móvil C2P.',
      voucher: 'It arrives by email with the QR you show at the entrance.',
    },
  },
```

- [ ] **Step 5: Reescribir `src/components/landing/sections.tsx`**

Archivo completo:

```tsx
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CreditCard,
  Mail,
  QrCode,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll';
import type { Dictionary } from '@/lib/i18n/types';

const features = [
  { key: 'booking', icon: CalendarCheck },
  { key: 'payment', icon: ShieldCheck },
  { key: 'email', icon: Mail },
] as const;

/** The booking trail, in order. Keys point into `t.howItWorks.steps` / `.details`. */
const steps = [
  { key: 'date', icon: Calendar },
  { key: 'group', icon: Users },
  { key: 'pay', icon: CreditCard },
  { key: 'voucher', icon: QrCode },
] as const;

/** Delay between consecutive steps of the reveal, in ms. */
const STEP_STAGGER_MS = 120;

export function Features({ t }: { t: Dictionary }) {
  return (
    <section className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mx-auto max-w-xl text-center font-heading text-4xl font-semibold leading-tight text-navy">
          {t.features.headingLine1}
          <br />
          {t.features.headingLine2}
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.key}
              className="rounded-2xl border border-border bg-card p-7 shadow-sm"
            >
              <f.icon className="h-7 w-7 text-teal" strokeWidth={1.75} />
              <h3 className="mt-5 text-lg font-bold text-navy">{t.features.items[f.key].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.features.items[f.key].body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * "#como-funciona": four steps joined by a teal line — vertical on the left
 * on mobile, horizontal between the icons from `md`. Each step fades up as
 * it scrolls in (RevealOnScroll); connectors stay static so the trail reads
 * even if JS never runs.
 */
export function HowItWorks({ t }: { t: Dictionary }) {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-heading"
      className="bg-navy px-6 py-20"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="como-funciona-heading"
          className="text-center font-heading text-4xl font-semibold text-white"
        >
          {t.howItWorks.heading}
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          {steps.map((step, i) => (
            <li key={step.key} className="relative">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  data-slot="step-connector"
                  className="absolute -bottom-8 left-7 top-16 w-0.5 -translate-x-1/2 rounded-full bg-linear-to-b from-teal to-teal/25 md:bottom-auto md:left-[calc(50%+2.25rem)] md:top-7 md:h-0.5 md:w-[calc(100%-3rem)] md:translate-x-0 md:bg-linear-to-r"
                />
              )}
              <RevealOnScroll
                delayMs={i * STEP_STAGGER_MS}
                className="flex gap-5 md:flex-col md:items-center md:text-center"
              >
                <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-teal bg-navy-deep text-teal-soft">
                  <step.icon aria-hidden className="size-6" strokeWidth={1.75} />
                </span>
                <div className="pt-1 md:pt-0">
                  <p className="font-heading text-sm font-semibold text-teal">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-white">{t.howItWorks.steps[step.key]}</h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-white/70 md:mx-auto">
                    {t.howItWorks.details[step.key]}
                  </p>
                </div>
              </RevealOnScroll>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FinalCta({ t }: { t: Dictionary }) {
  return (
    <section
      id="precios"
      className="px-6 py-20 text-white"
      style={{ background: 'linear-gradient(160deg, #075e82 0%, #0c8f94 100%)' }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Ticket className="h-9 w-9 text-teal-soft" strokeWidth={1.75} />
        <h2 className="mt-5 font-heading text-4xl font-semibold leading-tight sm:text-5xl">
          {t.finalCta.heading}
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/85">
          {t.finalCta.body}
        </p>
        <Link
          href="/reservar"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-navy-deep/30 transition-transform hover:scale-[1.02]"
        >
          {t.finalCta.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
```

Geometría de los conectores (para revisar sin adivinar): ícono `size-14` (3.5rem, radio 1.75rem). Móvil: la línea arranca 0.5rem bajo el ícono (`top-16` = 4rem), centrada en `left-7` (1.75rem) y baja hasta 0.5rem antes del siguiente ícono (`-bottom-8` dentro del `gap-10`). Desktop: arranca a `50% + 1.75rem + 0.5rem` y mide `100% - 3rem`, que con `gap-6` (1.5rem) termina 0.5rem antes del borde del ícono siguiente.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/sections.test.tsx src/lib/i18n/dictionaries.test.ts && npx tsc --noEmit
```
Expected: todos PASS; `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git add src/components/landing/sections.tsx src/components/landing/sections.test.tsx src/lib/i18n/es.ts src/lib/i18n/en.ts && git commit -m "$(cat <<'EOF'
feat(landing): turn how-it-works into a 4-step connected trail

Calendar/Users/CreditCard/QrCode steps with a detail line each, joined
by connectors (vertical on mobile, horizontal on desktop) and revealed
on scroll. #como-funciona moves to this section, which the header
link names.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bento de amenidades con horario y normas

**Files:**
- Modify: `src/components/landing/sections.tsx` (bloque de imports + componentes nuevos al final)
- Test: `src/components/landing/sections.test.tsx` (imports + bloque `describe('Amenities')` al final)

- [ ] **Step 1: Escribir los tests que fallan**

En `src/components/landing/sections.test.tsx`, reemplazar las líneas de import:

```tsx
import { Features, HowItWorks, FinalCta } from './sections';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';
```

por:

```tsx
import { Amenities, Features, HowItWorks, FinalCta } from './sections';
import { landingContent } from '@/lib/landing-content';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';
```

y añadir al final del archivo:

```tsx
describe('Amenities', () => {
  it('shows every amenity as a bento tile with its label, under #amenidades', () => {
    const { container } = render(<Amenities t={es} />);
    const section = container.querySelector('#amenidades');
    expect(section).toContainElement(screen.getByRole('heading', { name: es.amenities.heading }));
    expect(container.querySelectorAll('[data-slot="amenity-tile"]')).toHaveLength(landingContent.amenities.length);
    for (const a of landingContent.amenities) {
      expect(screen.getByText(es.content.amenities[a.id])).toBeInTheDocument();
    }
  });

  it('uses aquatic placeholders, not images, while no photo is set', () => {
    const { container } = render(<Amenities t={es} items={[{ id: 'pool' }, { id: 'food' }]} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="amenity-placeholder"]')).toHaveLength(2);
  });

  it('renders the photo with next/image when an amenity has one', () => {
    const { container } = render(
      <Amenities t={es} items={[{ id: 'pool', image: '/amenities/pool.webp' }, { id: 'food' }]} />
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toMatch(/amenities(%2F|\/)pool\.webp/);
    expect(container.querySelectorAll('[data-slot="amenity-placeholder"]')).toHaveLength(1);
  });

  it('shows the opening hours', () => {
    render(<Amenities t={es} />);
    expect(screen.getByRole('heading', { name: es.amenities.scheduleHeading })).toBeInTheDocument();
    expect(screen.getByText(es.content.hours)).toBeInTheDocument();
  });

  it('hides the rules block when there are no rules', () => {
    render(<Amenities t={es} rules={[]} />);
    expect(screen.queryByRole('heading', { name: es.amenities.rulesHeading })).toBeNull();
  });

  it('shows the rules block when rules exist', () => {
    render(<Amenities t={es} rules={['Rule one', 'Rule two']} />);
    expect(screen.getByRole('heading', { name: es.amenities.rulesHeading })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: es.amenities.rulesHeading });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Rule one', 'Rule two']);
  });

  it('reads the rules from landingContent by default', () => {
    render(<Amenities t={es} />);
    const shown = screen.queryByRole('heading', { name: es.amenities.rulesHeading }) !== null;
    expect(shown).toBe(landingContent.rules.length > 0);
  });

  it('renders in English', () => {
    render(<Amenities t={en} />);
    expect(screen.getByRole('heading', { name: en.amenities.heading })).toBeInTheDocument();
    expect(screen.getByText(en.content.amenities.lifeguards)).toBeInTheDocument();
    expect(screen.getByText(en.content.hours)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/sections.test.tsx
```
Expected: FAIL en el bloque `Amenities` con `Element type is invalid ... got: undefined` (todavía no se exporta `Amenities`); los tests de Task 3 siguen en verde.

- [ ] **Step 3: Actualizar los imports de `sections.tsx`**

Reemplazar el bloque de imports (desde `import Link` hasta `import type { Dictionary }`) por:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CircleParking,
  Clock,
  CreditCard,
  LifeBuoy,
  Mail,
  QrCode,
  ShieldCheck,
  ShowerHead,
  Ticket,
  Umbrella,
  Users,
  UtensilsCrossed,
  WavesLadder,
  type LucideIcon,
} from 'lucide-react';
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll';
import { landingContent, type Amenity } from '@/lib/landing-content';
import type { Dictionary } from '@/lib/i18n/types';
import { cn } from '@/lib/utils';
```

- [ ] **Step 4: Añadir `Amenities` al final de `sections.tsx`**

Añadir después de `FinalCta`:

```tsx
type AmenityId = Amenity['id'];

const amenityIcons: Record<AmenityId, LucideIcon> = {
  pool: WavesLadder,
  lifeguards: LifeBuoy,
  food: UtensilsCrossed,
  parking: CircleParking,
  shade: Umbrella,
  showers: ShowerHead,
};

/**
 * Bento layout: 4 columns × 3 rows from `md` (pool 2×2; food, shade and
 * showers 2 wide), 2 columns on mobile. The grid uses `grid-flow-row-dense`
 * so `parking` backfills the cell beside `lifeguards` although `food` comes
 * first in the data. Every tone is dark enough for the white glass label.
 */
const amenityTiles: Record<AmenityId, string> = {
  pool: 'col-span-2 row-span-2 bg-linear-to-br from-teal via-teal/70 to-navy',
  lifeguards: 'bg-linear-to-br from-navy to-navy-deep',
  food: 'col-span-2 bg-linear-to-r from-navy-deep via-navy to-teal/80',
  parking: 'bg-linear-to-bl from-teal/80 to-navy-deep',
  shade: 'md:col-span-2 bg-linear-to-tr from-navy-deep to-teal/70',
  showers: 'md:col-span-2 bg-linear-to-br from-navy to-teal/60',
};

/** Rule texts for `landingContent.rules`, in the visitor's language. */
function ruleTexts(t: Dictionary): string[] {
  // `t.amenities.rules` is `{}` until the owner adds rules, so its key type
  // is `never`; widen it to look the ids up.
  const texts = t.amenities.rules as Record<string, string>;
  return landingContent.rules.map((id) => texts[id]);
}

/** Stand-in for a real photo: layered waves, a light caustic and the amenity icon. */
function WaterPlaceholder({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden data-slot="amenity-placeholder" className="absolute inset-0 -z-10">
      <span className="absolute inset-0 bg-radial-[at_25%_15%] from-white/25 to-transparent to-60%" />
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-3/5 w-full text-white"
      >
        <path d="M0 38 Q25 26 50 38 T100 38 T150 38 T200 38 V120 H0 Z" fill="currentColor" fillOpacity="0.08" />
        <path d="M0 64 Q25 52 50 64 T100 64 T150 64 T200 64 V120 H0 Z" fill="currentColor" fillOpacity="0.1" />
        <path d="M0 90 Q25 80 50 90 T100 90 T150 90 T200 90 V120 H0 Z" fill="currentColor" fillOpacity="0.12" />
      </svg>
      <Icon className="absolute right-4 top-4 size-14 text-white/20" strokeWidth={1.25} />
    </span>
  );
}

/**
 * "#amenidades": bento grid of the club's amenities with glass labels, then
 * the opening hours and — only when the owner has provided them — the pool
 * rules. `items` and `rules` default to landingContent; tests override them.
 */
export function Amenities({
  t,
  items = landingContent.amenities,
  rules = ruleTexts(t),
}: {
  t: Dictionary;
  items?: readonly Amenity[];
  rules?: readonly string[];
}) {
  return (
    <section id="amenidades" aria-labelledby="amenidades-heading" className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2
          id="amenidades-heading"
          className="max-w-xl font-heading text-4xl font-semibold leading-tight text-navy"
        >
          {t.amenities.heading}
        </h2>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">{t.amenities.body}</p>

        <ul className="mt-10 grid grid-flow-row-dense auto-rows-[9.5rem] grid-cols-2 gap-3 md:auto-rows-[11rem] md:grid-cols-4 md:gap-4">
          {items.map((amenity) => {
            const Icon = amenityIcons[amenity.id];
            return (
              <li
                key={amenity.id}
                data-slot="amenity-tile"
                className={cn('relative isolate overflow-hidden rounded-3xl', amenityTiles[amenity.id])}
              >
                {amenity.image ? (
                  <>
                    <Image
                      src={amenity.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="-z-10 object-cover"
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 -z-10 bg-linear-to-t from-navy-deep/70 via-transparent to-transparent"
                    />
                  </>
                ) : (
                  <WaterPlaceholder icon={Icon} />
                )}
                <span className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-3.5 py-2.5 text-sm font-semibold leading-snug text-white shadow-lg shadow-navy-deep/20 backdrop-blur-md">
                  <Icon aria-hidden className="size-4 shrink-0 text-teal-soft" strokeWidth={2} />
                  {t.content.amenities[amenity.id]}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-6 rounded-3xl bg-mint p-6 text-navy md:flex-row md:p-8">
          <div className="flex items-start gap-4 md:w-1/3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-teal">
              <Clock aria-hidden className="size-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="font-heading text-xl font-semibold">{t.amenities.scheduleHeading}</h3>
              <p className="mt-1 text-sm text-navy/80">{t.content.hours}</p>
            </div>
          </div>
          {rules.length > 0 && (
            <div className="md:flex-1 md:border-l md:border-teal/30 md:pl-8">
              <h3 id="amenidades-rules-heading" className="font-heading text-xl font-semibold">
                {t.amenities.rulesHeading}
              </h3>
              <ul
                aria-labelledby="amenidades-rules-heading"
                className="mt-3 grid gap-2 text-sm text-navy/80 sm:grid-cols-2"
              >
                {rules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
```

Nota sobre `-z-10` + `isolate`: el `li` crea su propio contexto de apilamiento, así que la imagen/placeholder (z negativo) se pinta encima del degradado del `li` y debajo de la etiqueta de vidrio. El `alt=""` es correcto: la etiqueta visible ya nombra la amenidad.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/landing/sections.test.tsx && npx tsc --noEmit && npx eslint src/components/landing/sections.tsx src/components/landing/sections.test.tsx
```
Expected: todos PASS (3 + 3 + 8 tests); `tsc` y `eslint` sin salida.

- [ ] **Step 6: Commit**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git add src/components/landing/sections.tsx src/components/landing/sections.test.tsx && git commit -m "$(cat <<'EOF'
feat(landing): add amenities bento with hours and optional rules

Six amenity tiles with glass labels over aquatic SVG placeholders
(next/image when a photo is set), followed by the opening hours. The
pool rules block only renders when rules exist.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Montar la sección en la home y crear `public/amenities/`

**Files:**
- Modify: `src/app/page.tsx` (desviación: archivo del PR 04, cambio de 2 líneas)
- Create: `public/amenities/.gitkeep`

- [ ] **Step 1: Montar `Amenities` en `src/app/page.tsx`**

Cambiar la línea de import:

```tsx
import { Features, HowItWorks, FinalCta } from '@/components/landing/sections';
```

por:

```tsx
import { Amenities, Features, HowItWorks, FinalCta } from '@/components/landing/sections';
```

y dentro de `<main>`, después de `<HowItWorks t={t} />`, añadir una línea:

```tsx
        <HowItWorks t={t} />
        <Amenities t={t} />
        <FinalCta t={t} />
```

No tocar nada más del archivo (el PR 04 lo posee y también lo edita; el coordinador resuelve el merge de estas dos líneas).

- [ ] **Step 2: Crear la carpeta de fotos**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && mkdir -p public/amenities && touch public/amenities/.gitkeep
```
Expected: sin salida.

- [ ] **Step 3: Verificar tipos y build**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run build
```
Expected: `tsc` sin errores; `next build` termina con `✓ Compiled successfully` y la ruta `/` listada como dinámica (`ƒ`).

- [ ] **Step 4: Commit**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git add src/app/page.tsx public/amenities/.gitkeep && git commit -m "$(cat <<'EOF'
feat(landing): mount the amenities section on the home page

Also adds public/amenities/ for the owner's <id>.webp photos.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: e2e de las secciones

**Files:**
- Create: `e2e/landing-sections.spec.ts`

- [ ] **Step 1: Escribir el spec**

Crear `e2e/landing-sections.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('#como-funciona lands on the 4-step trail and every step ends up visible', async ({ page }) => {
  await page.goto('/#como-funciona');
  const trail = page.locator('#como-funciona');
  await expect(trail.getByRole('heading', { name: /así funciona tu reserva/i })).toBeVisible();
  const steps = trail.getByRole('listitem');
  await expect(steps).toHaveCount(4);
  for (let i = 0; i < 4; i++) await steps.nth(i).scrollIntoViewIfNeeded();
  // Every step that was hidden for the reveal has been shown.
  await expect(page.locator('[data-reveal="hidden"]')).toHaveCount(0);
});

test('with reduced motion nothing on the landing is ever hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-reveal]')).toHaveCount(0);
});

test('amenities bento shows every tile and the opening hours', async ({ page }) => {
  await page.goto('/#amenidades');
  const section = page.locator('#amenidades');
  await expect(section.getByRole('heading', { name: /lo que encuentras en el complejo/i })).toBeVisible();
  await expect(section.locator('[data-slot="amenity-tile"]')).toHaveCount(6);
  await expect(section.getByText('Salvavidas certificados')).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Horario' })).toBeVisible();
});
```

- [ ] **Step 2: Asegurar que el puerto 3100 no lo tiene un servidor de otro worktree**

`playwright.config.ts` usa `reuseExistingServer`, así que un `next dev` ajeno en 3100 haría que se probara otro código.

Run:
```bash
lsof -ti tcp:3100 || echo "free"
```
Expected: `free`. Si imprime un PID, esperar a que termine el e2e de otro PR (el lock lo serializa) y volver a comprobar; no matar procesos ajenos.

- [ ] **Step 3: Correr toda la suite e2e con el lock**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; (source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:e2e); rc=$?; rmdir "$L"; exit $rc
```
Expected: todos los specs pasan (`booking`, `i18n`, `landing` y los 3 nuevos de `landing-sections`). Si algún selector de los specs existentes falla por los cambios de este PR, aplicar el skill `e2e-selector-coupling` antes de tocar el spec.

- [ ] **Step 4: Commit**

```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git add e2e/landing-sections.spec.ts && git commit -m "$(cat <<'EOF'
test(e2e): cover the how-it-works trail, reduced motion and amenities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Verificación final

**Files:** ninguno (solo si algo falla).

- [ ] **Step 1: Tipos, lint, tests y build**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test && npm run build
```
Expected: los cuatro comandos terminan con código 0; `npm test` sin fallos.

- [ ] **Step 2: Revisión visual rápida (opcional pero recomendada)**

Con `npm run dev -- --port 3200` (puerto distinto del e2e), abrir `http://localhost:3200/` a 390 px y a 1280 px y comprobar: conectores verticales en móvil y horizontales en desktop alineados con el centro de los íconos; bento sin huecos (en `md`: pool 2×2, lifeguards y parking a la derecha, food debajo, shade y showers abajo); etiquetas legibles; con "Emulate CSS prefers-reduced-motion: reduce" en DevTools no hay animación. Parar el servidor al terminar.

- [ ] **Step 3: Confirmar el árbol limpio**

Run:
```bash
cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/landing-sections && git status --short && git log --oneline develop..HEAD
```
Expected: sin cambios pendientes (salvo este plan si no se ha commiteado); 6 commits del PR.

---

## Desviaciones y preguntas abiertas

1. **`src/app/page.tsx` (propiedad del PR 04):** se cambian 2 líneas (import + `<Amenities t={t} />`). Es imprescindible para mostrar la sección nueva; el merge con el PR 04 es trivial.
2. **Archivos nuevos fuera de la tabla:** `landing/reveal-on-scroll.tsx` (+test) y `e2e/landing-sections.spec.ts`. Son nuevos, nadie más los toca.
3. **Horario inventado:** `content.hours` sigue con el TODO del PR 03 ("horario real — este es inventado"). Este PR lo muestra porque el brief lo pide, pero el dueño debe confirmarlo antes del deploy.
4. **Normas:** se dejan vacías a propósito (`landingContent.rules = []`, `amenities.rules = {}`) con TODO para el dueño; el bloque no se ve hasta que se carguen.
5. **`#precios`** sigue apuntando a `FinalCta`, que no muestra precios (los precios están en el hero). No se cambia aquí; queda para decidir con el PR 04.
6. Se elimina el campo emoji `icon` de las amenidades en `landing-content.ts` (no se usaba en ningún sitio).

## Self-review

- **Cobertura del alcance:** recorrido de 4 pasos con conectores horizontal/vertical e íconos `Calendar/Users/CreditCard/QrCode` → Task 3. Animación con `IntersectionObserver` en isla mínima, sin librerías, desactivada con reduced motion y sin contenido oculto en SSR → Task 2 (+ test SSR en Task 3 + e2e en Task 6). Bento con `landingContent.amenities`, etiquetas de vidrio, placeholders CSS/SVG e `image?` opcional con `next/image` → Tasks 1 y 4. Horario existente → Task 4. Normas vacías con TODO, renderizadas solo si hay, probadas en ambos casos → Tasks 1 y 4. Features y FinalCta intactos salvo mover el ancla; `#como-funciona` y `#precios` probados → Task 3. Todo texto por diccionario en namespaces propios (`howItWorks`, `amenities`) → Tasks 1 y 3. Unit + e2e → Tasks 2–4 y 6; verificación final → Task 7.
- **Placeholders:** ningún paso con "TBD"/"similar a"; el único `TODO` es el que pide el alcance (normas del dueño) y vive en el código, no en el plan.
- **Consistencia de nombres:** `RevealOnScroll` (prop `delayMs`), atributo `data-reveal` (`hidden`/`shown`), `data-slot="step-connector"`, `data-slot="amenity-tile"`, `data-slot="amenity-placeholder"`, `Amenity` (`id`, `image?`), `landingContent.rules`, `t.amenities.{heading, body, scheduleHeading, rulesHeading, rules}`, `t.howItWorks.details.{date, group, pay, voucher}`, anclas `#como-funciona`, `#amenidades`, `#precios`: usados igual en código, tests unitarios y e2e.
