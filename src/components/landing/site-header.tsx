import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link href="/" className="font-extrabold text-sky-700">🌊 {landingContent.clubName}</Link>
        <nav className="flex items-center gap-4 text-sm text-slate-500">
          <a href="#precios" className="hidden sm:inline hover:text-sky-600">Precios</a>
          <a href="#galeria" className="hidden sm:inline hover:text-sky-600">Galería</a>
          <Link href="/reservar" className="rounded-full bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700">
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}
