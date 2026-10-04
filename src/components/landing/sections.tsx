import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CircleParking,
  Clock,
  CreditCard,
  LifeBuoy,
  Mail,
  QrCode,
  ShieldCheck,
  ShowerHead,
  Ticket,
  Umbrella,
  Users,
  UtensilsCrossed,
  WavesLadder,
  type LucideIcon,
} from 'lucide-react';
import { RevealOnScroll } from '@/components/landing/reveal-on-scroll';
import { landingContent, type Amenity } from '@/lib/landing-content';
import type { Dictionary } from '@/lib/i18n/types';
import { cn } from '@/lib/utils';

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

type AmenityId = Amenity['id'];

const amenityIcons: Record<AmenityId, LucideIcon> = {
  pool: WavesLadder,
  lifeguards: LifeBuoy,
  food: UtensilsCrossed,
  parking: CircleParking,
  shade: Umbrella,
  showers: ShowerHead,
};

/**
 * Bento layout: 4 columns × 3 rows from `md` (pool 2×2; food, shade and
 * showers 2 wide), 2 columns on mobile. The grid uses `grid-flow-row-dense`
 * so `parking` backfills the cell beside `lifeguards` although `food` comes
 * first in the data. Every tone is dark enough for the white glass label.
 */
const amenityTiles: Record<AmenityId, string> = {
  pool: 'col-span-2 row-span-2 bg-linear-to-br from-teal via-teal/70 to-navy',
  lifeguards: 'bg-linear-to-br from-navy to-navy-deep',
  food: 'col-span-2 bg-linear-to-r from-navy-deep via-navy to-teal/80',
  parking: 'bg-linear-to-bl from-teal/80 to-navy-deep',
  shade: 'md:col-span-2 bg-linear-to-tr from-navy-deep to-teal/70',
  showers: 'md:col-span-2 bg-linear-to-br from-navy to-teal/60',
};

/** Rule texts for `landingContent.rules`, in the visitor's language. */
function ruleTexts(t: Dictionary): string[] {
  // `t.amenities.rules` is `{}` until the owner adds rules, so its key type
  // is `never`; widen it to look the ids up.
  const texts = t.amenities.rules as Record<string, string>;
  return landingContent.rules.map((id) => texts[id]);
}

/** Stand-in for a real photo: layered waves, a light caustic and the amenity icon. */
function WaterPlaceholder({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden data-slot="amenity-placeholder" className="absolute inset-0 -z-10">
      <span className="absolute inset-0 bg-radial-[at_25%_15%] from-white/25 to-transparent to-60%" />
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-3/5 w-full text-white"
      >
        <path d="M0 38 Q25 26 50 38 T100 38 T150 38 T200 38 V120 H0 Z" fill="currentColor" fillOpacity="0.08" />
        <path d="M0 64 Q25 52 50 64 T100 64 T150 64 T200 64 V120 H0 Z" fill="currentColor" fillOpacity="0.1" />
        <path d="M0 90 Q25 80 50 90 T100 90 T150 90 T200 90 V120 H0 Z" fill="currentColor" fillOpacity="0.12" />
      </svg>
      <Icon className="absolute right-4 top-4 size-14 text-white/20" strokeWidth={1.25} />
    </span>
  );
}

/**
 * "#amenidades": bento grid of the club's amenities with glass labels, then
 * the opening hours and — only when the owner has provided them — the pool
 * rules. `items` and `rules` default to landingContent; tests override them.
 */
export function Amenities({
  t,
  items = landingContent.amenities,
  rules = ruleTexts(t),
}: {
  t: Dictionary;
  items?: readonly Amenity[];
  rules?: readonly string[];
}) {
  return (
    <section id="amenidades" aria-labelledby="amenidades-heading" className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2
          id="amenidades-heading"
          className="max-w-xl font-heading text-4xl font-semibold leading-tight text-navy"
        >
          {t.amenities.heading}
        </h2>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">{t.amenities.body}</p>

        <ul className="mt-10 grid grid-flow-row-dense auto-rows-[9.5rem] grid-cols-2 gap-3 md:auto-rows-[11rem] md:grid-cols-4 md:gap-4">
          {items.map((amenity) => {
            const Icon = amenityIcons[amenity.id];
            return (
              <li
                key={amenity.id}
                data-slot="amenity-tile"
                className={cn('relative isolate overflow-hidden rounded-3xl', amenityTiles[amenity.id])}
              >
                {amenity.image ? (
                  <>
                    <Image
                      src={amenity.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="-z-10 object-cover"
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 -z-10 bg-linear-to-t from-navy-deep/70 via-transparent to-transparent"
                    />
                  </>
                ) : (
                  <WaterPlaceholder icon={Icon} />
                )}
                <span className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-3.5 py-2.5 text-sm font-semibold leading-snug text-white shadow-lg shadow-navy-deep/20 backdrop-blur-md">
                  <Icon aria-hidden className="size-4 shrink-0 text-teal-soft" strokeWidth={2} />
                  {t.content.amenities[amenity.id]}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-6 rounded-3xl bg-mint p-6 text-navy md:flex-row md:p-8">
          <div className="flex items-start gap-4 md:w-1/3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-teal">
              <Clock aria-hidden className="size-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="font-heading text-xl font-semibold">{t.amenities.scheduleHeading}</h3>
              <p className="mt-1 text-sm text-navy/80">{t.content.hours}</p>
            </div>
          </div>
          {rules.length > 0 && (
            <div className="md:flex-1 md:border-l md:border-teal/30 md:pl-8">
              <h3 id="amenidades-rules-heading" className="font-heading text-xl font-semibold">
                {t.amenities.rulesHeading}
              </h3>
              <ul
                aria-labelledby="amenidades-rules-heading"
                className="mt-3 grid gap-2 text-sm text-navy/80 sm:grid-cols-2"
              >
                {rules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
