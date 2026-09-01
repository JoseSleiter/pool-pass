import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

/** Transparent nav bar that sits on top of the hero gradient (navy). */
export function SiteHeader() {
  return (
    <header className="bg-navy">
      {/* py-4, not py-6: the logo chip is taller than the text wordmark it
          replaced, and py-6 pushed the header to ~104px over the hero. */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="Inicio">
          <Logo variant="chip" className="h-12 w-auto sm:h-14" priority />
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
