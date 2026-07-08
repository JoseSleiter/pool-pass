import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { landingContent } from '@/lib/landing-content';

export function HowItWorks() {
  return (
    <section className="bg-sky-50 px-5 py-5">
      <div className="mx-auto flex max-w-3xl gap-2 text-center text-xs text-sky-900">
        {landingContent.steps.map((s, i) => (
          <div key={s.text} className="flex-1">
            <div className="text-xl">{s.icon}</div>
            <p><b>{i + 1}.</b> {s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Amenities() {
  return (
    <section className="px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-500">El club</p>
        <h2 className="mt-1 text-2xl font-extrabold">Todo para tu día perfecto</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {landingContent.amenities.map((a) => (
            <div key={a.text} className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-xl">{a.icon}</span>
              <p className="mt-1 text-slate-700">{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing(props: { prices: { adult: number; child: number } }) {
  return (
    <section id="precios" className="px-5 pb-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-500">Precios</p>
        <div className="mt-4 flex gap-4">
          <div className="flex-1 rounded-2xl border-2 border-sky-500 bg-sky-50 p-5 text-center">
            <p className="text-xs font-bold uppercase text-sky-700">Adultos</p>
            <p className="text-4xl font-black">${props.prices.adult.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">por persona · Bs. al cambio BCV</p>
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-xs font-bold uppercase text-sky-700">Niños</p>
            <p className="text-4xl font-black">${props.prices.child.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">por niño · Bs. al cambio BCV</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function galleryImages(): string[] {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), 'public', 'gallery'))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .slice(0, 6)
      .map((f) => `/gallery/${f}`);
  } catch {
    return [];
  }
}

const PLACEHOLDER_GRADIENTS = [
  'from-sky-400 to-sky-700',
  'from-sky-300 to-sky-500',
  'from-sky-200 to-sky-400',
];

export function Gallery() {
  const images = galleryImages();
  return (
    <section id="galeria" className="px-5 pb-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-500">Galería</p>
        <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
          {images.length > 0
            ? images.map((src, i) => (
                <div key={src} className={`relative overflow-hidden rounded-2xl ${i === 0 ? 'row-span-2 h-48 sm:h-64' : 'h-[5.75rem] sm:h-[7.75rem]'}`}>
                  <Image src={src} alt="Foto del club" fill className="object-cover" />
                </div>
              ))
            : PLACEHOLDER_GRADIENTS.map((g, i) => (
                <div key={g} className={`rounded-2xl bg-gradient-to-br ${g} ${i === 0 ? 'row-span-2 h-48 sm:h-64' : 'h-[5.75rem] sm:h-[7.75rem]'}`} />
              ))}
        </div>
      </div>
    </section>
  );
}

export function RepeatCta() {
  return (
    <section className="px-5 pb-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-sky-500 to-sky-800 p-8 text-center text-white">
        <p className="text-xl font-extrabold">¿Listo para el sol? ☀️</p>
        <Link
          href="/reservar"
          className="mx-auto mt-4 block max-w-xs rounded-full bg-white py-3 font-extrabold text-sky-600"
        >
          Reservar mi pase
        </Link>
      </div>
    </section>
  );
}
