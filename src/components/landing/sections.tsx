import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CreditCard,
  Mail,
  QrCode,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll';
import type { Dictionary } from '@/lib/i18n/types';

const features = [
  { key: 'booking', icon: CalendarCheck },
  { key: 'payment', icon: ShieldCheck },
  { key: 'email', icon: Mail },
] as const;

/** The booking trail, in order. Keys point into `t.howItWorks.steps` / `.details`. */
const steps = [
  { key: 'date', icon: Calendar },
  { key: 'group', icon: Users },
  { key: 'pay', icon: CreditCard },
  { key: 'voucher', icon: QrCode },
] as const;

/** Delay between consecutive steps of the reveal, in ms. */
const STEP_STAGGER_MS = 120;

export function Features({ t }: { t: Dictionary }) {
  return (
    <section className="bg-background px-6 py-20">
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

/**
 * "#como-funciona": four steps joined by a teal line — vertical on the left
 * on mobile, horizontal between the icons from `md`. Each step fades up as
 * it scrolls in (RevealOnScroll); connectors stay static so the trail reads
 * even if JS never runs.
 */
export function HowItWorks({ t }: { t: Dictionary }) {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-heading"
      className="bg-navy px-6 py-20"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="como-funciona-heading"
          className="text-center font-heading text-4xl font-semibold text-white"
        >
          {t.howItWorks.heading}
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          {steps.map((step, i) => (
            <li key={step.key} className="relative">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  data-slot="step-connector"
                  className="absolute -bottom-8 left-7 top-16 w-0.5 -translate-x-1/2 rounded-full bg-linear-to-b from-teal to-teal/25 md:bottom-auto md:left-[calc(50%+2.25rem)] md:top-7 md:h-0.5 md:w-[calc(100%-3rem)] md:translate-x-0 md:bg-linear-to-r"
                />
              )}
              <RevealOnScroll
                delayMs={i * STEP_STAGGER_MS}
                className="flex gap-5 md:flex-col md:items-center md:text-center"
              >
                <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-teal bg-navy-deep text-teal-soft">
                  <step.icon aria-hidden className="size-6" strokeWidth={1.75} />
                </span>
                <div className="pt-1 md:pt-0">
                  <p className="font-heading text-sm font-semibold text-teal">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-white">{t.howItWorks.steps[step.key]}</h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-white/70 md:mx-auto">
                    {t.howItWorks.details[step.key]}
                  </p>
                </div>
              </RevealOnScroll>
            </li>
          ))}
        </ol>
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
