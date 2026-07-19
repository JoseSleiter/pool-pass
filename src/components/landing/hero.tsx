import Link from 'next/link';
import { CalendarCheck, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { landingContent } from '@/lib/landing-content';
import { todayCaracas } from '@/lib/dates';

function visitDateLabel(): string {
  const today = todayCaracas();
  const raw = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${today}T12:00:00-04:00`));
  // "vie, 17 jul 2026" -> "Vie, 17 Jul 2026"
  return raw.replace(/\b\p{L}/gu, (c) => c.toUpperCase()).replace(/\./g, '');
}

/** Stylized pool card icon (ladder + water), matching the reference line art. */
function PoolMark() {
  return (
    <svg viewBox="0 0 120 96" fill="none" className="h-24 w-28" aria-hidden>
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 12v46M60 12v46M76 12v46" />
        <path d="M44 26h32M44 40h32" />
        <path d="M40 12a6 6 0 0 1 12 0M68 12a6 6 0 0 1 12 0" />
        <path d="M20 68c8 0 8 6 16 6s8-6 16-6 8 6 16 6 8-6 16-6 8 6 16 6" />
        <path d="M20 82c8 0 8 6 16 6s8-6 16-6 8 6 16 6 8-6 16-6 8 6 16 6" />
      </g>
    </svg>
  );
}

export function Hero(props: { remaining: number; prices: { adult: number; child: number } }) {
  const open = props.remaining > 0;
  const estimated = props.prices.adult * 2 + props.prices.child;
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        background:
          'linear-gradient(145deg, #0b2a4a 0%, #075e82 58%, #0bc4c7 100%)',
      }}
    >
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-14">
        {/* Top: copy + floating pool card */}
        <div className="grid items-start gap-10 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-soft">
              {landingContent.tagline}
            </p>
            <h1 className="mt-5 font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Reserva tu pase.
              <br />
              Disfruta el agua.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
              Elige tu fecha, registra a tus acompañantes y recibe tu pase
              digital en minutos. Pago seguro con Pago Móvil y acceso fácil
              desde tu celular.
            </p>
            <p className="mt-6 text-sm font-semibold text-white/90">
              Adultos desde&nbsp;
              <span className="text-white">${props.prices.adult.toFixed(0)}</span>
              <span className="mx-3 text-white/40">·</span>
              Niños&nbsp;
              <span className="text-white">${props.prices.child.toFixed(0)}</span>
            </p>
          </div>

          <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/15 bg-white/10 p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-teal-soft">
              <PoolMark />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                {open ? 'Piscina abierta' : 'Agotado hoy'}
              </span>
            </div>
          </div>
        </div>

        {/* Booking card */}
        <div className="mt-12 rounded-3xl bg-card p-6 text-navy shadow-2xl shadow-navy-deep/30 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold">Reserva tu pase</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Completa estos datos para ver tu total
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Pago seguro
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Fecha de visita</p>
                  <p className="mt-1 font-heading text-lg font-semibold">{visitDateLabel()}</p>
                </div>
                <CalendarCheck className="h-5 w-5 text-teal" />
              </div>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Personas</p>
                  <p className="mt-1 font-heading text-lg font-semibold">2 adultos · 1 niño</p>
                </div>
                <Users className="h-5 w-5 text-teal" />
              </div>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-xs font-medium text-secondary-foreground/70">Total estimado</p>
              <p className="mt-1 font-heading text-2xl font-semibold text-secondary-foreground">
                ${estimated.toFixed(0)} USD
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
              <span className={`h-2 w-2 rounded-full ${open ? 'bg-teal' : 'bg-destructive'}`} />
              {open
                ? `${props.remaining} cupos disponibles hoy`
                : 'Sin cupos hoy — elige otra fecha'}
            </p>
            <Link
              href="/reservar?pay=1"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
