# Identidad de marca — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminar el rebrand a *Complejo Turístico Villa Victoria*: el logo real en sitio, voucher y email; el QR del correo como adjunto `cid:` para que Gmail deje de bloquearlo; metadatos, iconos y datos de contacto reales.

**Architecture:** Un script versionado (`scripts/build-brand-assets.mjs`) genera todos los assets desde la foto del cartel físico, así que no hay binarios sin receta. Un componente `<Logo>` centraliza la decisión visual. La generación del QR se extrae de la ruta HTTP a `src/lib/qr.ts` para que la ruta y el email compartan una sola implementación.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, sharp (devDependency, ya instalada), nodemailer, @react-email/components, qrcode, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-31-brand-identity-design.md`

**Convenciones del repo (leer antes de empezar):**
- Tests de componentes: primera línea `// @vitest-environment jsdom`. El entorno por defecto de vitest es `node`.
- Test único: `npx vitest run <ruta> -t "<nombre>"`. Suite completa: `npm test`. Typecheck: `npx tsc --noEmit`.
- Alias `@` → `src/`. `server-only` está stubbeado en tests vía `src/test/server-only-stub.ts`.
- Helpers existentes que se reutilizan: `visitLabelEs`, `shortDateEs` (`@/lib/dates`); `partyLabel` (`@/lib/party`); `landingContent`, `whatsappUrl` (`@/lib/landing-content`).
- Commits frecuentes, uno por tarea. Terminar cada mensaje de commit con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

---

## Mapa de archivos

**Generación de assets**
- Create: `scripts/build-brand-assets.mjs` — recorta la foto y escribe todos los assets.
- Create (generados): `public/brand/logo.png`, `public/brand/logo-mark.png`, `public/icon-192.png` (sobrescribe), `public/icon-512.png` (sobrescribe), `src/app/icon.png`, `src/lib/email/logo-data.ts`.
- Delete: `src/app/favicon.ico`, `public/icon.svg`.

**Componente de marca**
- Create: `src/components/brand/logo.tsx` + `src/components/brand/logo.test.tsx`.
- Modify: `src/components/landing/site-header.tsx`, `src/components/landing/site-footer.tsx`.

**QR compartido**
- Create: `src/lib/qr.ts` + `src/lib/qr.test.ts`.
- Modify: `src/app/api/qr/[id]/route.ts`.

**Email**
- Create: `src/lib/email/voucher-text.ts`.
- Modify: `src/lib/email/voucher-template.tsx`, `src/lib/email/send.ts`, `src/lib/email/send.test.ts`, `src/lib/email/voucher-template.test.tsx`.

**Resto**
- Modify: `src/components/booking/booking-card.tsx` (logo en el voucher en pantalla).
- Modify: `src/app/layout.tsx`, `src/app/manifest.ts`.
- Modify: `src/lib/landing-content.ts`, `src/lib/landing-content.test.ts`.
- Modify: `src/components/landing/hero.tsx` *(Tarea 9, bloqueada por la foto)*.

---

## Task 1: Script de generación de assets

**Files:**
- Create: `scripts/build-brand-assets.mjs`
- Delete: `src/app/favicon.ico`, `public/icon.svg`

- [ ] **Step 1: Confirmar que la fuente está en su sitio**

Run: `ls -l assets/brand-source/logo-cartel.jpg`
Expected: el archivo existe, ~165 KB. Si no está, detenerse: sin la fuente el script no puede correr.

- [ ] **Step 2: Crear `scripts/build-brand-assets.mjs`**

```js
#!/usr/bin/env node
/**
 * Regenerates every brand asset from the source photograph of the physical sign.
 *
 *   node scripts/build-brand-assets.mjs
 *
 * The source is a photo, not a vector file: the logo sits on a marble pedestal
 * against a flat #F7F7F7 backdrop. The backdrop comes off with a flood fill
 * from the borders; the pedestal is keyed out of the bottom strip by colour.
 * See docs/superpowers/specs/2026-08-31-brand-identity-design.md for why the
 * cutout is done this way and what it costs.
 */
import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'assets/brand-source/logo-cartel.jpg');

/** Backdrop colour of the source photo, sampled at all four corners. */
const BACKDROP = [247, 247, 247];
const BACKDROP_TOLERANCE = 30;

/** Row where the marble pedestal starts. Above it there is nothing to key. */
const PEDESTAL_TOP = 615;

/**
 * Window over the sun + figures + waves cluster, in source coordinates.
 * The full lockup is ~1.7:1, so at favicon sizes its wordmark is unreadable.
 * This cluster is the part of the logo that still reads at 32px.
 */
const MARK_WINDOW = { left: 988, top: 292, width: 335, height: 505 };

/** Width of the logo embedded in the voucher email, in px. Keep it modest:
 *  the PNG ships base64-encoded inside a TypeScript module. */
const EMAIL_LOGO_WIDTH = 360;

async function cutout() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const count = width * height;
  const opaque = new Uint8Array(count).fill(1);

  const isBackdrop = (i) =>
    Math.abs(data[i] - BACKDROP[0]) <= BACKDROP_TOLERANCE &&
    Math.abs(data[i + 1] - BACKDROP[1]) <= BACKDROP_TOLERANCE &&
    Math.abs(data[i + 2] - BACKDROP[2]) <= BACKDROP_TOLERANCE;

  // 1. Flood fill inward from every border pixel. Only backdrop that is
  //    connected to an edge goes, so light areas enclosed by the logo survive.
  const queue = [];
  const seen = new Uint8Array(count);
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
  while (queue.length) {
    const p = queue.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isBackdrop(p * channels)) continue;
    opaque[p] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) queue.push(p - 1);
    if (x < width - 1) queue.push(p + 1);
    if (y > 0) queue.push(p - width);
    if (y < height - 1) queue.push(p + width);
  }

  // 2. Key the marble out of the bottom strip. Marble is warm (r >= b) and
  //    desaturated; every logo element down there is either saturated (the
  //    greens, the purple) or cool (the blue wave, the teal figure).
  for (let y = PEDESTAL_TOP; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!opaque[p]) continue;
      const i = p * channels;
      const chroma =
        Math.max(data[i], data[i + 1], data[i + 2]) -
        Math.min(data[i], data[i + 1], data[i + 2]);
      if (chroma < 77 && data[i] >= data[i + 2] - 5) opaque[p] = 0;
    }
  }

  for (let p = 0; p < count; p++) data[p * channels + 3] = opaque[p] ? 255 : 0;
  return { data, width, height, channels };
}

/** A fresh sharp pipeline over the cutout. Pipelines are single-use. */
function pipeline(cut) {
  const { data, width, height, channels } = cut;
  return sharp(Buffer.from(data), { raw: { width, height, channels } });
}

/** Tight bounding box of the non-transparent pixels. */
function bounds({ data, width, height, channels }) {
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Centres a region inside a transparent square. */
function squarePadding(window) {
  const side = Math.max(window.width, window.height) + 40;
  const left = Math.round((side - window.width) / 2);
  const top = Math.round((side - window.height) / 2);
  return {
    top,
    left,
    bottom: side - window.height - top,
    right: side - window.width - left,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  };
}

async function main() {
  const cut = await cutout();
  const box = bounds(cut);
  await mkdir(path.join(ROOT, 'public/brand'), { recursive: true });

  // Full lockup, trimmed to its own bounds.
  const lockup = await pipeline(cut)
    .extract(box)
    .resize({ width: 1240 })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(ROOT, 'public/brand/logo.png'), lockup.data);

  // Square mark, transparent.
  const markPng = await pipeline(cut)
    .extract(MARK_WINDOW)
    .extend(squarePadding(MARK_WINDOW))
    .png()
    .toBuffer();
  await sharp(markPng)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, 'public/brand/logo-mark.png'));

  // App icons: the mark on white. Next serves src/app/icon.png automatically.
  for (const [file, size] of [
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
    ['src/app/icon.png', 512],
  ]) {
    await sharp(markPng)
      .resize(size, size, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, file));
  }

  // Email logo, flattened on white: some older clients paint PNG transparency
  // black. Ships as base64 inside a module because public/ is not reliably
  // present in a Vercel serverless bundle.
  const emailLogo = await pipeline(cut)
    .extract(box)
    .resize({ width: EMAIL_LOGO_WIDTH })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await writeFile(
    path.join(ROOT, 'src/lib/email/logo-data.ts'),
    '// Generated by scripts/build-brand-assets.mjs — do not edit by hand.\n' +
      '// Attached to the voucher email as a cid: image.\n' +
      `export const LOGO_PNG_BASE64 =\n  '${emailLogo.toString('base64')}';\n`
  );

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(`logo.png          ${lockup.info.width}x${lockup.info.height}  ${kb(lockup.data.length)}`);
  console.log(`logo-mark.png     512x512`);
  console.log(`email logo        ${EMAIL_LOGO_WIDTH}px wide, ${kb(emailLogo.length)} raw / ${kb(emailLogo.toString('base64').length)} base64`);
  console.log(`\nPut these dimensions in src/components/brand/logo.tsx:`);
  console.log(`  LOGO_WIDTH = ${lockup.info.width}, LOGO_HEIGHT = ${lockup.info.height}`);
  for (const f of ['public/icon-192.png', 'public/icon-512.png', 'src/app/icon.png']) {
    console.log(`${f.padEnd(18)}${kb((await stat(path.join(ROOT, f))).size)}`);
  }
}

main();
```

- [ ] **Step 3: Correr el script**

Run: `node scripts/build-brand-assets.mjs`
Expected: imprime las dimensiones de `logo.png` (aproximadamente `1240x724`), el peso del logo de email, y la línea `LOGO_WIDTH = ..., LOGO_HEIGHT = ...`. **Anotar esos dos números: la Tarea 2 los necesita.**

Si el logo de email supera ~60 KB en base64, bajar `EMAIL_LOGO_WIDTH` a `300` y volver a correr.

- [ ] **Step 4: Inspeccionar los assets a ojo**

Abrir `public/brand/logo.png` y `public/icon-192.png`.

Verificar: el pedestal de mármol desapareció; el fondo es transparente en `logo.png`; el mark cuadrado muestra el sol, las figuras y las olas, sin fragmentos de letras del wordmark.

Si aparece un pedazo de letra en el mark, correr el script de nuevo tras ajustar `MARK_WINDOW.left` unos píxeles hacia la derecha.

- [ ] **Step 5: Borrar los iconos genéricos que quedaron obsoletos**

```bash
git rm src/app/favicon.ico public/icon.svg
```

`public/icon.svg` no está referenciado desde ningún lado (verificado con grep sobre `src/`, `public/` y `next.config.ts`). `favicon.ico` lo reemplaza `src/app/icon.png`, que Next detecta automáticamente y expone con su propio `<link>`. El costo: una petición directa a `/favicon.ico` pasa a dar 404, cosa que los navegadores modernos no hacen porque usan el `<link>`.

- [ ] **Step 6: Verificar que el build de tipos sigue limpio**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-brand-assets.mjs public/brand public/icon-192.png public/icon-512.png src/app/icon.png src/lib/email/logo-data.ts
git commit -m "$(cat <<'EOF'
feat(brand): generate logo assets from the sign photo

Adds a committed script that cuts the logo out of the photograph of the
physical sign: flood-fills the flat backdrop, then keys the marble pedestal
out of the bottom strip by colour. No binary lands without its recipe.

Drops the generic pool icon.svg and favicon.ico in favour of src/app/icon.png.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Componente `<Logo>`

**Files:**
- Create: `src/components/brand/logo.tsx`
- Test: `src/components/brand/logo.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/brand/logo.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from './logo';

describe('Logo', () => {
  it('names the club in its alt text', () => {
    render(<Logo />);
    expect(screen.getByAltText('Complejo Turístico Villa Victoria')).toBeInTheDocument();
  });

  it('wraps the mark in a white chip when asked', () => {
    const { container } = render(<Logo variant="chip" />);
    expect(container.firstElementChild).toHaveClass('bg-white');
  });

  it('renders no chip by default', () => {
    const { container } = render(<Logo />);
    expect(container.firstElementChild).not.toHaveClass('bg-white');
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/components/brand/logo.test.tsx`
Expected: FAIL — no existe `./logo`.

- [ ] **Step 3: Crear `src/components/brand/logo.tsx`**

Sustituir `1240` y `724` por los números que imprimió el script en la Tarea 1, Step 3.

```tsx
import Image from 'next/image';
import { landingContent } from '@/lib/landing-content';

/**
 * Intrinsic size of public/brand/logo.png. Printed by
 * scripts/build-brand-assets.mjs; update both if the source photo changes.
 */
const LOGO_WIDTH = 1240;
const LOGO_HEIGHT = 724;

/**
 * The club's logo.
 *
 * The mark is multicoloured on a light ground by design: its dark green tree
 * and navy mountain disappear against the site's navy. `chip` sets it on a
 * white pill so it stays legible there without recolouring it.
 */
export function Logo({
  variant = 'plain',
  className = 'h-11 w-auto',
  priority = false,
}: {
  variant?: 'chip' | 'plain';
  className?: string;
  priority?: boolean;
}) {
  const image = (
    <Image
      src="/brand/logo.png"
      alt={landingContent.clubName}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={className}
      priority={priority}
    />
  );

  if (variant === 'plain') return image;

  return (
    <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm">
      {image}
    </span>
  );
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run src/components/brand/logo.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/brand
git commit -m "$(cat <<'EOF'
feat(brand): add Logo component with chip variant

One place owns how the logo is presented. The chip variant sets the
multicoloured mark on white so it stays legible against the site's navy.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Logo en header y footer

**Files:**
- Modify: `src/components/landing/site-header.tsx`
- Modify: `src/components/landing/site-footer.tsx`

- [ ] **Step 1: Reemplazar el wordmark de texto del header**

En `src/components/landing/site-header.tsx`, cambiar el import y el contenido del `<Link href="/">`.

Import: sustituir `import { landingContent } from '@/lib/landing-content';` por:

```tsx
import { Logo } from '@/components/brand/logo';
```

Y el `<Link>` de la marca pasa de renderizar `{landingContent.clubName}` a:

```tsx
        <Link href="/" aria-label="Inicio">
          <Logo variant="chip" className="h-10 w-auto sm:h-11" priority />
        </Link>
```

El `aria-label` es necesario: el enlace ya no tiene texto propio, solo la imagen. `priority` porque el logo está en el primer viewport.

- [ ] **Step 2: Reemplazar el wordmark de texto del footer**

En `src/components/landing/site-footer.tsx`, agregar al bloque de imports:

```tsx
import { Logo } from '@/components/brand/logo';
```

Y sustituir el `<span>` de la marca:

```tsx
        <span className="font-heading text-base font-semibold uppercase tracking-[0.18em] text-white">
          {landingContent.clubName}
        </span>
```

por:

```tsx
        <Logo variant="chip" className="h-12 w-auto" />
```

`landingContent` sigue usándose en el footer para dirección, horario, WhatsApp e Instagram, así que su import se queda.

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint src/components/landing`
Expected: sin errores. Si eslint marca `landingContent` sin usar en `site-header.tsx`, es que quedó el import viejo: borrarlo.

- [ ] **Step 4: Correr la suite completa**

Run: `npm test`
Expected: todo verde. Ningún test existente afirma sobre el texto de la marca en header o footer.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/site-header.tsx src/components/landing/site-footer.tsx
git commit -m "$(cat <<'EOF'
feat(brand): show the logo in header and footer

Drops the text wordmark from both: the logo already contains the name,
so rendering both duplicated it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extraer la generación del QR a `src/lib/qr.ts`

La ruta HTTP y el email deben producir el mismo QR. Hoy la generación vive dentro de la ruta y el email apunta a una URL remota.

**Files:**
- Create: `src/lib/qr.ts`
- Test: `src/lib/qr.test.ts`
- Modify: `src/app/api/qr/[id]/route.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/qr.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkInUrl, qrPngBuffer } from './qr';

const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('qr', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
  });

  it('builds the check-in url for a reservation', () => {
    expect(checkInUrl(ID)).toBe(`https://app.test/admin/checkin/${ID}`);
  });

  it('encodes that url as PNG bytes', async () => {
    const png = await qrPngBuffer(ID);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(png.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/lib/qr.test.ts`
Expected: FAIL — no existe `./qr`.

- [ ] **Step 3: Crear `src/lib/qr.ts`**

```ts
import QRCode from 'qrcode';

/** Absolute check-in URL encoded in a reservation's QR code. */
export function checkInUrl(reservationId: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/admin/checkin/${reservationId}`;
}

/**
 * PNG bytes of a reservation's check-in QR.
 *
 * Shared by GET /api/qr/[id] and the voucher email so the code the guest is
 * shown and the code the gate scans cannot drift apart.
 */
export async function qrPngBuffer(reservationId: string): Promise<Buffer> {
  return QRCode.toBuffer(checkInUrl(reservationId), { width: 360, margin: 1 });
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run src/lib/qr.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Hacer que la ruta consuma el módulo**

Reemplazar el contenido completo de `src/app/api/qr/[id]/route.ts` por:

```ts
import { qrPngBuffer } from '@/lib/qr';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response('Bad request', { status: 400 });
  const png = await qrPngBuffer(id);
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
```

- [ ] **Step 6: Verificar que el test de la ruta sigue verde**

Run: `npx vitest run src/app/api/qr/qr-route.test.ts`
Expected: PASS, 2 tests. Este test es la red de seguridad de que la extracción no cambió el comportamiento de la ruta.

- [ ] **Step 7: Commit**

```bash
git add src/lib/qr.ts src/lib/qr.test.ts "src/app/api/qr/[id]/route.ts"
git commit -m "$(cat <<'EOF'
refactor(qr): extract QR generation out of the route

The voucher email is about to need the same PNG. Sharing one function keeps
the code the guest is shown and the code the gate scans from drifting apart.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Email — QR y logo como `cid:`, texto plano, asunto con fecha

El cambio de fondo del proyecto. Hoy el QR va como URL remota y Gmail lo bloquea por defecto: el cliente recibe el pase sin su código.

**Files:**
- Create: `src/lib/email/voucher-text.ts`
- Modify: `src/lib/email/voucher-template.tsx`
- Modify: `src/lib/email/voucher-template.test.tsx`
- Modify: `src/lib/email/send.ts`
- Modify: `src/lib/email/send.test.ts`

- [ ] **Step 1: Escribir el test de plantilla que falla**

Reemplazar el contenido completo de `src/lib/email/voucher-template.test.tsx` por:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/components';
import { VoucherEmail, QR_CID, LOGO_CID } from './voucher-template';

const props = {
  firstName: 'Ana', lastName: 'Pérez', idType: 'V', idNumber: '12345678',
  code: 'PP-4F7K2', date: '2030-01-15', adults: 2, children: 1,
  totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5,
};

describe('VoucherEmail', () => {
  it('renders every field the gate needs', async () => {
    const html = await render(<VoucherEmail {...props} />);
    for (const expected of [
      'Ana Pérez', 'V-12345678', 'PP-4F7K2', '2030-01-15',
      '2 adultos', '1 niño', '$35.00', 'Bs. 1277.50', '36.5',
    ]) {
      expect(html).toContain(expected);
    }
  });

  it('renders a child-only party without a 0 adultos label', async () => {
    const html = await render(<VoucherEmail {...{ ...props, adults: 0, children: 2 }} />);
    expect(html).toContain('2 niños');
    expect(html).not.toContain('0 adultos');
  });

  it('points both images at attachments, never at a remote url', async () => {
    const html = await render(<VoucherEmail {...props} />);
    expect(html).toContain(`cid:${QR_CID}`);
    expect(html).toContain(`cid:${LOGO_CID}`);
    expect(html).not.toContain('/api/qr/');
  });

  it('offers a way to reach the club', async () => {
    const html = await render(<VoucherEmail {...props} />);
    expect(html).toContain('wa.me/');
    expect(html).toContain('finca_villa_victoria');
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/email/voucher-template.test.tsx`
Expected: FAIL — `QR_CID` y `LOGO_CID` no se exportan.

- [ ] **Step 3: Reescribir `src/lib/email/voucher-template.tsx`**

Reemplazar el archivo completo por:

```tsx
import {
  Html, Head, Body, Container, Section, Text, Heading, Img, Hr, Link,
} from '@react-email/components';
import { partyLabel } from '@/lib/party';
import { landingContent, whatsappUrl } from '@/lib/landing-content';

/**
 * Content IDs of the two inline attachments. The email carries its images
 * rather than linking them: Gmail blocks remote images by default for senders
 * the recipient has not trusted, which would deliver the pass without its QR.
 */
export const QR_CID = 'voucher-qr';
export const LOGO_CID = 'brand-logo';

export interface VoucherEmailProps {
  firstName: string; lastName: string; idType: string; idNumber: string;
  code: string; date: string; adults: number; children: number;
  totalUsd: number; totalVes: number; bcvRate: number;
}

const label = { color: '#6b7280', fontSize: '13px', margin: '0' } as const;
const value = { color: '#111827', fontSize: '16px', margin: '0 0 12px' } as const;

export function VoucherEmail(p: VoucherEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', maxWidth: '420px' }}>
          <Section style={{ textAlign: 'center', marginBottom: '8px' }}>
            <Img
              src={`cid:${LOGO_CID}`}
              alt={landingContent.clubName}
              width="240"
              style={{ margin: '0 auto' }}
            />
          </Section>
          <Heading as="h1" style={{ fontSize: '20px', color: '#111827' }}>
            {`Tu pase de piscina — ${p.code}`}
          </Heading>
          <Text style={{ color: '#374151' }}>
            Presenta este correo junto a tu cédula en la entrada.
          </Text>
          <Section style={{ textAlign: 'center', margin: '16px 0' }}>
            <Img src={`cid:${QR_CID}`} alt={`Código QR ${p.code}`} width="180" height="180" style={{ margin: '0 auto' }} />
          </Section>
          <Hr />
          <Text style={label}>Nombre</Text>
          <Text style={value}>{`${p.firstName} ${p.lastName}`}</Text>
          <Text style={label}>Documento</Text>
          <Text style={value}>{`${p.idType}-${p.idNumber}`}</Text>
          <Text style={label}>Fecha de reserva</Text>
          <Text style={value}>{p.date}</Text>
          <Text style={label}>Asistentes</Text>
          <Text style={value}>{partyLabel(p.adults, p.children)}</Text>
          <Text style={label}>Total pagado</Text>
          <Text style={value}>
            {`$${p.totalUsd.toFixed(2)} / Bs. ${p.totalVes.toFixed(2)} (tasa BCV ${p.bcvRate.toFixed(2)})`}
          </Text>
          <Text style={label}>Reserva</Text>
          <Text style={value}>{p.code}</Text>
          <Hr />
          <Text style={{ color: '#6b7280', fontSize: '13px', margin: '12px 0 0' }}>
            {'¿Dudas? Escríbenos por '}
            <Link href={whatsappUrl()}>{`WhatsApp ${landingContent.whatsapp}`}</Link>
            {' · '}
            <Link href={`https://instagram.com/${landingContent.instagram}`}>
              {`@${landingContent.instagram}`}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/email/voucher-template.test.tsx`
Expected: PASS, 4 tests.

Este test pasa desde ya porque la Tarea 8 todavía no cambió los datos de contacto, pero `landingContent.instagram` hoy vale `clubLaPiscina`. Si el cuarto test falla con `finca_villa_victoria`, **hacer la Tarea 8 antes que esta** y volver. Son independientes salvo por esta aserción.

- [ ] **Step 5: Crear `src/lib/email/voucher-text.ts`**

```ts
import type { VoucherData } from '@/lib/booking/process';
import { partyLabel } from '@/lib/party';
import { visitLabelEs } from '@/lib/dates';
import { landingContent, whatsappUrl } from '@/lib/landing-content';

/**
 * Plain-text alternative to the HTML voucher.
 *
 * An HTML-only message is a well-known spam signal, and the text part is what
 * clients that refuse HTML fall back to. It deliberately omits the QR: a code
 * cannot be expressed in text, so it points at the reservation code instead.
 */
export function voucherText(v: VoucherData): string {
  return [
    landingContent.clubName,
    '',
    `Tu pase de piscina: ${v.code}`,
    'Presenta este correo junto a tu cédula en la entrada.',
    '',
    `Nombre: ${v.firstName} ${v.lastName}`,
    `Documento: ${v.idType}-${v.idNumber}`,
    `Fecha: ${visitLabelEs(v.date)}`,
    `Asistentes: ${partyLabel(v.adults, v.children)}`,
    `Total pagado: $${v.totalUsd.toFixed(2)} / Bs. ${v.totalVes.toFixed(2)} (tasa BCV ${v.bcvRate.toFixed(2)})`,
    '',
    `Si el código QR no se ve, escríbenos: ${whatsappUrl()}`,
  ].join('\n');
}
```

- [ ] **Step 6: Escribir el test de envío que falla**

En `src/lib/email/send.test.ts`, reemplazar el primer test (`'sends pre-rendered html containing the code and QR url via SMTP'`) por estos dos:

```ts
  it('attaches the QR and the logo instead of linking them remotely', async () => {
    sendMailMock.mockResolvedValue({ rejected: [], accepted: ['ana@example.com'] });

    await sendVoucherEmail(voucher);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.from).toBe('pases@app.test');
    expect(arg.to).toBe('ana@example.com');
    expect(arg.html).toContain('PP-4F7K2');
    expect(arg.html).not.toContain('https://app.test/api/qr/uuid-1');

    const cids = arg.attachments.map((a: { cid: string }) => a.cid);
    expect(cids).toEqual(['voucher-qr', 'brand-logo']);
    for (const a of arg.attachments) {
      expect(a.contentType).toBe('image/png');
      expect(Buffer.isBuffer(a.content)).toBe(true);
      expect(a.content.length).toBeGreaterThan(0);
    }
  });

  it('puts the visit date in the subject and ships a plain-text part', async () => {
    sendMailMock.mockResolvedValue({ rejected: [], accepted: ['ana@example.com'] });

    await sendVoucherEmail(voucher);

    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.subject).toBe('Tu pase para el Mar, 15 Ene 2030 — PP-4F7K2');
    expect(arg.text).toContain('PP-4F7K2');
    expect(arg.text).toContain('Ana Pérez');
  });
```

- [ ] **Step 7: Correr y ver fallar**

Run: `npx vitest run src/lib/email/send.test.ts`
Expected: FAIL — `arg.attachments` es `undefined`.

- [ ] **Step 8: Actualizar `src/lib/email/send.ts`**

Reemplazar el archivo completo por:

```ts
import 'server-only';
import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { VoucherEmail, QR_CID, LOGO_CID } from './voucher-template';
import { voucherText } from './voucher-text';
import { LOGO_PNG_BASE64 } from './logo-data';
import { qrPngBuffer } from '@/lib/qr';
import { visitLabelEs } from '@/lib/dates';
import type { VoucherData } from '@/lib/booking/process';

/**
 * Sends the voucher email over SMTP (Gmail by default).
 *
 * The QR and the logo travel as inline attachments rather than as remote
 * URLs: Gmail blocks remote images by default for untrusted senders, which
 * would deliver the pass without the code the gate needs to scan.
 *
 * Required env:
 *   SMTP_USER  — the full Gmail address (e.g. reservas.villavictoria@gmail.com)
 *   SMTP_PASS  — a Gmail *App Password* (16 chars, requires 2-Step Verification)
 *   NEXT_PUBLIC_APP_URL — public site URL, encoded in the QR's check-in link
 * Optional env:
 *   SMTP_HOST  (default: smtp.gmail.com)
 *   SMTP_PORT  (default: 465 → implicit TLS; use 587 for STARTTLS)
 *   VOUCHER_FROM_EMAIL (default: SMTP_USER)
 */
export async function sendVoucherEmail(v: VoucherData): Promise<void> {
  // Pre-render to html: @react-email's dynamic render path is an optional peer
  // dep that is not hoisted here, so we render up front and pass plain html.
  const html = await render(VoucherEmail(v));
  const qr = await qrPngBuffer(v.reservationId);

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.VOUCHER_FROM_EMAIL || process.env.SMTP_USER,
    to: v.email,
    subject: `Tu pase para el ${visitLabelEs(v.date)} — ${v.code}`,
    html,
    text: voucherText(v),
    attachments: [
      { filename: 'pase-qr.png', content: qr, cid: QR_CID, contentType: 'image/png' },
      {
        filename: 'logo.png',
        content: Buffer.from(LOGO_PNG_BASE64, 'base64'),
        cid: LOGO_CID,
        contentType: 'image/png',
      },
    ],
  });

  if (info.rejected && info.rejected.length > 0) {
    throw new Error(`smtp: no se pudo entregar a ${info.rejected.join(', ')}`);
  }
}
```

- [ ] **Step 9: Correr y ver pasar**

Run: `npx vitest run src/lib/email/send.test.ts`
Expected: PASS, 4 tests.

Si el asunto no coincide, imprimir `visitLabelEs('2030-01-15')` en un scratch y usar el valor real: depende del ICU del Node instalado.

- [ ] **Step 10: Correr la suite completa y typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: todo verde.

- [ ] **Step 11: Commit**

```bash
git add src/lib/email
git commit -m "$(cat <<'EOF'
fix(email): attach the QR inline so Gmail stops hiding it

The voucher linked its QR as a remote URL, which Gmail blocks by default for
senders the recipient has not trusted — the pass arrived without the code the
gate scans. QR and logo now travel as cid: attachments.

Also adds the plain-text alternative and puts the visit date in the subject.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Logo en el voucher en pantalla

**Files:**
- Modify: `src/components/booking/booking-card.tsx`

- [ ] **Step 1: Agregar el import**

En el bloque de imports de `src/components/booking/booking-card.tsx`, después de la línea `import { whatsappUrl } from '@/lib/landing-content';`, agregar:

```tsx
import { Logo } from '@/components/brand/logo';
```

- [ ] **Step 2: Poner el logo en la cabecera navy del pase**

En el bloque `{view === 'done' && reservation && (...)}`, la cabecera navy del pase es:

```tsx
            <div className="bg-navy p-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-teal-soft">Pase del día</p>
              <p data-testid="reservation-code" className="font-heading text-3xl font-semibold tracking-wider">{reservation.code}</p>
            </div>
```

Reemplazarla por:

```tsx
            <div className="bg-navy p-4 text-white">
              <Logo variant="chip" className="mx-auto mb-3 h-9 w-auto" />
              <p className="text-xs uppercase tracking-[0.2em] text-teal-soft">Pase del día</p>
              <p data-testid="reservation-code" className="font-heading text-3xl font-semibold tracking-wider">{reservation.code}</p>
            </div>
```

- [ ] **Step 3: Verificar tipos y tests**

Run: `npx tsc --noEmit && npx vitest run src/components/booking`
Expected: sin errores; los tests de `booking-card` siguen verdes. Afirman sobre `data-testid="reservation-code"`, que no se tocó.

- [ ] **Step 4: Commit**

```bash
git add src/components/booking/booking-card.tsx
git commit -m "$(cat <<'EOF'
feat(brand): put the logo on the confirmation pass

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Metadatos y manifest

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/manifest.ts`

- [ ] **Step 1: Actualizar la metadata del layout**

En `src/app/layout.tsx`, reemplazar el bloque `export const metadata` completo por:

```tsx
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pool-pass.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Complejo Turístico Villa Victoria',
    template: '%s · Complejo Turístico Villa Victoria',
  },
  description:
    'Reserva tu pase de piscina en línea, paga con Pago Móvil y entra con tu código QR. Sin colas, sin efectivo.',
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    siteName: 'Complejo Turístico Villa Victoria',
    title: 'Complejo Turístico Villa Victoria',
    description:
      'Reserva tu pase de piscina en línea, paga con Pago Móvil y entra con tu código QR.',
  },
};
```

`metadataBase` es lo que permite que Next resuelva las URLs de Open Graph a absolutas. La imagen OG se agrega en la Tarea 9, cuando exista el archivo: referenciarla ahora daría un 404 en los previsualizadores de WhatsApp y Twitter.

- [ ] **Step 2: Actualizar el manifest**

Reemplazar `src/app/manifest.ts` completo por:

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Complejo Turístico Villa Victoria',
    short_name: 'Villa Victoria',
    description: 'Reserva tu pase de piscina y entra con tu código QR.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    // Navy of the brand palette. The previous #0284c7 was a sky blue that
    // appears nowhere else in the project.
    theme_color: '#0b2a4a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificar que el build pasa**

Run: `npm run build`
Expected: build exitoso. Este es el primer punto donde un `metadataBase` mal formado o un icono faltante se manifestaría.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/manifest.ts
git commit -m "$(cat <<'EOF'
feat(brand): real title, description and theme colour

layout and manifest still said "Pool Pass". Also swaps theme_color for the
brand navy; the old #0284c7 was a sky blue used nowhere else.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Datos de contacto reales

El botón "¿Dudas? Escríbenos por WhatsApp" del voucher apunta hoy a `+58 412 000 0000`, un número inventado. Es el único canal de soporte que se le ofrece al cliente justo después de que pagó.

**Files:**
- Modify: `src/lib/landing-content.ts`
- Modify: `src/lib/landing-content.test.ts`

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/landing-content.test.ts`, reemplazar el test `'builds a digits-only wa.me link'` por:

```ts
  it('builds the club wa.me link', () => {
    expect(whatsappUrl()).toBe('https://wa.me/584249196984');
  });
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/landing-content.test.ts`
Expected: FAIL — recibe `https://wa.me/584120000000`.

- [ ] **Step 3: Actualizar los datos**

En `src/lib/landing-content.ts`, reemplazar las cuatro últimas propiedades del objeto:

```ts
  address: 'Av. Principal, Caracas',
  hours: 'Mar–Dom · 9:00 am – 6:00 pm',
  whatsapp: '+58 412 000 0000',
  instagram: 'clubLaPiscina',
```

por:

```ts
  // TODO: dirección y horario reales — estos son inventados y salen en el footer.
  address: 'Av. Principal, Caracas',
  hours: 'Mar–Dom · 9:00 am – 6:00 pm',
  whatsapp: '+58 424-9196984',
  instagram: 'finca_villa_victoria',
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/landing-content.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: todo verde, incluido el cuarto test de `voucher-template.test.tsx`, que afirma sobre `finca_villa_victoria`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/landing-content.ts src/lib/landing-content.test.ts
git commit -m "$(cat <<'EOF'
fix: real WhatsApp and Instagram

The voucher's only support link pointed at a placeholder number. Address and
hours stay flagged with a TODO — they are still invented.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Hero con foto real e imagen Open Graph

> **BLOQUEADA.** Requiere `assets/brand-source/piscina.jpg`. La foto llegó como adjunto de chat, no como archivo. Si al llegar aquí el archivo no existe, **saltar esta tarea entera** y reportar en el resumen final que quedó pendiente por falta del archivo. Las tareas 1–8 se entregan igual.

**Files:**
- Modify: `scripts/build-brand-assets.mjs`
- Modify: `src/components/landing/hero.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Confirmar que la foto está**

Run: `ls -l assets/brand-source/piscina.jpg`
Expected: el archivo existe. Si no, saltar la tarea.

- [ ] **Step 2: Extender el script de assets**

En `scripts/build-brand-assets.mjs`, agregar junto a las otras constantes de ruta:

```js
const PHOTO = path.join(ROOT, 'assets/brand-source/piscina.jpg');
```

Y al final de `main()`, antes del bloque de `console.log`:

```js
  // Hero photo + Open Graph card. Both derive from the same shot.
  await mkdir(path.join(ROOT, 'public/gallery'), { recursive: true });
  await sharp(PHOTO)
    .resize(1200, 900, { fit: 'cover' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(ROOT, 'public/gallery/piscina-1.jpg'));

  const ogBase = await sharp(PHOTO)
    .resize(1200, 630, { fit: 'cover' })
    .modulate({ brightness: 0.72 })
    .toBuffer();
  const ogLogo = await sharp(markPng).resize({ width: 260 }).png().toBuffer();
  await sharp(ogBase)
    .composite([{ input: ogLogo, gravity: 'center' }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(path.join(ROOT, 'public/brand/og.jpg'));
```

El `modulate({ brightness: 0.72 })` oscurece la foto para que el logo encima se lea; sin eso el mark claro se pierde sobre el agua.

- [ ] **Step 3: Correr el script y mirar el resultado**

Run: `node scripts/build-brand-assets.mjs`
Expected: se crean `public/gallery/piscina-1.jpg` y `public/brand/og.jpg`.

Abrir `public/brand/og.jpg` y confirmar que el logo se distingue sobre la foto. Si queda lavado, bajar `brightness` a `0.6`.

- [ ] **Step 4: Reemplazar el placeholder del hero**

En `src/components/landing/hero.tsx`, borrar la función `PoolMark` completa (queda sin uso y eslint lo marcaría) y agregar arriba:

```tsx
import Image from 'next/image';
```

Reemplazar el bloque de la caja de vidrio:

```tsx
          <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/15 bg-white/10 p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-teal-soft">
              <PoolMark />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                {open ? 'Piscina abierta' : 'Agotado hoy'}
              </span>
            </div>
          </div>
```

por:

```tsx
          <div className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-white/15">
            <Image
              src="/gallery/piscina-1.jpg"
              alt="Piscina del Complejo Turístico Villa Victoria"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
              priority
            />
            <span className="absolute bottom-4 left-4 rounded-full bg-navy/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-teal-soft backdrop-blur-sm">
              {open ? 'Piscina abierta' : 'Agotado hoy'}
            </span>
          </div>
```

- [ ] **Step 5: Referenciar la imagen OG**

En `src/app/layout.tsx`, dentro del objeto `openGraph`, agregar después de `description`:

```tsx
    images: [{ url: '/brand/og.jpg', width: 1200, height: 630 }],
```

- [ ] **Step 6: Verificar tipos, lint y build**

Run: `npx tsc --noEmit && npx eslint src/components/landing && npm run build`
Expected: sin errores. Si eslint marca `PoolMark` sin usar, es que quedó la función: borrarla.

- [ ] **Step 7: Correr la suite completa**

Run: `npm test`
Expected: todo verde.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-brand-assets.mjs src/components/landing/hero.tsx src/app/layout.tsx public/gallery public/brand/og.jpg
git commit -m "$(cat <<'EOF'
feat(brand): real pool photo in the hero and the OG card

Replaces the line-art placeholder with a photograph of the actual pool, and
gives link previews a branded card instead of nothing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Cierre

- [ ] **Verificación final**

Run: `npm test && npx tsc --noEmit && npx eslint && npm run build`
Expected: los cuatro verdes.

- [ ] **Prueba manual del email**

Con las variables SMTP configuradas en `.env.local`, hacer una reserva de prueba y confirmar en Gmail que:
1. El QR se ve **sin** pulsar "Mostrar imágenes".
2. El logo aparece en la cabecera.
3. El asunto trae la fecha.
4. El enlace de WhatsApp abre un chat con `+58 424-9196984`.

Este paso es el que valida el objetivo real de la Tarea 5, y ningún test unitario lo cubre: la conducta de bloqueo de imágenes es del cliente de correo.

- [ ] **Reportar lo que quedó fuera**

Si se saltó la Tarea 9, decirlo explícitamente en el resumen, con el motivo (falta `assets/brand-source/piscina.jpg`) y qué falta en consecuencia: la foto del hero y la imagen de Open Graph.
