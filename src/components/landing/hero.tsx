import { HeroBookingCard } from '@/components/landing/hero-booking-card';
import type { Dictionary } from '@/lib/i18n/types';

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

export function Hero(props: {
  t: Dictionary;
  remaining: number;
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
}) {
  const { t } = props;
  const open = props.remaining > 0;
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: 'linear-gradient(145deg, #0b2a4a 0%, #075e82 58%, #0bc4c7 100%)' }}
    >
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-14">
        {/* Top: copy + floating pool card */}
        <div className="grid items-start gap-10 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-soft">
              {t.content.tagline}
            </p>
            <h1 className="mt-5 font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLine2}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
              {t.hero.body}
            </p>
            <p className="mt-6 text-sm font-semibold text-white/90">
              {t.hero.adultsFrom}&nbsp;
              <span className="text-white">${props.prices.adult.toFixed(0)}</span>
              <span className="mx-3 text-white/40">·</span>
              {t.hero.kids}&nbsp;
              <span className="text-white">${props.prices.child.toFixed(0)}</span>
            </p>
          </div>

          <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-white/15 bg-white/10 p-8 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-teal-soft">
              <PoolMark />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                {open ? t.hero.poolOpen : t.hero.soldOutToday}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive booking card */}
        <HeroBookingCard
          prices={props.prices}
          remaining={props.remaining}
          initialAvailability={props.initialAvailability}
        />
      </div>
    </section>
  );
}
