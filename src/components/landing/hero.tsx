import { HeroBookingCard } from '@/components/landing/hero-booking-card';
import { TodayBadge, WeekendChip } from '@/components/landing/hero-signals';
import type { Dictionary } from '@/lib/i18n/types';
import type { TodayCapacity } from '@/lib/availability';

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

/** Low-contrast water: two tiled rows of waves. Static, pure SVG, no image request. */
function WaterPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-teal opacity-[0.12]"
    >
      <defs>
        <pattern id="hero-waves" width="160" height="48" patternUnits="userSpaceOnUse">
          <path
            d="M0 20c20 0 20-10 40-10s20 10 40 10 20-10 40-10 20 10 40 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M0 42c20 0 20-6 40-6s20 6 40 6 20-6 40-6 20 6 40 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hero-waves)" />
    </svg>
  );
}

const BACKGROUND =
  'linear-gradient(165deg, var(--navy-deep) 0%, var(--navy) 50%, var(--chart-2) 100%)';
const GLOW =
  'radial-gradient(55% 45% at 88% 8%, color-mix(in oklab, var(--teal) 32%, transparent), transparent 70%)';

export function Hero(props: {
  t: Dictionary;
  today: TodayCapacity;
  weekendPeople: number | null;
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
}) {
  const { t } = props;
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: BACKGROUND }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: GLOW }} />
      <WaterPattern />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-14">
        <div className="grid items-start gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
          <div>
            <p className="text-sm font-semibold text-teal-soft">{t.content.tagline}</p>
            <h1 className="mt-4 font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLine2}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">{t.hero.body}</p>
            <p className="mt-6 text-sm font-semibold text-white/90">
              {t.hero.adultsFrom}&nbsp;
              <span className="text-white">${props.prices.adult.toFixed(0)}</span>
              <span aria-hidden className="mx-3 text-white/40">·</span>
              {t.hero.kids}&nbsp;
              <span className="text-white">${props.prices.child.toFixed(0)}</span>
            </p>
            <WeekendChip t={t} people={props.weekendPeople} className="mt-6" />
          </div>

          <div className="flex min-h-[260px] flex-col items-center justify-center gap-6 rounded-[28px] border border-white/20 bg-white/10 p-8 backdrop-blur-md">
            <div className="text-teal-soft">
              <PoolMark />
            </div>
            <TodayBadge t={t} remaining={props.today.remaining} capacity={props.today.capacity} />
          </div>
        </div>

        <HeroBookingCard
          prices={props.prices}
          dailyCapacity={props.today.dailyCapacity}
          initialAvailability={props.initialAvailability}
        />
      </div>
    </section>
  );
}
