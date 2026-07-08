import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

export function Hero(props: { remaining: number; prices: { adult: number; child: number } }) {
  const open = props.remaining > 0;
  return (
    <section className="bg-gradient-to-br from-sky-300 via-sky-400 to-sky-600 px-5 pb-14 pt-10 text-white">
      <div className="mx-auto max-w-3xl">
        <span className="inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-medium">
          {open ? `☀️ Abierto hoy · quedan ${props.remaining} cupos` : '⛱️ Agotado hoy — reserva otro día'}
        </span>
        <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight sm:text-5xl">
          {landingContent.tagline}
        </h1>
        <p className="mt-3 max-w-md text-sky-100">{landingContent.subtitle}</p>
        <Link
          href="/reservar"
          className="mt-6 block rounded-full bg-white py-3.5 text-center text-base font-extrabold text-sky-600 shadow-lg shadow-sky-800/30 sm:max-w-xs"
        >
          Reservar ahora →
        </Link>
        <p className="mt-3 text-center text-xs text-sky-100 sm:max-w-xs">
          Adultos ${props.prices.adult.toFixed(2)} · Niños ${props.prices.child.toFixed(2)} · tasa BCV del día
        </p>
      </div>
    </section>
  );
}
