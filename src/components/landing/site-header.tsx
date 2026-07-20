import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

/** Transparent nav bar that sits on top of the hero gradient (navy). */
export function SiteHeader() {
  return (
    <header className="bg-navy">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="font-heading text-lg font-semibold uppercase tracking-[0.18em] text-white"
        >
          {landingContent.clubName}
        </Link>
        <nav className="flex items-center gap-7 text-sm font-medium text-white/85">
          <Link href="/#como-funciona" className="hidden transition-colors hover:text-teal-soft sm:inline">
            Cómo funciona
          </Link>
          <Link href="/#precios" className="hidden transition-colors hover:text-teal-soft sm:inline">
            Precios
          </Link>
          <Link href="/reservar" className="transition-colors hover:text-teal-soft">
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}
