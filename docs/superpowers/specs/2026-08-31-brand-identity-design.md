# Identidad de marca — Diseño

**Fecha:** 2026-08-31
**Rama:** `feat/brand-identity`

## Objetivo

Terminar el rebrand a *Complejo Turístico Villa Victoria*, que hasta ahora fue solo textual. El logo real aparece en el sitio, en el voucher y en el email; los metadatos y los iconos PWA dejan de decir "Pool Pass"; y el voucher deja de depender de imágenes remotas que Gmail bloquea.

## Motivación

Tres problemas concretos, en orden de gravedad:

1. **El pase llega sin QR.** `voucher-template.tsx` referencia el QR como URL remota (`NEXT_PUBLIC_APP_URL/api/qr/:id`). Gmail bloquea imágenes remotas por defecto para remitentes que el destinatario no ha marcado como confiables. El cliente recibe un correo con un hueco donde debería estar su pase.
2. **El botón de WhatsApp del voucher no lleva a ningún lado.** `landingContent.whatsapp` es `+58 412 000 0000`, un placeholder. Es el único canal de soporte que se le ofrece al cliente justo después de que pagó.
3. **La marca está a medias.** `layout.tsx` y `manifest.ts` dicen "Pool Pass"; los iconos son genéricos; el logo de la empresa no aparece en ninguna parte.

## Fuera de alcance

El rediseño del back-office admin. Es un proyecto separado con su propio spec.

## Fuente de los assets

El único material disponible es una **fotografía del cartel físico** (`assets/brand-source/logo-cartel.jpg`, 1315×800 JPEG): el logo en relieve montado sobre un pedestal de mármol, sobre fondo gris uniforme `#F7F7F7`.

No es un logo vectorial. El recorte se hace por procesamiento de imagen y se acepta que tenga limitaciones.

### Viabilidad verificada

Se probó el recorte antes de escribir este documento. Resultado:

- El fondo `#F7F7F7` es perfectamente uniforme en los cuatro bordes → un flood-fill con `-fuzz 12%` desde las esquinas lo elimina limpiamente.
- El pedestal ocupa `y >= 620`, pero las olas azul y verde del logo lo invaden hasta `y ≈ 780`. No se puede recortar por altura sin perder parte del logo.
- El pedestal se elimina con una máscara de color aplicada **solo** a la franja inferior: se descarta lo cálido y desaturado (el mármol) y se conserva lo saturado o de tono frío (las olas, las figuras). El wordmark dorado queda fuera de la franja, así que no corre riesgo.

**Limitación aceptada:** los brillos especulares claros de las olas inferiores se confunden con el mármol y quedan parcialmente comidos. Es invisible a los tamaños de uso (40–200 px) y visible al 900 px. Se resuelve el día que exista el archivo original del diseñador.

### Reproducibilidad

La generación vive en `scripts/build-brand-assets.mjs`, versionado, que lee de `assets/brand-source/` y escribe en `public/`. Cuando aparezca el archivo del diseñador se cambia la fuente y se vuelve a correr. **No se commitean binarios sin la receta que los produce.**

## Assets generados

| Salida | Qué es | Para qué |
| --- | --- | --- |
| `public/brand/logo.png` | Lockup completo, transparente, ~1240×720 | Header, footer, voucher |
| `public/brand/logo-mark.png` | Recorte cuadrado del grupo de figuras + olas, 512×512 | Base de los iconos |
| `public/icon-192.png`, `public/icon-512.png` | El mark sobre fondo blanco | Iconos PWA (reemplazan los genéricos) |
| `src/app/favicon.ico` | El mark, multi-resolución | Pestaña del navegador |
| `src/lib/email/logo-data.ts` | El lockup optimizado, en base64 | Adjunto `cid:` del email |
| `public/brand/og.jpg` | La foto de la piscina con el logo encima, 1200×630 | Open Graph *(depende de la foto — ver más abajo)* |
| `public/gallery/piscina-1.jpg` | La foto optimizada | Hero *(idem)*  |

El lockup es horizontal (~1.72:1). A 40 px de alto el texto "VILLA VICTORIA" mediría unos 3 px: ilegible. Por eso **el favicon y los iconos PWA usan el recorte cuadrado de las figuras**, que es la parte del logo que sobrevive a tamaño chico, y no el lockup completo.

`public/icon.svg` es un ícono de piscina genérico que no está referenciado desde ningún lado (verificado con grep sobre `src/`, `public/` y `next.config.ts`). Se elimina.

## Componente `<Logo>`

`src/components/brand/logo.tsx`. Server component, un solo lugar donde vive la decisión visual del logo. Envuelve `next/image` con el `alt` correcto y dos variantes:

- **`chip`** — el logo dentro de una pastilla blanca redondeada. Para fondos navy: header, footer, cabecera del voucher.
- **`plain`** — el logo suelto. Para fondos claros.

El logo es multicolor sobre fondo claro por diseño: el árbol verde oscuro y la montaña azul marino se pierden contra el navy `#0b2a4a` del sitio. El chip blanco resuelve eso preservando los colores originales, que es lo que hacen los complejos turísticos con logos multicolor. La alternativa —una versión monocroma blanca— sacrificaría el dorado del wordmark, que es lo más identificable de la marca.

Header y footer dejan de renderizar el wordmark de texto: sería duplicarlo, porque el logo ya contiene el nombre.

## Email del voucher

Tres cambios, todos en `voucher-template.tsx` y `send.ts`.

### QR como adjunto `cid:`

La generación del QR hoy está embebida en `src/app/api/qr/[id]/route.ts`. Se extrae a `src/lib/qr.ts`:

```ts
export async function qrPngBuffer(reservationId: string): Promise<Buffer>
```

La ruta HTTP y el email pasan a consumir la misma función, así que el QR del correo y el que se escanea en la entrada no pueden divergir. `send.ts` genera el buffer y lo adjunta con `cid: 'qr'`; la plantilla usa `src="cid:qr"`.

Esto es lo que hace que el pase llegue **con** su QR aunque el cliente no habilite imágenes remotas.

### Logo como `cid:`, desde un módulo base64

El logo se adjunta igual, con `cid: 'logo'`, pero su origen es `src/lib/email/logo-data.ts` — un módulo TypeScript que exporta el PNG en base64, generado por el mismo script.

**Deliberadamente no se lee de `public/` en runtime.** En Vercel los archivos de `public/` no están garantizados dentro del bundle de la función serverless; dependería de configurar `outputFileTracingIncludes` y de que eso siga funcionando tras cada actualización de Next. Un módulo importado es una dependencia que el bundler sí resuelve siempre, y además es testeable sin tocar el sistema de archivos. El costo es un archivo generado de ~20 KB en el repo.

### Texto plano y asunto con fecha

- Se agrega el campo `text:` con la misma información en texto plano. Un correo HTML sin alternativa de texto es una señal de spam clásica, y además degrada bien en clientes que no renderizan HTML.
- El asunto pasa de `Tu pase de piscina — PP-4F7K2` a `Tu pase para el Mar, 15 Ene — PP-4F7K2`. La fecha en el asunto le sirve al cliente para encontrar el correo entre varios.

La plantilla suma además una cabecera con el logo y un pie con WhatsApp e Instagram.

## Hero con foto real

El hero tiene hoy una caja de vidrio con un ícono line-art de placeholder (`PoolMark`). Se reemplaza por una fotografía real de la piscina, redondeada, con el badge "Piscina abierta / Agotado hoy" superpuesto. Cambio de contenido; la estructura del grid no se toca.

> **Dependencia pendiente:** la foto llegó como adjunto en el chat, no como archivo en disco. Esta parte —y la imagen Open Graph, que la usa de fondo— queda bloqueada hasta que el archivo esté en `assets/brand-source/piscina.jpg`. Todo lo demás avanza sin ella. Si al llegar a esa tarea el archivo no está, se salta y se entrega el resto.

## Metadatos y PWA

`src/app/layout.tsx`:
- `title` con plantilla: `%s · Complejo Turístico Villa Victoria`, y un default propio.
- `description` real en lugar de "Reserva tu pase de piscina".
- `metadataBase` desde `NEXT_PUBLIC_APP_URL`, necesario para que las URLs de Open Graph se resuelvan absolutas.
- `openGraph` con `public/brand/og.jpg`.

`src/app/manifest.ts`:
- `name` y `short_name` reales.
- `theme_color` pasa de `#0284c7` a `#0b2a4a`. El valor actual es un azul que no existe en la paleta del proyecto; el navy sí es el color de marca y es el que pinta la barra del navegador en móvil.

## Contacto

En `src/lib/landing-content.ts`:

```ts
whatsapp: '+58 424-9196984',
instagram: 'finca_villa_victoria',
```

`whatsappUrl()` ya normaliza a dígitos: produce `https://wa.me/584249196984`, correcto para Venezuela.

Dirección y horario quedan con un `// TODO:` visible, por decisión explícita del usuario: los valores actuales son inventados y es preferible que el comentario lo grite a que parezcan reales.

Nota: el handle de Instagram es `finca_villa_victoria` ("Finca Villa Victoria") mientras la app se llama "Complejo Turístico Villa Victoria". Se usa el nombre de la app para la marca y el handle real para el enlace.

## Testing

Se extienden las suites existentes:

- **`send.test.ts`** — el `html` referencia `cid:qr` y `cid:logo` y ya no la URL remota; `attachments` trae los dos con sus `cid` correspondientes; el asunto incluye la fecha; existe `text` no vacío.
- **`voucher-template.test.tsx`** — los `src` de las imágenes son `cid:`; el pie muestra WhatsApp e Instagram. Se conservan las aserciones de campos que ya existen.
- **`landing-content.test.ts`** — `whatsappUrl()` devuelve exactamente `https://wa.me/584249196984`.

Nuevas:

- **`src/lib/qr.test.ts`** — `qrPngBuffer` devuelve un buffer con la firma PNG y codifica la URL de check-in esperada.
- **`src/components/brand/logo.test.tsx`** — ambas variantes renderizan con el `alt` correcto; `chip` aplica el fondo blanco.

`src/app/api/qr/qr-route.test.ts` ya existe y debe seguir pasando tras la extracción: es la red de seguridad de que el refactor no cambió el comportamiento de la ruta.

## Orden de trabajo

1. Script de assets + assets generados
2. Componente `<Logo>` + header + footer
3. Extracción de `src/lib/qr.ts` (la ruta sigue verde)
4. Email: `cid:` para QR y logo, texto plano, asunto, cabecera y pie
5. Voucher en pantalla: logo en la cabecera navy
6. Metadatos, manifest, iconos
7. Contacto real
8. Hero con foto + imagen OG *(bloqueado por el archivo de la foto)*

Cada paso commitea por separado. El orden pone primero lo que desbloquea al resto y deja al final lo que depende de un archivo que todavía no está.
