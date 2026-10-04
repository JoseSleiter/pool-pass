# PR 06 — Booking checkout (resumen BCV, pago C2P, voucher imprimible) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir `booking-card.tsx` (~470 líneas) en componentes enfocados y mejorar el checkout de `/reservar`: desglose de precio con tasa BCV y monto en bolívares, teléfono venezolano con autoformato, selector de banco con chip de código, clave C2P con mostrar/ocultar, badges de confianza y un voucher imprimible con instrucciones y botón "Compartir por WhatsApp".

**Architecture:** `BookingCard` sigue siendo la única isla cliente con la máquina de estados (`summary | pay | pending | done`), los editores de fecha/personas, las llamadas a server actions y el manejo de errores. Cada vista pasa a su propio archivo bajo `src/components/booking/` (`summary-step`, `pay-form`, `pending-view`, `voucher`) y recibe datos + callbacks por props; las piezas reutilizables (`field`, `secret-field`, `bank-select`, `trust-badges`) son componentes presentacionales. La lógica pura (formato de teléfono, URL de compartir) vive en `src/lib/phone.ts` y `src/lib/booking/share.ts` con tests unitarios.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 (tokens de `src/app/globals.css`), lucide-react, zod 4, Vitest + Testing Library (jsdom), Playwright.

**Rama / worktree:** `feat/booking-checkout` en `/Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/booking-checkout` (ya existe, con `.env.local`). Labels del PR: `area:booking`, `ux`. Este plan **no** crea worktree, **no** hace push ni abre PR (lo hace el coordinador).

---

## Entorno de ejecución (obligatorio)

- Todos los comandos se ejecutan desde la raíz del worktree:
  `cd /Users/sleiter/Documents/SSD/myProjects/06-pool-pass/.worktrees/feat/booking-checkout`
- Node por defecto es v16. **Todo** comando npm/npx va precedido de:
  `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && `
- Supabase local ya corre y es compartido: **prohibido** `supabase start/stop/db reset/migration`. Este PR no necesita migraciones.
- Tests e2e/integración se serializan con un lock compartido:
  `L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; <cmd>; rmdir "$L"`
- `playwright.config.ts` usa `reuseExistingServer` en el puerto 3100: dentro del lock, comprobar que el puerto está libre antes de correr e2e (si otro worktree dejó un `next dev` en 3100, Playwright probaría **su** código).
- Commits conventional, terminando con línea en blanco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (se logra con un segundo `-m`).

## Propiedad de archivos (ola 2)

Este PR posee: `src/components/booking/booking-card.tsx` (+test) y archivos **nuevos** `src/components/booking/*`, `src/app/reservar/page.tsx`, `src/lib/banks.ts`, nuevo `src/lib/phone.ts`; namespaces de diccionario `booking`, `pay`, `pending`, `done`, `errors`, `validation`, nuevo `trust`.

No se editan: `date-picker-panel.tsx`, `count-row.tsx` (PR 04), `landing-content.ts` (PR 05, solo se **importa**), `globals.css`, `schemas.ts`, `qr.ts`, `e2e/*`. Ver "Desviaciones" al final.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/phone.ts` | Crear | `VE_MOBILE_PREFIXES`, `normalizeVePhone()` (lo tecleado → dígitos que espera `paymentSchema`), `formatVePhone()` (dígitos → `0414-123-4567`) |
| `src/lib/phone.test.ts` | Crear | Tablas de normalización/formato + consistencia con la regla `phone` de `paymentFields` |
| `src/lib/booking/share.ts` | Crear | `whatsappShareUrl(text)` → `https://wa.me/?text=…` sin destinatario |
| `src/lib/booking/share.test.ts` | Crear | Codificación y ausencia de número destino |
| `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts` | Modificar | Claves nuevas al final de `booking`, `pay`, `done`; namespace nuevo `trust` al final |
| `src/components/booking/field.tsx` (+test) | Crear | `Field` (movido desde booking-card) + `aria-describedby` hacia hint/error |
| `src/components/booking/summary-step.tsx` (+test) | Crear | Desglose adultos×precio, niños×precio, total USD, tasa BCV, total VES + botón Continuar |
| `src/components/booking/bank-select.tsx` (+test) | Crear | `<select>` nativo + chip con el código del banco, sin imágenes |
| `src/components/booking/secret-field.tsx` (+test) | Crear | Input enmascarado con botón mostrar/ocultar (`aria-pressed`) |
| `src/components/booking/trust-badges.tsx` (+test) | Crear | "Pago Móvil C2P · Banco Mercantil" y "Datos de pago cifrados (AES-256)" |
| `src/components/booking/pay-form.tsx` (+test) | Crear | `PayFormValues`, `EMPTY_PAY_FORM`, formulario completo (honeypot incluido) + badges + botón pagar |
| `src/components/booking/pending-view.tsx` (+test) | Crear | Vista "Pago en verificación" (movida sin cambios de texto) |
| `src/components/booking/voucher.tsx` (+test) | Crear | Ticket imprimible (`@media print`), QR alto contraste, código en negrita, instrucciones, Imprimir, Compartir por WhatsApp |
| `src/components/booking/booking-card.tsx` | Modificar | Orquestador: estado, efectos, server actions, header, editores, tiles; compone las vistas |
| `src/components/booking/booking-card.test.tsx` | Modificar | Selector de WhatsApp más específico (ahora hay dos enlaces) + tests nuevos de integración |

`src/app/reservar/page.tsx` y `src/lib/banks.ts` **no cambian** (la API de `BookingCard` se mantiene).

---

### Task 1: Helpers de teléfono venezolano (`src/lib/phone.ts`)

**Files:**
- Create: `src/lib/phone.ts`
- Test: `src/lib/phone.test.ts`

La regla de validación vive en `src/lib/schemas.ts` (`VE_PHONE = /^04(12|14|16|22|24|26)\d{7}$/`, no exportada). Para no duplicar la regex ni tocar `schemas.ts`, los tests validan contra `paymentFields.shape.phone` (sí exportado): si alguien cambia la regex, el test de consistencia falla.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/phone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatVePhone, normalizeVePhone, VE_MOBILE_PREFIXES } from './phone';
import { paymentFields } from './schemas';

const phoneRule = paymentFields.shape.phone;

describe('normalizeVePhone', () => {
  it.each([
    ['04141234567', '04141234567'],
    ['0414-123-4567', '04141234567'],
    ['(0414) 123 45 67', '04141234567'],
    ['+58 414 123 4567', '04141234567'],
    ['584141234567', '04141234567'],
    ['+58 0414 1234567', '04141234567'],
    ['4141234567', '04141234567'],
    ['041412345678999', '04141234567'],
    ['123', '123'],
    ['', ''],
    ['abc', ''],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeVePhone(raw)).toBe(expected);
  });
});

describe('formatVePhone', () => {
  it.each([
    ['', ''],
    ['0', '0'],
    ['0414', '0414'],
    ['04141', '0414-1'],
    ['0414123', '0414-123'],
    ['04141234', '0414-123-4'],
    ['04141234567', '0414-123-4567'],
    ['0414-123-4567', '0414-123-4567'],
    ['+584141234567', '0414-123-4567'],
    ['123', '123'],
  ])('%j → %j', (raw, expected) => {
    expect(formatVePhone(raw)).toBe(expected);
  });

  it('backspacing the digit after a dash also drops the dash', () => {
    // Deleting "1" from "0414-1" leaves "0414-" in the input.
    expect(formatVePhone('0414-')).toBe('0414');
    expect(formatVePhone('0414-123-')).toBe('0414-123');
  });

  it('is idempotent', () => {
    expect(formatVePhone(formatVePhone('04241234567'))).toBe('0424-123-4567');
  });
});

describe('VE_MOBILE_PREFIXES stays in sync with paymentSchema', () => {
  it('every listed prefix + 7 digits passes the schema phone rule', () => {
    for (const prefix of VE_MOBILE_PREFIXES) {
      expect(phoneRule.safeParse(`${prefix}1234567`).success, prefix).toBe(true);
    }
  });

  it('no other 04XX prefix passes (the list is complete)', () => {
    for (let n = 0; n < 100; n++) {
      const prefix = `04${String(n).padStart(2, '0')}`;
      const listed = (VE_MOBILE_PREFIXES as readonly string[]).includes(prefix);
      expect(phoneRule.safeParse(`${prefix}1234567`).success, prefix).toBe(listed);
    }
  });

  it('a formatted number normalizes to exactly what the schema accepts', () => {
    expect(phoneRule.safeParse(normalizeVePhone('0424-555-1234')).success).toBe(true);
    expect(phoneRule.safeParse('0424-555-1234').success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/phone.test.ts`
Expected: FAIL — `Failed to resolve import "./phone" from "src/lib/phone.test.ts"`.

- [ ] **Step 3: Implementación mínima**

Crear `src/lib/phone.ts`:

```ts
/**
 * Venezuelan mobile numbers for the C2P form.
 *
 * The form stores and submits the digits-only national form ("04141234567"),
 * which is what paymentSchema's phone rule accepts (src/lib/schemas.ts,
 * VE_PHONE); the input only *displays* "0414-123-4567". phone.test.ts checks
 * this list against that rule, so the two cannot drift apart.
 */
export const VE_MOBILE_PREFIXES = ['0412', '0414', '0416', '0422', '0424', '0426'] as const;

const NATIONAL_LENGTH = 11;

/**
 * Whatever the user typed, pasted or autofilled → digits-only national form.
 * - Drops spaces, dashes, dots and parentheses.
 * - "+58 414…" / "58414…" / "+58 0414…" → "0414…" (country code → trunk 0).
 * - "414…" (autofill without the trunk 0) → "0414…".
 * - Caps at 11 digits.
 */
export function normalizeVePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('58')) {
    digits = `0${digits.slice(2).replace(/^0+/, '')}`;
  } else if (digits.startsWith('4')) {
    digits = `0${digits}`;
  }
  return digits.slice(0, NATIONAL_LENGTH);
}

/** Display form, built progressively while typing: "0414", "0414-123", "0414-123-4567". */
export function formatVePhone(value: string): string {
  const d = normalizeVePhone(value);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/phone.test.ts`
Expected: PASS (todos los casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/phone.ts src/lib/phone.test.ts
git commit -m "feat(booking): add Venezuelan phone normalize/format helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: URL de compartir por WhatsApp (`src/lib/booking/share.ts`)

**Files:**
- Create: `src/lib/booking/share.ts`
- Test: `src/lib/booking/share.test.ts`

Decisión: se usa `https://wa.me/?text=…` **sin número**: WhatsApp abre su selector de contactos y el huésped decide a quién enviarlo. El texto (lo arma el voucher en Task 11) lleva solo club, fecha y código; nada de nombre, cédula, correo, montos ni el UUID/URL del QR.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/booking/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { whatsappShareUrl } from './share';

describe('whatsappShareUrl', () => {
  it('builds a wa.me link with no recipient, so the user picks the contact', () => {
    const url = new URL(whatsappShareUrl('hola'));
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/');
  });

  it('URL-encodes the text and round-trips it exactly', () => {
    const text = 'Mi pase para Complejo Turístico Villa Victoria el Sáb, 24 Oct · Código PP-AB3K9 & más';
    const href = whatsappShareUrl(text);
    expect(href).not.toContain(' ');
    expect(new URL(href).searchParams.get('text')).toBe(text);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/booking/share.test.ts`
Expected: FAIL — `Failed to resolve import "./share"`.

- [ ] **Step 3: Implementación mínima**

Crear `src/lib/booking/share.ts`:

```ts
/**
 * WhatsApp "share" link: opens WhatsApp's own contact picker with `text`
 * prefilled. Deliberately no recipient number — the guest chooses who sees it.
 * Callers decide the text; keep personal data (name, ID, email) out of it.
 */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/booking/share.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking/share.ts src/lib/booking/share.test.ts
git commit -m "feat(booking): add WhatsApp share link helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Textos nuevos en los diccionarios

**Files:**
- Modify: `src/lib/i18n/es.ts` (final de `booking`, `pay`, `done`; namespace nuevo `trust` al final del objeto)
- Modify: `src/lib/i18n/en.ts` (mismas claves)
- Test (existente): `src/lib/i18n/dictionaries.test.ts`

Reglas que verifica `dictionaries.test.ts`: mismas claves en ambos idiomas, mismos `{placeholders}`, sin strings vacíos y **ningún valor en inglés idéntico al español** (por eso el badge en inglés dice "via Banco Mercantil", no "· Banco Mercantil").

- [ ] **Step 1: Añadir las claves en `es.ts`**

En `src/lib/i18n/es.ts`, reemplazar:

```ts
    decrease: 'Disminuir {label}',
    increase: 'Aumentar {label}',
  },
```

por:

```ts
    decrease: 'Disminuir {label}',
    increase: 'Aumentar {label}',
    breakdownTitle: 'Resumen de tu compra',
    lineItem: '{label} × {count} · {price} c/u',
    totalUsd: 'Total en dólares',
    bcvRate: 'Tasa BCV del día',
    totalVes: 'Total a pagar en bolívares',
    rateAtPayment: 'El monto en bolívares se calcula con la tasa BCV del día.',
  },
```

Reemplazar:

```ts
    submit: 'Confirmar y pagar',
    submitting: 'Procesando…',
  },
```

por:

```ts
    submit: 'Confirmar y pagar',
    submitting: 'Procesando…',
    phoneHint: 'Operadoras: {prefixes}',
    // Must NOT contain "clave de pago": tests and e2e find the key input with
    // getByLabel(/clave de pago/i) and would also match this button.
    showKey: 'Mostrar clave',
  },
```

Reemplazar:

```ts
    whatsapp: '¿Dudas? Escríbenos por WhatsApp',
  },
```

por:

```ts
    whatsapp: '¿Dudas? Escríbenos por WhatsApp',
    howToEnter: 'Cómo entrar',
    step1: 'Llega el {date} con tu documento de identidad.',
    step2: 'En la entrada, muestra este código QR desde tu teléfono o impreso.',
    step3: 'El personal lo escanea, revisa tu documento y registra tu entrada.',
    print: 'Descargar / Imprimir',
    share: 'Compartir por WhatsApp',
    // Only club, date and code: no name, ID, email or amounts (see voucher.tsx).
    shareText: 'Mi pase para {club} el {date} · Código {code}',
  },
```

Reemplazar el cierre del archivo:

```ts
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
};
```

por:

```ts
    childOne: '{count} niño',
    childOther: '{count} niños',
  },
  // Both badges are literal facts (roadmap §2): Mercantil is the C2P processor
  // and the C2P fields are AES-256 encrypted (src/lib/mercantil/encrypt.ts).
  trust: {
    title: 'Seguridad del pago',
    c2pMercantil: 'Pago Móvil C2P · Banco Mercantil',
    encrypted: 'Datos de pago cifrados (AES-256)',
  },
};
```

- [ ] **Step 2: Correr el test de diccionarios y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/i18n/dictionaries.test.ts`
Expected: FAIL — `en has exactly the same nested keys as es` (faltan `booking.breakdownTitle`, …, `trust.encrypted` en `en`).

- [ ] **Step 3: Añadir las claves en `en.ts`**

En `src/lib/i18n/en.ts`, reemplazar:

```ts
    decrease: 'Decrease {label}',
    increase: 'Increase {label}',
  },
```

por:

```ts
    decrease: 'Decrease {label}',
    increase: 'Increase {label}',
    breakdownTitle: 'Your order summary',
    lineItem: '{label} × {count} · {price} each',
    totalUsd: 'Total in US dollars',
    bcvRate: "Today's BCV rate",
    totalVes: 'Total to pay in bolívares',
    rateAtPayment: "The bolívar amount is calculated at the day's BCV rate.",
  },
```

Reemplazar:

```ts
    submit: 'Confirm and pay',
    submitting: 'Processing…',
  },
```

por:

```ts
    submit: 'Confirm and pay',
    submitting: 'Processing…',
    phoneHint: 'Carriers: {prefixes}',
    showKey: 'Show key',
  },
```

Reemplazar:

```ts
    whatsapp: 'Questions? Message us on WhatsApp',
  },
```

por:

```ts
    whatsapp: 'Questions? Message us on WhatsApp',
    howToEnter: 'How to get in',
    step1: 'Arrive on {date} with your ID.',
    step2: 'At the entrance, show this QR code on your phone or printed.',
    step3: 'Staff scan it, check your ID and register your entry.',
    print: 'Download / Print',
    share: 'Share on WhatsApp',
    shareText: 'My pass for {club} on {date} · Code {code}',
  },
```

Reemplazar el cierre del archivo:

```ts
    childOne: '{count} child',
    childOther: '{count} children',
  },
};
```

por:

```ts
    childOne: '{count} child',
    childOther: '{count} children',
  },
  trust: {
    title: 'Payment security',
    c2pMercantil: 'Pago Móvil C2P via Banco Mercantil',
    encrypted: 'Payment data encrypted (AES-256)',
  },
};
```

- [ ] **Step 4: Correr tests de diccionario y typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/lib/i18n && npx tsc --noEmit`
Expected: PASS en todos los tests de `src/lib/i18n`; `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/es.ts src/lib/i18n/en.ts
git commit -m "feat(i18n): add checkout, voucher and trust copy (es/en)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Extraer `Field` a su propio archivo (con `aria-describedby`)

**Files:**
- Create: `src/components/booking/field.tsx`
- Test: `src/components/booking/field.test.tsx`
- Modify: `src/components/booking/booking-card.tsx` (borrar la función `Field` de las líneas 438–467 e importarla)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/field.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from './field';

describe('Field', () => {
  it('labels the input and reports typed values', async () => {
    const onChange = vi.fn();
    render(<Field label="Nombre" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Nombre'), 'A');
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('links the hint to the input through aria-describedby', () => {
    render(<Field label="Teléfono" value="" onChange={() => {}} hint="Operadoras: 0412" />);
    expect(screen.getByLabelText('Teléfono')).toHaveAccessibleDescription('Operadoras: 0412');
  });

  it('shows the error instead of the hint and marks the input invalid', () => {
    render(<Field label="Teléfono" value="" onChange={() => {}} hint="Operadoras: 0412" error="Teléfono inválido" />);
    const input = screen.getByLabelText('Teléfono');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Teléfono inválido');
    expect(screen.queryByText('Operadoras: 0412')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/field.test.tsx`
Expected: FAIL — `Failed to resolve import "./field"`.

- [ ] **Step 3: Crear `field.tsx`**

Crear `src/components/booking/field.tsx`:

```tsx
'use client';

import { useId } from 'react';

/** Labelled text input of the payment form. The hint/error below it is its accessible description. */
export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
  autoComplete?: string;
}) {
  const noteId = useId();
  const hasNote = Boolean(props.error || props.hint);
  return (
    <div>
      <label className="block rounded-xl border border-border bg-card px-4 py-2.5">
        <span className="block text-xs font-medium text-muted-foreground">{props.label}</span>
        <input
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={hasNote ? noteId : undefined}
          className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
      </label>
      {props.error && <p id={noteId} className="mt-1 text-xs text-destructive">{props.error}</p>}
      {props.hint && !props.error && <p id={noteId} className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Usarlo desde `booking-card.tsx`**

En `src/components/booking/booking-card.tsx`:
1. Borrar por completo la función `function Field(props: { … }) { … }` (desde la línea `function Field(props: {` hasta el `}` final del archivo).
2. Añadir el import después de `import { CountRow } from '@/components/booking/count-row';`:

```tsx
import { Field } from '@/components/booking/field';
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking`
Expected: PASS — `field.test.tsx` (3) y `booking-card.test.tsx` (8, sin cambios).

- [ ] **Step 6: Commit**

```bash
git add src/components/booking/field.tsx src/components/booking/field.test.tsx src/components/booking/booking-card.tsx
git commit -m "refactor(booking): extract Field and describe inputs by their hint" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `SummaryStep` — desglose con tasa BCV y total en bolívares

**Files:**
- Create: `src/components/booking/summary-step.tsx`
- Test: `src/components/booking/summary-step.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/summary-step.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { SummaryStep } from './summary-step';

const prices = { adult: 15, child: 5 };

describe('SummaryStep', () => {
  it('breaks the total down per ticket type, with BCV rate and final VES amount', () => {
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={36.5} onContinue={() => {}} />);
    const breakdown = screen.getByTestId('price-breakdown');
    expect(within(breakdown).getByText('Adultos × 2 · $15.00 c/u')).toBeInTheDocument();
    expect(within(breakdown).getByText('$30.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('Niños × 1 · $5.00 c/u')).toBeInTheDocument();
    expect(within(breakdown).getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByTestId('breakdown-total-usd')).toHaveTextContent('$35.00 USD');
    expect(screen.getByTestId('breakdown-rate')).toHaveTextContent('Bs. 36.50 / $');
    expect(screen.getByTestId('breakdown-total-ves')).toHaveTextContent('Bs. 1277.50');
  });

  it('omits ticket types with zero people', () => {
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 3, children: 0 }} rate={36.5} onContinue={() => {}} />);
    expect(screen.queryByText(/Niños ×/)).not.toBeInTheDocument();
    expect(screen.getByTestId('breakdown-total-usd')).toHaveTextContent('$45.00 USD');
  });

  it('without a rate yet, explains the VES amount instead of inventing one', () => {
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={null} onContinue={() => {}} />);
    expect(screen.queryByTestId('breakdown-total-ves')).not.toBeInTheDocument();
    expect(screen.getByText(/se calcula con la tasa BCV del día/i)).toBeInTheDocument();
  });

  it('renders in English', () => {
    renderWithI18n(
      <SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={36.5} onContinue={() => {}} />,
      { locale: 'en' }
    );
    expect(screen.getByText('Adults × 2 · $15.00 each')).toBeInTheDocument();
    expect(screen.getByText('Total to pay in bolívares')).toBeInTheDocument();
  });

  it('calls onContinue from the Continuar button', async () => {
    const onContinue = vi.fn();
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={null} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/summary-step.test.tsx`
Expected: FAIL — `Failed to resolve import "./summary-step"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/summary-step.tsx`:

```tsx
'use client';

import { useId } from 'react';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { interpolate } from '@/lib/i18n/format';
import { roundMoney, totalUsd, usdToVes } from '@/lib/money';

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * State 1 of the checkout: what the guest is buying and what it costs in
 * bolívares at today's BCV rate. `rate` is null while it loads (or if the
 * lookup failed): then we say how the amount is computed, never a made-up one.
 */
export function SummaryStep(props: {
  prices: { adult: number; child: number };
  party: { adults: number; children: number };
  rate: number | null;
  onContinue: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const { adults, children } = props.party;
  const total = totalUsd(adults, children, props.prices);
  const lines = [
    { key: 'adults', label: t.booking.adults, count: adults, price: props.prices.adult },
    { key: 'children', label: t.booking.children, count: children, price: props.prices.child },
  ].filter((line) => line.count > 0);

  return (
    <>
      <section aria-labelledby={titleId} className="mt-5 rounded-2xl bg-muted p-5">
        <h2 id={titleId} className="font-heading text-lg font-semibold">{t.booking.breakdownTitle}</h2>
        <dl data-testid="price-breakdown" className="mt-3 divide-y divide-border text-sm">
          {lines.map((line) => (
            <div key={line.key} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-muted-foreground">
                {interpolate(t.booking.lineItem, { label: line.label, count: line.count, price: usd(line.price) })}
              </dt>
              <dd className="font-semibold tabular-nums">{usd(roundMoney(line.count * line.price))}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="font-semibold">{t.booking.totalUsd}</dt>
            <dd data-testid="breakdown-total-usd" className="font-heading text-lg font-semibold tabular-nums">
              {usd(total)} USD
            </dd>
          </div>
          {props.rate !== null && (
            <>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{t.booking.bcvRate}</dt>
                <dd data-testid="breakdown-rate" className="font-semibold tabular-nums">
                  Bs. {props.rate.toFixed(2)} / $
                </dd>
              </div>
              <div className="-mx-3 flex items-baseline justify-between gap-4 rounded-xl bg-secondary px-3 py-3">
                <dt className="font-semibold text-secondary-foreground">{t.booking.totalVes}</dt>
                <dd data-testid="breakdown-total-ves" className="font-heading text-xl font-bold text-secondary-foreground tabular-nums">
                  Bs. {usdToVes(total, props.rate).toFixed(2)}
                </dd>
              </div>
            </>
          )}
        </dl>
        {props.rate === null && (
          <p className="mt-2 text-xs text-muted-foreground">{t.booking.rateAtPayment}</p>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={props.onContinue}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          {t.booking.continue}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/summary-step.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/summary-step.tsx src/components/booking/summary-step.test.tsx
git commit -m "feat(booking): add summary step with BCV rate and VES breakdown" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `BankSelect` — selector con chip de código, sin logos

**Files:**
- Create: `src/components/booking/bank-select.tsx`
- Test: `src/components/booking/bank-select.test.tsx`

Se mantiene el `<select>` nativo con `aria-label="Banco"` (accesible, usable en móvil y es lo que usan `booking-card.test.tsx` y `e2e/booking.spec.ts` vía `selectOption('0134')`, que selecciona por `value`). El chip a la izquierda muestra el código del banco elegido. Las opciones pasan a mostrar solo el nombre (el código ya está en el chip).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/bank-select.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { BankSelect } from './bank-select';

function Harness() {
  const [value, setValue] = useState('');
  return <BankSelect value={value} onChange={setValue} />;
}

describe('BankSelect', () => {
  it('shows an empty chip until a bank is chosen, then its code', async () => {
    renderWithI18n(<Harness />);
    expect(screen.getByTestId('bank-chip')).toHaveTextContent('····');
    await userEvent.selectOptions(screen.getByLabelText(/^banco$/i), '0105');
    expect(screen.getByTestId('bank-chip')).toHaveTextContent('0105');
    expect(screen.getByRole('option', { name: 'Banco Mercantil' })).toHaveProperty('selected', true);
  });

  it('uses no third-party logos (roadmap §2: code chip instead of bank images)', () => {
    const { container } = renderWithI18n(<Harness />);
    expect(container.querySelector('img, svg image')).toBeNull();
  });

  it('shows the validation error', () => {
    renderWithI18n(<BankSelect value="" onChange={() => {}} error="Banco requerido" />);
    expect(screen.getByText('Banco requerido')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/bank-select.test.tsx`
Expected: FAIL — `Failed to resolve import "./bank-select"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/bank-select.tsx`:

```tsx
'use client';

import { VENEZUELAN_BANKS } from '@/lib/banks';
import { useT } from '@/lib/i18n/provider';

/**
 * Native <select> (accessible, mobile-friendly, and what the e2e suite drives
 * by value) plus a chip with the chosen bank's 4-digit code. No bank logos:
 * we do not ship third-party trademarks (roadmap §2).
 */
export function BankSelect(props: { value: string; onChange: (code: string) => void; error?: string }) {
  const t = useT();
  const bank = VENEZUELAN_BANKS.find((b) => b.code === props.value);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2.5">
      <span className="block text-xs font-medium text-muted-foreground">{t.pay.bank}</span>
      <div className="flex min-h-11 items-center gap-3">
        <span
          aria-hidden="true"
          data-testid="bank-chip"
          className={`inline-flex h-8 min-w-14 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-sm font-bold tabular-nums ${
            bank ? 'bg-navy text-white' : 'bg-muted text-muted-foreground'
          }`}
        >
          {bank ? bank.code : '····'}
        </span>
        <select
          aria-label={t.pay.bank}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="min-h-11 w-full cursor-pointer bg-transparent py-1 font-semibold text-navy outline-none"
        >
          <option value="">{t.pay.bankPlaceholder}</option>
          {VENEZUELAN_BANKS.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
      </div>
      {props.error && <p className="text-xs text-destructive">{props.error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/bank-select.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/bank-select.tsx src/components/booking/bank-select.test.tsx
git commit -m "feat(booking): bank selector with code chip instead of logos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `SecretField` — clave C2P enmascarada con mostrar/ocultar

**Files:**
- Create: `src/components/booking/secret-field.tsx`
- Test: `src/components/booking/secret-field.test.tsx`

Patrón WAI-ARIA de botón conmutador: etiqueta **constante** ("Mostrar clave") y estado en `aria-pressed`. El `<label>` envuelve solo el texto (no el botón) para que `getByLabelText(/clave de pago/i)` devuelva únicamente el input.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/secret-field.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretField } from './secret-field';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <SecretField
      label="Clave de Pago (C2P)"
      toggleLabel="Mostrar clave"
      value={value}
      onChange={setValue}
      hint="Genera la clave C2P desde la app de tu banco antes de pagar."
    />
  );
}

describe('SecretField', () => {
  it('is masked by default and the toggle reveals and re-masks it, keeping the value', async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/clave de pago/i);
    const toggle = screen.getByRole('button', { name: 'Mostrar clave' });
    await userEvent.type(input, '123456');

    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(input).toHaveValue('123456');

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('the field label matches only the input, never the toggle', () => {
    render(<Harness />);
    expect(screen.getAllByLabelText(/clave de pago/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Mostrar clave' })).toHaveAttribute(
      'aria-controls',
      screen.getByLabelText(/clave de pago/i).id
    );
  });

  it('describes the input with the hint and keeps a 44px touch target on the toggle', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/clave de pago/i)).toHaveAccessibleDescription(/genera la clave c2p/i);
    expect(screen.getByRole('button', { name: 'Mostrar clave' }).className).toMatch(/\bh-11\b.*\bw-11\b/);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/secret-field.test.tsx`
Expected: FAIL — `Failed to resolve import "./secret-field"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/secret-field.tsx`:

```tsx
'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Masked input with a show/hide toggle (WAI-ARIA toggle button: constant
 * label, state in aria-pressed). The <label> wraps only the text so the
 * field's label never names the button; keep `toggleLabel` free of the
 * field label's words for the same reason.
 */
export function SecretField(props: {
  label: string;
  toggleLabel: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const [visible, setVisible] = useState(false);
  const hasNote = Boolean(props.error || props.hint);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card py-2.5 pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
            {props.label}
          </label>
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            aria-invalid={props.error ? true : undefined}
            aria-describedby={hasNote ? noteId : undefined}
            className="w-full bg-transparent py-1 font-semibold tracking-widest text-navy outline-none"
          />
        </div>
        <button
          type="button"
          aria-label={props.toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {props.error && <p id={noteId} className="mt-1 text-xs text-destructive">{props.error}</p>}
      {props.hint && !props.error && <p id={noteId} className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/secret-field.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/secret-field.tsx src/components/booking/secret-field.test.tsx
git commit -m "feat(booking): masked C2P key field with accessible show/hide toggle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `TrustBadges`

**Files:**
- Create: `src/components/booking/trust-badges.tsx`
- Test: `src/components/booking/trust-badges.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/trust-badges.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithI18n } from '@/test/i18n';
import { TrustBadges } from './trust-badges';

describe('TrustBadges', () => {
  it('lists the two factual badges in Spanish', () => {
    renderWithI18n(<TrustBadges />);
    const list = screen.getByRole('list', { name: 'Seguridad del pago' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Pago Móvil C2P · Banco Mercantil',
      'Datos de pago cifrados (AES-256)',
    ]);
  });

  it('translates to English', () => {
    renderWithI18n(<TrustBadges />, { locale: 'en' });
    expect(screen.getByText('Pago Móvil C2P via Banco Mercantil')).toBeInTheDocument();
    expect(screen.getByText('Payment data encrypted (AES-256)')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/trust-badges.test.tsx`
Expected: FAIL — `Failed to resolve import "./trust-badges"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/trust-badges.tsx`:

```tsx
'use client';

import { Lock, Smartphone } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

/**
 * Only literal facts (roadmap §2): Banco Mercantil is the C2P processor
 * (src/lib/mercantil/client.ts) and the document, phone and C2P key are
 * AES-256-CBC encrypted before they are sent (src/lib/mercantil/encrypt.ts).
 * If either stops being true, change the copy.
 */
export function TrustBadges() {
  const t = useT();
  const badges = [
    { key: 'c2p', Icon: Smartphone, text: t.trust.c2pMercantil },
    { key: 'aes', Icon: Lock, text: t.trust.encrypted },
  ];
  return (
    <ul aria-label={t.trust.title} className="mt-4 flex flex-wrap justify-center gap-2">
      {badges.map(({ key, Icon, text }) => (
        <li
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/trust-badges.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/trust-badges.tsx src/components/booking/trust-badges.test.tsx
git commit -m "feat(booking): add C2P/Mercantil and AES-256 trust badges" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `PayForm` — formulario de pago completo

**Files:**
- Create: `src/components/booking/pay-form.tsx`
- Test: `src/components/booking/pay-form.test.tsx`

`PayForm` es presentacional: recibe `values` + `onChange(key, value)` y no llama server actions. El teléfono se **guarda** normalizado (`04141234567`) y se **muestra** formateado (`0414-123-4567`). El honeypot se mueve sin cambios.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/pay-form.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { PayForm, EMPTY_PAY_FORM, type PayFormErrors, type PayFormValues } from './pay-form';

function Harness(props: { onSubmit?: (v: PayFormValues) => void; errors?: PayFormErrors; submitting?: boolean }) {
  const [values, setValues] = useState<PayFormValues>(EMPTY_PAY_FORM);
  return (
    <PayForm
      values={values}
      onChange={(key, value) => setValues((f) => ({ ...f, [key]: value }))}
      errors={props.errors ?? {}}
      submitting={props.submitting ?? false}
      onSubmit={() => props.onSubmit?.(values)}
    />
  );
}

describe('PayForm', () => {
  it('formats the phone while typing but keeps the digits-only value', async () => {
    const onSubmit = vi.fn();
    renderWithI18n(<Harness onSubmit={onSubmit} />);
    const phone = screen.getByLabelText(/teléfono/i);
    await userEvent.type(phone, '04141234567');
    expect(phone).toHaveValue('0414-123-4567');
    await userEvent.click(screen.getByRole('button', { name: /confirmar y pagar/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ phone: '04141234567' }));
  });

  it('normalizes a pasted international number', async () => {
    renderWithI18n(<Harness />);
    const phone = screen.getByLabelText(/teléfono/i);
    await userEvent.click(phone);
    await userEvent.paste('+58 424 555 1234');
    expect(phone).toHaveValue('0424-555-1234');
  });

  it('lists the accepted operators as the phone hint', () => {
    renderWithI18n(<Harness />);
    expect(screen.getByLabelText(/teléfono/i)).toHaveAccessibleDescription(
      'Operadoras: 0412, 0414, 0416, 0422, 0424, 0426'
    );
  });

  it('keeps the honeypot off-screen and out of the tab order', () => {
    renderWithI18n(<Harness />);
    const honeypot = screen.getByLabelText(/no llenar este campo/i);
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows translated validation messages from error keys', () => {
    renderWithI18n(<Harness errors={{ phone: 'invalidPhone', bankCode: 'bankRequired', otp: 'pinRequired' }} />);
    expect(screen.getByText('Teléfono venezolano inválido (04XX...)')).toBeInTheDocument();
    expect(screen.getByText('Banco requerido')).toBeInTheDocument();
    expect(screen.getByText('Clave requerida')).toBeInTheDocument();
  });

  it('shows the trust badges and the masked C2P key with its toggle', () => {
    renderWithI18n(<Harness />);
    expect(screen.getByRole('list', { name: 'Seguridad del pago' })).toBeInTheDocument();
    expect(screen.getByLabelText(/clave de pago/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar clave' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables the pay button while submitting', () => {
    renderWithI18n(<Harness submitting />);
    expect(screen.getByRole('button', { name: /procesando/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/pay-form.test.tsx`
Expected: FAIL — `Failed to resolve import "./pay-form"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/pay-form.tsx`:

```tsx
'use client';

import { Lock } from 'lucide-react';
import { Field } from '@/components/booking/field';
import { SecretField } from '@/components/booking/secret-field';
import { BankSelect } from '@/components/booking/bank-select';
import { TrustBadges } from '@/components/booking/trust-badges';
import { useT } from '@/lib/i18n/provider';
import { interpolate } from '@/lib/i18n/format';
import type { ValidationKey } from '@/lib/i18n/validation';
import { formatVePhone, normalizeVePhone, VE_MOBILE_PREFIXES } from '@/lib/phone';

export type IdType = 'V' | 'E' | 'P' | 'J';
const ID_TYPES: readonly IdType[] = ['V', 'E', 'P', 'J'];

export interface PayFormValues {
  firstName: string;
  lastName: string;
  email: string;
  idType: IdType;
  idNumber: string;
  /** Digits only ("04141234567"): the shape paymentSchema validates. Displayed formatted. */
  phone: string;
  bankCode: string;
  otp: string;
  /** Honeypot: real users leave it empty; the server drops the request otherwise. */
  website: string;
}

export const EMPTY_PAY_FORM: PayFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  idType: 'V',
  idNumber: '',
  phone: '',
  bankCode: '',
  otp: '',
  website: '',
};

/** Dictionary keys (not strings), so a language switch re-translates errors already on screen. */
export type PayFormErrors = Partial<Record<string, ValidationKey>>;

/** State 2 of the checkout. Presentational: BookingCard owns the values and the submit. */
export function PayForm(props: {
  values: PayFormValues;
  onChange: <K extends keyof PayFormValues>(key: K, value: PayFormValues[K]) => void;
  errors: PayFormErrors;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const t = useT();
  const { values, onChange } = props;

  function fieldError(field: keyof PayFormValues): string | undefined {
    const key = props.errors[field];
    return key ? t.validation[key] : undefined;
  }

  return (
    <>
      <div className="mt-5 rounded-2xl bg-muted p-5">
        <h2 className="font-heading text-xl font-semibold">{t.pay.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.pay.intro}</p>

        {/* Honeypot: hidden from real users, catches naive bots. Do not remove. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            {t.pay.honeypot}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(e) => onChange('website', e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.pay.firstName} value={values.firstName} onChange={(v) => onChange('firstName', v)} error={fieldError('firstName')} autoComplete="given-name" />
            <Field label={t.pay.lastName} value={values.lastName} onChange={(v) => onChange('lastName', v)} error={fieldError('lastName')} autoComplete="family-name" />
          </div>
          <Field label={t.pay.email} value={values.email} onChange={(v) => onChange('email', v)} error={fieldError('email')} type="email" autoComplete="email" />

          <div className="rounded-xl border border-border bg-card px-4 py-2.5">
            <span className="block text-xs font-medium text-muted-foreground">{t.pay.idLabel}</span>
            <div className="flex items-center gap-2">
              <select
                aria-label={t.pay.idType}
                value={values.idType}
                onChange={(e) => onChange('idType', e.target.value as IdType)}
                className="-ml-1 bg-transparent py-1 font-semibold text-navy outline-none"
              >
                {ID_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <span className="text-muted-foreground">·</span>
              <input
                aria-label={t.pay.idNumber}
                inputMode="numeric"
                value={values.idNumber}
                onChange={(e) => onChange('idNumber', e.target.value)}
                placeholder="12345678"
                className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </div>
            {fieldError('idNumber') && <p className="text-xs text-destructive">{fieldError('idNumber')}</p>}
          </div>

          <Field
            label={t.pay.phone}
            value={formatVePhone(values.phone)}
            onChange={(v) => onChange('phone', normalizeVePhone(v))}
            error={fieldError('phone')}
            type="tel"
            placeholder="0414-123-4567"
            inputMode="tel"
            autoComplete="tel"
            hint={interpolate(t.pay.phoneHint, { prefixes: VE_MOBILE_PREFIXES.join(', ') })}
          />

          <BankSelect value={values.bankCode} onChange={(code) => onChange('bankCode', code)} error={fieldError('bankCode')} />

          <SecretField
            label={t.pay.otp}
            toggleLabel={t.pay.showKey}
            value={values.otp}
            onChange={(v) => onChange('otp', v)}
            error={fieldError('otp')}
            hint={t.pay.otpHint}
          />
        </div>
      </div>

      <TrustBadges />

      <button
        type="button"
        onClick={props.onSubmit}
        disabled={props.submitting}
        className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        {props.submitting ? t.pay.submitting : t.pay.submit}
        {!props.submitting && <Lock className="h-4 w-4" aria-hidden="true" />}
      </button>
    </>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/pay-form.test.tsx`
Expected: PASS (7 tests). Si el test de tipeo del teléfono deja el cursor en mitad del valor (síntoma: valor desordenado como `0414-123-4576`), revisar que `formatVePhone` se aplique en `value` y `normalizeVePhone` en `onChange` exactamente como arriba; React reasigna el valor y jsdom mueve el cursor al final.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/pay-form.tsx src/components/booking/pay-form.test.tsx
git commit -m "feat(booking): pay form with formatted VE phone, bank chip and C2P toggle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `PendingView` (movida sin cambios de texto)

**Files:**
- Create: `src/components/booking/pending-view.tsx`
- Test: `src/components/booking/pending-view.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/pending-view.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test/i18n';
import { PendingView } from './pending-view';

describe('PendingView', () => {
  it('tells the guest the payment is being verified and not to retry', () => {
    renderWithI18n(<PendingView />);
    expect(screen.getByRole('heading', { name: /pago en verificación/i })).toBeInTheDocument();
    expect(screen.getByText(/tu pago está siendo verificado/i)).toBeInTheDocument();
    expect(screen.getByText(/no intentes pagar de nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders in English', () => {
    renderWithI18n(<PendingView />, { locale: 'en' });
    expect(screen.getByRole('heading', { name: /payment being verified/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/pending-view.test.tsx`
Expected: FAIL — `Failed to resolve import "./pending-view"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/pending-view.tsx` (markup idéntico al bloque `view === 'pending'` actual de `booking-card.tsx`):

```tsx
'use client';

import { useT } from '@/lib/i18n/provider';

/**
 * State 3b: the bank has not confirmed yet. No buttons on purpose — a retry
 * could charge twice. The server always sends the same sentence; the
 * dictionary holds it in both languages (pending.message).
 */
export function PendingView() {
  const t = useT();
  return (
    <div className="mt-5 rounded-2xl bg-amber-50 p-6 text-center ring-1 ring-amber-200">
      <div className="text-4xl" aria-hidden="true">⏳</div>
      <h2 className="mt-2 font-heading text-xl font-semibold text-amber-900">{t.pending.title}</h2>
      <p className="mt-2 text-sm text-amber-800">{t.pending.message}</p>
      <p className="mt-2 text-sm text-amber-800">{t.pending.doNotRetry}</p>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/pending-view.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/pending-view.tsx src/components/booking/pending-view.test.tsx
git commit -m "refactor(booking): extract the payment-pending view" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `Voucher` — ticket imprimible, QR alto contraste, instrucciones, Imprimir y WhatsApp

**Files:**
- Create: `src/components/booking/voucher.tsx`
- Test: `src/components/booking/voucher.test.tsx`

Decisiones:
- **Impresión:** un `<style>` con `@media print` vive dentro del voucher (no en `globals.css`, que no es de este PR). Oculta con `display:none` todo lo que no es el ticket ni lo contiene (`:has()`), y quita padding/sombras a los ancestros, así solo sale el ticket y sin páginas en blanco. "Descargar" = el diálogo de impresión del navegador permite "Guardar como PDF"; no se genera PDF propio.
- **QR alto contraste:** el PNG ya es negro sobre blanco puro (`qrcode` por defecto, `src/lib/qr.ts`, no se toca). Se muestra a 208 px sobre fondo blanco con margen y `image-rendering: pixelated` para bordes nítidos al escalar o imprimir.
- **WhatsApp:** texto = club + fecha + código. Se excluyen nombre, cédula, correo, montos y el UUID/URL del QR. El código por sí solo no permite entrar (en la puerta se escanea el QR y se revisa el documento del titular), y el huésped elige el destinatario. Se conserva además el enlace "¿Dudas? Escríbenos por WhatsApp" al número del club.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/booking/voucher.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { shortDateLabel } from '@/lib/dates';
import { whatsappUrl } from '@/lib/landing-content';
import { Voucher } from './voucher';

const props = {
  reservation: {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    code: 'PP-AB3K9',
    totalUsd: 35,
    totalVes: 1277.5,
    bcvRate: 36.5,
  },
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Pérez',
  idLabel: 'V-12345678',
  date: '2026-10-24',
  party: { adults: 2, children: 1 },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Voucher', () => {
  it('renders the ticket with bold code, QR from /api/qr and the guest details', () => {
    renderWithI18n(<Voucher {...props} />);
    const ticket = screen.getByRole('article', { name: /pase del día/i });
    expect(within(ticket).getByTestId('reservation-code')).toHaveTextContent('PP-AB3K9');
    expect(within(ticket).getByTestId('reservation-code').className).toMatch(/font-bold/);
    const qr = within(ticket).getByAltText(/código qr/i);
    expect(qr).toHaveAttribute('src', `/api/qr/${props.reservation.id}`);
    expect(qr).toHaveAttribute('width', '208');
    expect(ticket).toHaveTextContent('Ana Pérez');
    expect(ticket).toHaveTextContent('V-12345678');
    expect(ticket).toHaveTextContent('$35.00 USD · Bs. 1277.50');
  });

  it('lists three entry steps, the first with the visit date', () => {
    renderWithI18n(<Voucher {...props} />);
    const steps = within(screen.getByRole('list', { name: /cómo entrar/i })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(`Llega el ${shortDateLabel(props.date, 'es')} con tu documento de identidad.`);
  });

  it('prints with window.print, and the print stylesheet keeps only the ticket', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderWithI18n(<Voucher {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /descargar \/ imprimir/i }));
    expect(print).toHaveBeenCalledOnce();

    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toContain('@media print');
    expect(css).toContain('[data-print-ticket]');
    const ticket = screen.getByRole('article', { name: /pase del día/i });
    expect(ticket).toHaveAttribute('data-print-ticket');
    expect(within(ticket).queryByRole('button')).not.toBeInTheDocument();
    expect(within(ticket).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shares only club, date and code on WhatsApp (no recipient, no personal data)', () => {
    renderWithI18n(<Voucher {...props} />);
    const link = screen.getByRole('link', { name: /compartir por whatsapp/i });
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/');
    const text = url.searchParams.get('text')!;
    expect(text).toBe(
      `Mi pase para Complejo Turístico Villa Victoria el ${shortDateLabel(props.date, 'es')} · Código PP-AB3K9`
    );
    for (const secret of ['Ana', 'Pérez', '12345678', 'ana@example.com', '1277', props.reservation.id]) {
      expect(text).not.toContain(secret);
    }
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps the help link to the club WhatsApp', () => {
    renderWithI18n(<Voucher {...props} />);
    expect(screen.getByRole('link', { name: /escríbenos por whatsapp/i })).toHaveAttribute('href', whatsappUrl());
  });

  it('renders in English', () => {
    renderWithI18n(<Voucher {...props} />, { locale: 'en' });
    expect(screen.getByRole('button', { name: /download \/ print/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /share on whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /how to get in/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/voucher.test.tsx`
Expected: FAIL — `Failed to resolve import "./voucher"`.

- [ ] **Step 3: Implementación**

Crear `src/components/booking/voucher.tsx`:

```tsx
'use client';

import { useId } from 'react';
import Image from 'next/image';
import { Printer, Share2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';
import { shortDateLabel } from '@/lib/dates';
import { landingContent, whatsappUrl } from '@/lib/landing-content';
import { whatsappShareUrl } from '@/lib/booking/share';
import type { BookingResult } from '@/lib/booking/process';

export type ConfirmedReservation = Extract<BookingResult, { ok: true }>['reservation'];

/**
 * Print only the ticket. Lives with the voucher (not in globals.css) so the
 * rule ships and dies with it. Everything that neither is nor contains the
 * ticket is removed from the print layout; the ticket's ancestors lose their
 * padding and shadows so it lands at the top of the first page.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  body *:not(:has([data-print-ticket])):not([data-print-ticket]):not([data-print-ticket] *) {
    display: none !important;
  }
  body *:has([data-print-ticket]) {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background: none !important;
    max-width: none !important;
  }
  [data-print-ticket] {
    margin: 0 auto !important;
    box-shadow: none !important;
    border: 1px solid var(--navy) !important;
  }
  [data-print-ticket], [data-print-ticket] * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;

/** State 4 of the checkout: the confirmed pass, printable and shareable. */
export function Voucher(props: {
  reservation: ConfirmedReservation;
  email: string;
  firstName: string;
  lastName: string;
  idLabel: string;
  date: string;
  party: { adults: number; children: number };
}) {
  const t = useT();
  const locale = useLocale();
  const stepsTitleId = useId();
  const { reservation } = props;
  const dateLabel = shortDateLabel(props.date, locale);
  // Club, date and code only: no name, ID, email, amounts or the QR's UUID.
  // The guest picks the recipient, and the code alone does not get anyone in
  // (the gate scans the QR and checks the holder's ID).
  const shareHref = whatsappShareUrl(
    interpolate(t.done.shareText, { club: landingContent.clubName, date: dateLabel, code: reservation.code })
  );
  const steps = [interpolate(t.done.step1, { date: dateLabel }), t.done.step2, t.done.step3];

  return (
    <div className="mt-5 rounded-2xl bg-muted p-6 text-center">
      <style>{PRINT_CSS}</style>
      <p className="font-heading text-xl font-semibold">{t.done.confirmed}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t.done.sentTo} <strong className="text-navy">{props.email}</strong>.{' '}
        {t.done.showAtEntrance}
      </p>

      <article
        data-print-ticket=""
        aria-label={t.done.dayPass}
        className="mx-auto mt-5 max-w-sm overflow-hidden rounded-2xl bg-card text-left ring-1 ring-border"
      >
        <div className="bg-navy p-5 text-center text-white">
          {/* The margin belongs on this wrapper, not on Logo's className:
              that lands on the img inside the chip. */}
          <div className="mb-3 flex justify-center">
            <Logo variant="chip" className="h-9 w-auto" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-teal-soft">{t.done.dayPass}</p>
          <p data-testid="reservation-code" className="mt-1 font-heading text-4xl font-bold tracking-[0.12em]">
            {reservation.code}
          </p>
        </div>

        <div className="p-5">
          <div className="mx-auto w-fit rounded-xl bg-white p-3 ring-2 ring-navy">
            <Image
              unoptimized
              src={`/api/qr/${reservation.id}`}
              alt={t.done.qrAlt}
              width={208}
              height={208}
              className="block [image-rendering:pixelated]"
            />
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <p><strong>{t.done.name}</strong> {props.firstName} {props.lastName}</p>
            <p><strong>{t.done.document}</strong> {props.idLabel}</p>
            <p><strong>{t.done.date}</strong> {dateLabel}</p>
            <p><strong>{t.done.attendees}</strong> {formatParty(t.party, props.party.adults, props.party.children)}</p>
            <p><strong>{t.done.paid}</strong> ${reservation.totalUsd.toFixed(2)} USD · Bs. {reservation.totalVes.toFixed(2)}</p>
          </div>

          <div className="mt-5 border-t border-dashed border-border pt-4">
            <h2 id={stepsTitleId} className="font-heading text-base font-semibold">{t.done.howToEnter}</h2>
            <ol aria-labelledby={stepsTitleId} className="mt-2 list-none space-y-2 text-sm">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-bold text-navy"
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </article>

      <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-navy px-6 text-sm font-semibold text-white"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t.done.print}
        </button>
        <a
          href={shareHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-navy"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t.done.share}
        </a>
      </div>

      <a
        href={whatsappUrl()}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-secondary-foreground underline-offset-4 hover:underline"
      >
        {t.done.whatsapp}
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/voucher.test.tsx`
Expected: PASS (6 tests). Nota: `getByRole('list', { name: /cómo entrar/i })` usa `aria-labelledby` del `<ol>`; si jsdom no calcula el nombre, verificar que el `id` del `h2` coincide con `aria-labelledby`.

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/voucher.tsx src/components/booking/voucher.test.tsx
git commit -m "feat(booking): printable voucher with entry steps and WhatsApp share" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `BookingCard` compone las vistas (máquina de estados intacta)

**Files:**
- Modify: `src/components/booking/booking-card.tsx` (reescritura completa)
- Modify: `src/components/booking/booking-card.test.tsx` (reescritura completa: tests existentes + nuevos)

Qué se conserva idéntico: props de `BookingCard`, estados `summary | pay | pending | done` y `editing`, `goToPay`, guard de cero asistentes, validación con `paymentSchema` + `validationKey`, honeypot enviado como `website`, `submitBookingAndPay`, ramas `capacity` (alerta + editor de fecha + `getAvailability`), `payment_declined` (alerta + borra la clave), `payment_pending` (vista pending), `default` (alerta), header, editores y tiles.

Único cambio de comportamiento: `getCurrentRate()` ahora también se llama en la vista `summary` (antes solo en `pay`), porque el desglose del resumen necesita la tasa. Sigue llamándose una sola vez mientras `rate` no sea null.

Cambio de selector intencional en el test unitario: el test del voucher usaba `getByRole('link', { name: /whatsapp/i })`; ahora hay dos enlaces con "WhatsApp" (compartir y ayuda), así que se consulta cada uno por su nombre específico. Los e2e (`e2e/booking.spec.ts`, `e2e/i18n.spec.ts`) **no** cambian: siguen valiendo `/^nombre$/`, `/apellido/`, `/correo/`, `/número de documento/`, `/teléfono/` (`fill('04141234567')` se normaliza a lo mismo), `/^banco$/` + `selectOption('0134')` por value, `/clave de pago/`, `/confirmar y pagar/`, `/reserva confirmada/`, `reservation-code`, `/pago rechazado/`, `/no hay cupo suficiente/`, `/fecha de visita/`, `/^listo$/`.

- [ ] **Step 1: Escribir los tests (existentes + nuevos)**

Reemplazar el contenido de `src/components/booking/booking-card.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { BookingCard } from './booking-card';

vi.mock('@/app/actions/booking', () => ({
  submitBookingAndPay: vi.fn(),
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => 36.5),
}));

import { submitBookingAndPay, getCurrentRate } from '@/app/actions/booking';

const prices = { adult: 15, child: 5 };
const user = userEvent.setup();

const confirmed = {
  ok: true as const,
  reservation: {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    code: 'PP-ABC12',
    totalUsd: 35,
    totalVes: 1277.5,
    bcvRate: 36.5,
  },
};

function renderCard() {
  return renderWithI18n(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />);
}

async function goToPay() {
  await user.click(screen.getByRole('button', { name: /continuar/i }));
}

async function fillPaymentAndConfirm() {
  await user.type(screen.getByLabelText(/^nombre$/i), 'Ana');
  await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
  await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
  await user.type(screen.getByLabelText(/número de documento/i), '12345678');
  await user.type(screen.getByLabelText(/teléfono/i), '04141234567');
  await user.selectOptions(screen.getByLabelText(/banco/i), '0102');
  await user.type(screen.getByLabelText(/clave de pago/i), '123456');
  await user.click(screen.getByRole('button', { name: /confirmar y pagar/i }));
}

describe('BookingCard', () => {
  beforeEach(() => {
    vi.mocked(submitBookingAndPay).mockReset();
    vi.mocked(getCurrentRate).mockClear();
  });

  it('shows the default party total in the summary (2 adultos · 1 niño = $35)', () => {
    renderCard();
    expect(screen.getByTestId('total-usd')).toHaveTextContent('$35 USD');
  });

  it('recalculates the total when adjusting the people stepper', async () => {
    renderCard();
    await user.click(screen.getByRole('button', { name: /personas/i }));
    await user.click(screen.getByRole('button', { name: /aumentar adultos/i })); // 3 adultos · 1 niño
    await user.click(screen.getByRole('button', { name: /listo/i }));
    expect(screen.getByTestId('total-usd')).toHaveTextContent('$50 USD'); // 3*15 + 5
  });

  it('shows the price breakdown with the BCV rate and the VES total on the summary', async () => {
    renderCard();
    expect(await screen.findByTestId('breakdown-total-ves')).toHaveTextContent('Bs. 1277.50');
    expect(screen.getByTestId('breakdown-rate')).toHaveTextContent('Bs. 36.50 / $');
    expect(screen.getByTestId('breakdown-total-usd')).toHaveTextContent('$35.00 USD');
    expect(getCurrentRate).toHaveBeenCalledTimes(1);
  });

  it('shows the estimated VES total on the payment step (rate fetched on transition)', async () => {
    renderCard();
    await goToPay();
    // $35 at rate 36.5 → Bs. 1277.50
    expect(await screen.findByText(/Bs\. 1277\.50/)).toBeInTheDocument();
    expect(screen.getByText(/tasa 36\.50/)).toBeInTheDocument();
  });

  it('blocks payment with an invalid phone and shows the message', async () => {
    renderCard();
    await goToPay();
    await user.type(screen.getByLabelText(/^nombre$/i), 'Ana');
    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/número de documento/i), '12345678');
    await user.type(screen.getByLabelText(/teléfono/i), '123');
    await user.selectOptions(screen.getByLabelText(/banco/i), '0102');
    await user.type(screen.getByLabelText(/clave de pago/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirmar y pagar/i }));
    expect(submitBookingAndPay).not.toHaveBeenCalled();
    expect(await screen.findByText(/teléfono venezolano inválido/i)).toBeInTheDocument();
  });

  it('submits the phone as digits only (schema shape) plus the empty honeypot', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue(confirmed);
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    await screen.findByTestId('reservation-code');
    expect(submitBookingAndPay).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '04141234567', bankCode: '0102', otp: '123456', website: '' })
    );
  });

  it('payment_declined: shows the bank reason and clears only the C2P key', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({ ok: false, error: 'payment_declined', message: 'Clave vencida' });
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Pago rechazado: Clave vencida');
    expect(screen.getByLabelText(/clave de pago/i)).toHaveValue('');
    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0414-123-4567');
  });

  it('locks the form on payment_pending: verification screen, no pay button', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({
      ok: false,
      error: 'payment_pending',
      message: 'Tu pago está siendo verificado. Te contactaremos con la confirmación.',
    });
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByText(/pago en verificación/i)).toBeInTheDocument();
    expect(screen.getByText(/no intentes pagar de nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar y pagar/i })).not.toBeInTheDocument();
  });

  it('shows the ticket-style confirmation with pass code, QR and WhatsApp links after payment', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue(confirmed);
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByTestId('reservation-code')).toHaveTextContent('PP-ABC12');
    expect(screen.getByAltText(/código qr/i)).toBeInTheDocument();
    // Two WhatsApp links since PR 06 (share the pass + ask the club), so each is
    // queried by its own name instead of the old /whatsapp/i.
    expect(screen.getByRole('link', { name: /compartir por whatsapp/i })).toHaveAttribute(
      'href',
      expect.stringContaining('PP-ABC12')
    );
    expect(screen.getByRole('link', { name: /escríbenos por whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar \/ imprimir/i })).toBeInTheDocument();
  });

  it('renders in English and shows English validation messages', async () => {
    renderWithI18n(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />, { locale: 'en' });
    expect(screen.getByText('Spots left today: 40')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /details to confirm your booking/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^first name$/i), 'Ana');
    await user.type(screen.getByLabelText(/last name/i), 'Pérez');
    await user.type(screen.getByLabelText(/^email$/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/document number/i), '12345678');
    await user.type(screen.getByLabelText(/^phone$/i), '123');
    await user.selectOptions(screen.getByLabelText(/^bank$/i), '0102');
    await user.type(screen.getByLabelText(/c2p payment key/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));
    expect(submitBookingAndPay).not.toHaveBeenCalled();
    expect(await screen.findByText(/invalid venezuelan phone number/i)).toBeInTheDocument();
  });

  it('translates a capacity failure from the server in English', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({ ok: false, error: 'capacity', remaining: 1 });
    renderWithI18n(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />, { locale: 'en' });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/^first name$/i), 'Ana');
    await user.type(screen.getByLabelText(/last name/i), 'Pérez');
    await user.type(screen.getByLabelText(/^email$/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/document number/i), '12345678');
    await user.type(screen.getByLabelText(/^phone$/i), '04141234567');
    await user.selectOptions(screen.getByLabelText(/^bank$/i), '0102');
    await user.type(screen.getByLabelText(/c2p payment key/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('spots left: 1');
    expect(screen.getByRole('heading', { name: /when are you coming/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan los nuevos**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking/booking-card.test.tsx`
Expected: FAIL en 4 tests — `shows the price breakdown…` (no existe `breakdown-total-ves`), `payment_declined…` (el teléfono muestra `04141234567`, no `0414-123-4567`), `shows the ticket-style confirmation…` (no existe el enlace "Compartir por WhatsApp"), y `submits the phone…` puede pasar ya (el valor tecleado ya era de solo dígitos). Los demás pasan.

- [ ] **Step 3: Reescribir `booking-card.tsx`**

Reemplazar el contenido de `src/components/booking/booking-card.tsx` por:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, Users, ShieldCheck } from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import { SummaryStep } from '@/components/booking/summary-step';
import { PayForm, EMPTY_PAY_FORM, type PayFormErrors, type PayFormValues } from '@/components/booking/pay-form';
import { PendingView } from '@/components/booking/pending-view';
import { Voucher, type ConfirmedReservation } from '@/components/booking/voucher';
import {
  getAvailability,
  getCurrentRate,
  submitBookingAndPay,
} from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import { visitLabel } from '@/lib/dates';
import { paymentSchema } from '@/lib/schemas';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';
import { validationKey } from '@/lib/i18n/validation';
import { submitErrorMessage, type SubmitFailure } from '@/lib/i18n/booking-errors';

type View = 'summary' | 'pay' | 'pending' | 'done';
type Editing = null | 'date' | 'people';

/**
 * Checkout state machine: summary → pay → (pending | done). Owns all state,
 * the server-action calls and the error handling; each view is presentational
 * (summary-step, pay-form, pending-view, voucher).
 */
export function BookingCard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
  remaining: number;
  startAtPay?: boolean;
  initialDate?: string;
  initialAdults?: number;
  initialChildren?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<View>(props.startAtPay ? 'pay' : 'summary');
  const [editing, setEditing] = useState<Editing>(null);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [date, setDate] = useState(props.initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [adults, setAdults] = useState(props.initialAdults ?? 2);
  const [children, setChildren] = useState(props.initialChildren ?? 1);
  const [form, setForm] = useState<PayFormValues>(EMPTY_PAY_FORM);
  const [rate, setRate] = useState<number | null>(null);
  // Errors are kept as dictionary keys / raw failures, not strings: a language
  // switch (router.refresh keeps client state) then re-renders them translated.
  const [errors, setErrors] = useState<PayFormErrors>({});
  const [submitFailure, setSubmitFailure] = useState<SubmitFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<ConfirmedReservation | null>(null);

  const usd = totalUsd(adults, children, props.prices);
  const attendeeCount = adults + children;
  const remaining = props.remaining;

  function setField<K extends keyof PayFormValues>(key: K, value: PayFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Fetch the BCV rate on the summary (price breakdown) and payment views
  // while we don't have it yet.
  useEffect(() => {
    if ((view === 'summary' || view === 'pay') && rate === null) {
      getCurrentRate().then(setRate).catch(() => setRate(null));
    }
  }, [view, rate]);

  function goToPay() {
    if (attendeeCount === 0) {
      setEditing('people');
      return;
    }
    setView('pay');
  }

  async function confirmAndPay() {
    if (adults + children === 0) {
      setSubmitFailure({ ok: false, error: 'no_attendees' });
      setEditing('people');
      return;
    }
    const { website, ...fields } = form;
    const payload = { date, adults, children, ...fields };
    const parsed = paymentSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: PayFormErrors = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = validationKey(issue);
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitFailure(null);
    setSubmitting(true);
    // Include the honeypot in the raw payload; the schema strips it but the
    // server drops the request if a bot filled it.
    const result = await submitBookingAndPay({ ...parsed.data, website });
    setSubmitting(false);
    if (result.ok) {
      setReservation(result.reservation);
      setView('done');
      return;
    }
    switch (result.error) {
      case 'capacity':
        setSubmitFailure(result);
        setEditing('date');
        getAvailability(date.slice(0, 7)).then(setAvailability);
        break;
      case 'payment_declined':
        setSubmitFailure(result);
        setField('otp', '');
        break;
      case 'payment_pending':
        // The server always sends the same sentence; the dictionary holds it
        // in both languages (pending.message).
        setView('pending');
        break;
      default:
        setSubmitFailure(result);
    }
  }

  const showTiles = (view === 'summary' || view === 'pay') && editing === null;

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-card p-6 text-navy shadow-2xl shadow-navy-deep/10 ring-1 ring-border sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {view === 'done' ? t.booking.titleDone : t.booking.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === 'done' ? t.booking.subtitleDone : t.booking.subtitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t.booking.securePayment}
        </span>
      </div>

      {view !== 'pending' && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary-foreground">
          <span className={`h-2 w-2 rounded-full ${remaining > 0 ? 'bg-teal' : 'bg-destructive'}`} />
          {remaining > 0
            ? interpolate(t.booking.slotsToday, { count: remaining })
            : t.booking.noSlotsToday}
        </p>
      )}

      {submitFailure && view !== 'done' && view !== 'pending' && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {submitErrorMessage(submitFailure, t)}
        </p>
      )}

      {/* ---- DATE EDITOR ---- */}
      {editing === 'date' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h2 className="font-heading text-xl font-semibold">{t.booking.whenTitle}</h2>
          <div className="mt-4">
            <DatePickerPanel
              date={date}
              availability={availability}
              onSelect={(d) => setDate(d)}
              onMonthChange={(m) => getAvailability(m).then(setAvailability)}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">{t.booking.onlyAvailableDays}</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              {t.booking.done}
            </button>
          </div>
        </div>
      )}

      {/* ---- PEOPLE EDITOR ---- */}
      {editing === 'people' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h2 className="font-heading text-xl font-semibold">{t.booking.whoTitle}</h2>
          <div className="mt-4 space-y-3">
            <CountRow
              label={t.booking.adults}
              hint={interpolate(t.booking.perPerson, { price: `$${props.prices.adult.toFixed(0)}` })}
              value={adults}
              onChange={setAdults}
              testId="adults-count"
            />
            <CountRow
              label={t.booking.children}
              hint={interpolate(t.booking.perPerson, { price: `$${props.prices.child.toFixed(0)}` })}
              value={children}
              onChange={setChildren}
              testId="children-count"
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">{t.booking.totalUpdates}</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              {t.booking.done}
            </button>
          </div>
        </div>
      )}

      {/* ---- TILES (summary + pay) ---- */}
      {showTiles && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setEditing('date')}
            className="cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.booking.visitDate}</p>
                <p className="mt-1 font-heading text-lg font-semibold">{visitLabel(date, locale)}</p>
              </div>
              <CalendarCheck className="h-5 w-5 text-teal" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => setEditing('people')}
            className="cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.booking.people}</p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {formatParty(t.party, adults, children) || t.booking.chooseAttendees}
                </p>
              </div>
              <Users className="h-5 w-5 text-teal" />
            </div>
          </button>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-xs font-medium text-secondary-foreground/70">{t.booking.estimatedTotal}</p>
            <p data-testid="total-usd" className="mt-1 font-heading text-2xl font-semibold text-secondary-foreground">${usd.toFixed(0)} USD</p>
            {view === 'pay' && rate !== null && (
              <p className="mt-0.5 text-xs text-secondary-foreground/80">
                {interpolate(t.booking.rateLine, {
                  ves: usdToVes(usd, rate).toFixed(2),
                  rate: rate.toFixed(2),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'summary' && editing === null && (
        <SummaryStep prices={props.prices} party={{ adults, children }} rate={rate} onContinue={goToPay} />
      )}

      {view === 'pay' && editing === null && (
        <PayForm values={form} onChange={setField} errors={errors} submitting={submitting} onSubmit={confirmAndPay} />
      )}

      {view === 'pending' && <PendingView />}

      {view === 'done' && reservation && (
        <Voucher
          reservation={reservation}
          email={form.email}
          firstName={form.firstName}
          lastName={form.lastName}
          idLabel={`${form.idType}-${form.idNumber}`}
          date={date}
          party={{ adults, children }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr toda la suite de booking y verificar que pasa**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run src/components/booking src/lib/phone.test.ts src/lib/booking src/lib/i18n`
Expected: PASS — `booking-card.test.tsx` (12 tests) y el resto de archivos de las tasks anteriores.

- [ ] **Step 5: Typecheck y lint**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint`
Expected: sin errores. Si `react-hooks/set-state-in-effect` marca el `useEffect` del rate, es el mismo patrón que ya existía (setState dentro de `.then`, asíncrono): no cambiarlo sin entender la regla.

- [ ] **Step 6: Commit**

```bash
git add src/components/booking/booking-card.tsx src/components/booking/booking-card.test.tsx
git commit -m "refactor(booking): compose checkout views from focused components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Comprobar que `booking-card.tsx` ya no es monolítico**

Run: `wc -l src/components/booking/*.tsx`
Expected: `booking-card.tsx` ≈ 250 líneas; ningún componente nuevo > 200.

- [ ] **Step 2: Typecheck, lint, unit tests y build**

Run: `source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: `tsc` sin salida; lint sin errores; Vitest todo en verde; `next build` termina con la tabla de rutas (incluye `/reservar` como `ƒ (Dynamic)`).

- [ ] **Step 3: E2E con lock (Supabase compartido, puerto 3100 libre)**

Run:

```bash
L=/private/tmp/claude-501/-Users-sleiter-Documents-SSD-myProjects-06-pool-pass/6f91c513-a9cb-4091-a1db-5b552a8e7cea/scratchpad/supabase.lock; until mkdir "$L" 2>/dev/null; do sleep 5; done; if lsof -ti :3100 >/dev/null; then echo "PORT 3100 BUSY: another dev server would be reused"; else source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run test:e2e; fi; rmdir "$L"
```

Expected: `booking.spec.ts` (3), `i18n.spec.ts` (1) y `landing.spec.ts` en verde. Si sale `PORT 3100 BUSY`, esperar a que el otro worktree libere el puerto y repetir (no matar procesos ajenos).

- [ ] **Step 4: Revisión manual rápida (opcional pero recomendada)**

Con `npm run dev`, en `/reservar`: (a) el resumen muestra el desglose y la tasa BCV; (b) en el pago, teclear `04141234567` muestra `0414-123-4567`; el chip del banco cambia al elegir; el ojo muestra/oculta la clave; (c) tras un pago mock (`MERCANTIL_MOCK=1`, clave `123456`), "Descargar / Imprimir" abre la vista previa con **solo** el ticket; "Compartir por WhatsApp" abre `wa.me/?text=…` con club, fecha y código.

- [ ] **Step 5: Estado limpio**

Run: `git status --short`
Expected: vacío (todo commiteado en las tasks anteriores). No hacer push ni abrir PR.

---

## Desviaciones y decisiones

1. **`getCurrentRate()` también en la vista `summary`.** Antes solo se pedía al entrar a `pay`. El desglose del resumen (requisito) necesita la tasa. Se sigue pidiendo una única vez mientras `rate === null`; si falla, el resumen explica que el monto en Bs. se calcula con la tasa del día (sin inventar cifras).
2. **Test unitario del voucher:** `getByRole('link', { name: /whatsapp/i })` pasa a dos consultas específicas (`/compartir por whatsapp/i`, `/escríbenos por whatsapp/i`) porque ahora hay dos enlaces. Cambio intencional. Los e2e no cambian.
3. **Opciones del banco:** el texto pasa de `0102 — Banco de Venezuela` a solo el nombre; el código va en el chip. Tests y e2e seleccionan por `value`, no se ven afectados.
4. **Placeholder del teléfono:** `04141234567` → `0414-123-4567`. El valor enviado sigue siendo de solo dígitos; además se aceptan `+58…` y números sin el 0 inicial (autofill).
5. **CSS de impresión inline en `voucher.tsx`** (no en `globals.css`, que no es de este PR). Usa `:has()` (Chrome 105+, Safari 15.4+, Firefox 121+).
6. **`src/lib/booking/share.ts`** es un archivo nuevo fuera de la tabla de propiedad (sin riesgo de conflicto). `landing-content.ts` (PR 05) solo se importa (`clubName`, `whatsappUrl`), no se edita.
7. **`schemas.ts` y `qr.ts` no se tocan:** la consistencia del teléfono se prueba contra `paymentFields.shape.phone`, y el QR ya es negro sobre blanco.
8. **Sin cambios en `src/app/reservar/page.tsx` ni `src/lib/banks.ts`:** la API de `BookingCard` es la misma.

## Preguntas abiertas

- **Contenido del mensaje de WhatsApp:** club + fecha + código. Se excluyeron nombre, cédula, correo, montos y el UUID del QR. Si el dueño quiere incluir un enlace al sitio, se añade un `{url}` a `done.shareText`.
- **Cursor al editar en mitad del teléfono:** al reformatear, el cursor salta al final (aceptable para 11 dígitos; se corrige con manejo de `selectionStart` si molesta).
- **"Descargar" = imprimir/guardar como PDF del navegador.** Generar un PDF/PNG propio quedaría para un PR aparte.

## Self-review

- **Cobertura del alcance:** dividir booking-card (Tasks 4–12); desglose adultos/niños/total USD/tasa BCV/total VES (Task 5); teléfono con autoformato y valor normalizado + `src/lib/phone.ts` con tests (Tasks 1, 9); selector de banco con chip de código sin logos (Task 6); clave C2P con mostrar/ocultar, `aria-pressed` y etiqueta accesible (Task 7); badges de confianza (Task 8); voucher imprimible con `@media print`, QR alto contraste, código en negrita, instrucciones paso a paso, botón Descargar/Imprimir y Compartir por WhatsApp (Tasks 2, 11); honeypot, mensajes de validación i18n y manejo de capacity/declined/pending idénticos (Tasks 9, 12, con tests); textos por diccionario en namespaces propios (Task 3); tests existentes y e2e en verde (Tasks 12–13).
- **Placeholders:** ningún TBD/TODO; cada paso con código o comando completo.
- **Consistencia de tipos/nombres:** `PayFormValues`, `EMPTY_PAY_FORM`, `PayFormErrors`, `IdType` (Task 9) usados igual en Task 12; `ConfirmedReservation` (Task 11) en Task 12; `party: { adults, children }` en `SummaryStep` y `Voucher`; `normalizeVePhone`, `formatVePhone`, `VE_MOBILE_PREFIXES` (Task 1) en Task 9; `whatsappShareUrl` (Task 2) en Task 11; claves `booking.breakdownTitle|lineItem|totalUsd|bcvRate|totalVes|rateAtPayment`, `pay.phoneHint|showKey`, `done.howToEnter|step1|step2|step3|print|share|shareText`, `trust.title|c2pMercantil|encrypted` (Task 3) son las que leen los componentes; test ids `price-breakdown`, `breakdown-total-usd`, `breakdown-rate`, `breakdown-total-ves`, `bank-chip`, `reservation-code`, `total-usd` coinciden entre componentes y tests.
