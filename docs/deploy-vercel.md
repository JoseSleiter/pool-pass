# Despliegue en Vercel — Pool Pass

Guía para salir a producción en la nube con **C2P en modo prueba (mock)** y las
protecciones de seguridad activas. Al final está el procedimiento para pasar C2P
a cobros reales cuando tengas las credenciales del comercio.

---

## 1. Supabase cloud

1. Crea el proyecto en https://supabase.com.
2. Enlaza y aplica las migraciones (incluye el lockdown de seguridad `0003`):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Authentication → Providers → Email:** crea el/los usuario(s) admin
   (Add user, Auto Confirm). Anota los correos: irán en `ADMIN_EMAILS`.
4. **Authentication → Sign In / Providers:** **desactiva "Allow new users to sign up"**
   (Signup). Es la primera barrera: sin registro público, nadie ajeno obtiene sesión.
   > Doble capa: aunque el signup quedara abierto por error, `ADMIN_EMAILS` +
   > el RLS lockdown impiden que un usuario cualquiera vea datos o toque precios.

## 2. Variables de entorno en Vercel

Configura **todas** en Project → Settings → Environment Variables (Production):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (pública por diseño) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — **secreta** |
| `ADMIN_EMAILS` | correos admin separados por coma, ej. `duenio@club.com,gerente@club.com` |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio` (sin barra final) |
| `MERCANTIL_BASE_URL` | endpoint del banco |
| `MERCANTIL_CLIENT_ID` | X-IBM-Client-Id del comercio |
| `MERCANTIL_MERCHANT_ID` | id de comercio |
| `MERCANTIL_INTEGRATOR_ID` | id de integrador |
| `MERCANTIL_TERMINAL_ID` | id de terminal |
| `MERCANTIL_SECRET_KEY` | secret del comercio — **secreta** |
| `MERCANTIL_MOCK` | **`1`** ← modo prueba por ahora (no cobra de verdad) |
| `BCV_RATE_URL` | fuente de tasa BCV |
| `RESEND_API_KEY` | API key de Resend — **secreta** |
| `VOUCHER_FROM_EMAIL` | remitente verificado en Resend |

> Con `MERCANTIL_MOCK=1`: la clave C2P `999999` simula rechazo; cualquier otra
> simula aprobación. No se contacta al banco ni se cobra nada.

## 3. Resend (anti-spam de correo)

Para que los vouchers no caigan en spam y Gmail no los rechace:

1. Verifica el dominio de `VOUCHER_FROM_EMAIL` en Resend.
2. Publica en tu DNS los registros que Resend indique: **SPF**, **DKIM** y **DMARC**
   (empieza `p=none`, y cuando todo autentique pasa a `p=quarantine`).
3. Envía solo a quien reservó (ya es el caso) para mantener la queja < 0.3 %.

## 4. Verificación post-deploy

- `https://tu-dominio/` responde 200.
- `https://tu-dominio/admin` redirige a login; tras iniciar sesión con un correo de
  `ADMIN_EMAILS` entras; con un correo NO listado te rebota.
- Headers de seguridad presentes: `curl -sI https://tu-dominio | grep -i -E "strict-transport|x-frame|content-security"`.
- Una reserva de prueba end-to-end (con mock): completa el flujo, revisa el correo,
  escanea el QR, haz check-in desde `/admin/checkin/[id]`, y borra la reserva de prueba.

---

## 5. Pasar C2P de prueba (mock) a cobros reales — MÁS ADELANTE

Cuando tengas confirmado el contrato con tu ejecutivo de comercio Mercantil:

1. **Confirma el contrato de la API** contra la documentación de tu comercio
   (portal apiportal.mercantilbanco.com, requiere login). Verifica y ajusta si difiere:
   - Cifrado en `src/lib/mercantil/encrypt.ts` (hoy: AES-256-CBC, clave = SHA-256(secret),
     IV en ceros, salida base64). Confirma modo, IV y derivación de clave.
   - `destination_bank_id` enviado como número (`'0105'` → `105`) en `src/lib/mercantil/client.ts`.
   - `amount` como número JSON con 2 decimales (no string).
   - Vocabulario de estados: hoy solo `rejected`/`denied` liberan cupo; cualquier otro
     estado deja la reserva `pending` para verificación manual. Ajusta si el banco usa otros.
2. **Carga las credenciales reales** de producción en las `MERCANTIL_*` de Vercel.
3. **Cambia `MERCANTIL_MOCK` de `1` a `0`** en Vercel (Production) y vuelve a desplegar.
4. **Smoke test real:** una reserva mínima real — paga un monto pequeño, recibe el correo,
   escanea el QR, haz check-in, y limpia la reserva de prueba. Verifica el cobro contra
   el estado de cuenta del comercio antes de abrir al público.

> La app nunca reintenta un cobro C2P automáticamente. Si un pago queda `pending`
> tras un incidente, se verifica a mano contra el estado de cuenta Mercantil.

---

## 6. Endurecimiento pendiente (opcional, no bloquea el deploy)

- **CAPTCHA (Cloudflare Turnstile):** hoy hay rate-limit por IP (8/min) + honeypot.
  Turnstile añadiría una barrera invisible extra contra bots. Requiere cuenta Cloudflare,
  widget en el formulario y `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`.
- **CSP completa con nonces:** hoy la CSP se limita a `frame-ancestors 'none'`
  (anti-clickjacking) para no romper los scripts inline de Next. Una CSP de `script-src`
  con nonces es más estricta pero requiere más pruebas.
