import Link from 'next/link';
import { CalendarCheck, ShieldCheck, Mail, Ticket, ArrowRight } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';

const features = [
  { key: 'booking', icon: CalendarCheck },
  { key: 'payment', icon: ShieldCheck },
  { key: 'email', icon: Mail },
] as const;

const stepKeys = ['date', 'group', 'pay', 'voucher'] as const;

export function Features({ t }: { t: Dictionary }) {
  return (
    <section id="como-funciona" className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mx-auto max-w-xl text-center font-heading text-4xl font-semibold leading-tight text-navy">
          {t.features.headingLine1}
          <br />
          {t.features.headingLine2}
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.key}
              className="rounded-2xl border border-border bg-card p-7 shadow-sm"
            >
              <f.icon className="h-7 w-7 text-teal" strokeWidth={1.75} />
              <h3 className="mt-5 text-lg font-bold text-navy">{t.features.items[f.key].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.features.items[f.key].body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks({ t }: { t: Dictionary }) {
  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-heading text-4xl font-semibold text-white">
          {t.howItWorks.heading}
        </h2>
        <div className="mt-14 grid grid-cols-2 gap-10 md:grid-cols-4">
          {stepKeys.map((key, i) => (
            <div key={key} className="text-center">
              <p className="font-heading text-4xl font-semibold text-teal">{String(i + 1).padStart(2, '0')}</p>
              <p className="mt-3 text-sm font-semibold text-white">{t.howItWorks.steps[key]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ t }: { t: Dictionary }) {
  return (
    <section
      id="precios"
      className="px-6 py-20 text-white"
      style={{ background: 'linear-gradient(160deg, #075e82 0%, #0c8f94 100%)' }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Ticket className="h-9 w-9 text-teal-soft" strokeWidth={1.75} />
        <h2 className="mt-5 font-heading text-4xl font-semibold leading-tight sm:text-5xl">
          {t.finalCta.heading}
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/85">
          {t.finalCta.body}
        </p>
        <Link
          href="/reservar"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-navy-deep/30 transition-transform hover:scale-[1.02]"
        >
          {t.finalCta.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
