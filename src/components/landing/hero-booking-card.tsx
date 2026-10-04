'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Baby, CalendarCheck, ShieldCheck, User, Users, Wallet } from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import { getAvailability, getCurrentRate } from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import { visitLabel, todayCaracas } from '@/lib/dates';
import { GROUP_MAX, canRemoveGuest } from '@/lib/party-limits';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';

type Step = null | 'date' | 'guests';

const TILE = 'h-full w-full rounded-2xl p-4 text-left';
const TILE_BUTTON = `${TILE} cursor-pointer bg-muted transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal`;
const STEP_BUTTON =
  'inline-flex min-h-11 cursor-pointer items-center rounded-full bg-navy px-6 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2';
const CTA =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/50 sm:w-auto motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]';

/** "$35" / "$37.50": never round a total that has cents. */
function usdLabel(n: number): string {
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
}

function StepHead(props: { n: number; label: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white"
        >
          {props.n}
        </span>
        {props.label}
      </span>
      <span aria-hidden className="text-teal">
        {props.icon}
      </span>
    </div>
  );
}

/**
 * Landing booking card as a 3-step wizard (date → guests → total). The CTA is
 * always reachable and carries the choice to /reservar in the payment view.
 */
export function HeroBookingCard(props: {
  prices: { adult: number; child: number };
  /** settings.daily_capacity: free slots on days absent from `initialAvailability`. */
  dailyCapacity: number;
  initialAvailability: Record<string, number>;
}) {
  const t = useT();
  const locale = useLocale();
  const [step, setStep] = useState<Step>(null);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [date, setDate] = useState(todayCaracas());
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  // undefined = still loading; null = BCV rate unavailable.
  const [rate, setRate] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getCurrentRate()
      .then((r) => {
        if (active) setRate(r);
      })
      .catch(() => {
        if (active) setRate(null);
      });
    return () => {
      active = false;
    };
  }, []);

  function loadMonth(month: string) {
    getAvailability(month)
      .then((next) => setAvailability((prev) => ({ ...prev, ...next })))
      .catch(() => {});
  }

  const usd = totalUsd(adults, children, props.prices);
  const remaining = availability[date] ?? props.dailyCapacity;
  const continueHref = `/reservar?date=${date}&adults=${adults}&children=${children}&pay=1`;

  return (
    <div className="mt-10 rounded-[28px] border border-white/20 bg-white/10 p-2 shadow-2xl shadow-navy-deep/40 backdrop-blur-md">
      <div className="rounded-[22px] bg-card p-4 text-navy sm:p-6">
        <h2 className="font-heading text-2xl font-semibold">{t.heroCard.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.heroCard.subtitle}</p>

        {/* ---- SUMMARY: the three steps ---- */}
        {step === null && (
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            <li>
              <button
                type="button"
                data-testid="hero-step-date"
                onClick={() => setStep('date')}
                className={TILE_BUTTON}
              >
                <StepHead n={1} label={t.heroCard.stepDate} icon={<CalendarCheck className="h-5 w-5" />} />
                <p className="mt-2 font-heading text-lg font-semibold">{visitLabel(date, locale)}</p>
                <p
                  className={`mt-0.5 text-xs font-semibold ${remaining > 0 ? 'text-secondary-foreground' : 'text-destructive'}`}
                >
                  {remaining > 0
                    ? interpolate(t.heroCard.slotsOnDate, { count: remaining })
                    : t.heroCard.noSlotsOnDate}
                </p>
              </button>
            </li>
            <li>
              <button
                type="button"
                data-testid="hero-step-guests"
                onClick={() => setStep('guests')}
                className={TILE_BUTTON}
              >
                <StepHead n={2} label={t.heroCard.stepGuests} icon={<Users className="h-5 w-5" />} />
                <p className="mt-2 font-heading text-lg font-semibold">
                  {formatParty(t.party, adults, children)}
                </p>
                <p aria-hidden className="mt-0.5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {adults}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Baby className="h-3.5 w-3.5" />
                    {children}
                  </span>
                </p>
              </button>
            </li>
            <li>
              <div className={`${TILE} bg-secondary`} aria-live="polite">
                <StepHead n={3} label={t.heroCard.stepTotal} icon={<Wallet className="h-5 w-5" />} />
                <p
                  data-testid="hero-total-usd"
                  className="mt-2 font-heading text-2xl font-semibold text-secondary-foreground"
                >
                  ${usdLabel(usd)} USD
                </p>
                <p className="mt-0.5 min-h-4 text-xs text-secondary-foreground/80">
                  {rate === undefined
                    ? null
                    : rate === null
                      ? t.heroCard.rateUnavailable
                      : interpolate(t.heroCard.rateLine, {
                          ves: usdToVes(usd, rate).toFixed(2),
                          rate: rate.toFixed(2),
                        })}
                </p>
              </div>
            </li>
          </ol>
        )}

        {/* ---- STEP 1: DATE ---- */}
        {step === 'date' && (
          <section aria-labelledby="hero-date-title" className="mt-5 rounded-2xl bg-muted p-2 sm:p-5">
            <div className="px-2 pt-2 sm:p-0">
              <p className="text-xs font-semibold text-muted-foreground">
                {interpolate(t.heroCard.stepOf, { n: 1 })}
              </p>
              <h3 id="hero-date-title" className="font-heading text-xl font-semibold">
                {t.heroCard.whenTitle}
              </h3>
            </div>
            <div className="mt-3">
              <DatePickerPanel
                date={date}
                availability={availability}
                defaultCapacity={props.dailyCapacity}
                onSelect={setDate}
                onMonthChange={loadMonth}
              />
            </div>
            <div className="mt-3 flex justify-end px-2 pb-2 sm:p-0">
              <button type="button" onClick={() => setStep('guests')} className={STEP_BUTTON}>
                {t.heroCard.next}
              </button>
            </div>
          </section>
        )}

        {/* ---- STEP 2: GUESTS ---- */}
        {step === 'guests' && (
          <section aria-labelledby="hero-guests-title" className="mt-5 rounded-2xl bg-muted p-3 sm:p-5">
            <p className="text-xs font-semibold text-muted-foreground">
              {interpolate(t.heroCard.stepOf, { n: 2 })}
            </p>
            <h3 id="hero-guests-title" className="font-heading text-xl font-semibold">
              {t.heroCard.whoTitle}
            </h3>
            <div className="mt-4 space-y-3">
              <CountRow
                label={t.heroCard.adults}
                hint={interpolate(t.heroCard.perPerson, { price: `$${usdLabel(props.prices.adult)}` })}
                icon={<User data-testid="icon-adult" className="h-5 w-5" />}
                value={adults}
                onChange={setAdults}
                canDecrease={canRemoveGuest(adults, adults, children)}
                testId="hero-adults-count"
              />
              <CountRow
                label={t.heroCard.children}
                hint={interpolate(t.heroCard.perPerson, { price: `$${usdLabel(props.prices.child)}` })}
                icon={<Baby data-testid="icon-child" className="h-5 w-5" />}
                value={children}
                onChange={setChildren}
                canDecrease={canRemoveGuest(children, adults, children)}
                testId="hero-children-count"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-secondary-foreground">
                {interpolate(t.heroCard.partyLimit, { max: GROUP_MAX })}
              </p>
              <button type="button" onClick={() => setStep(null)} className={STEP_BUTTON}>
                {t.heroCard.seeTotal}
              </button>
            </div>
          </section>
        )}

        {/* ---- CTA (always reachable) ---- */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground">
            <ShieldCheck aria-hidden className="h-4 w-4" />
            {t.heroCard.securePayment}
          </p>
          <Link href={continueHref} className={CTA}>
            {t.heroCard.cta}
            <ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
