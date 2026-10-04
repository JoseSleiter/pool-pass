'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import { getAvailability } from '@/app/actions/booking';
import { totalUsd } from '@/lib/money';
import { visitLabel, todayCaracas } from '@/lib/dates';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';

type Editing = null | 'date' | 'people';

export function HeroBookingCard(props: {
  prices: { adult: number; child: number };
  remaining: number;
  initialAvailability: Record<string, number>;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState<Editing>(null);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [date, setDate] = useState(todayCaracas());
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);

  const usd = totalUsd(adults, children, props.prices);
  const open = props.remaining > 0;
  const attendeeCount = adults + children;
  const continueHref = `/reservar?date=${date}&adults=${adults}&children=${children}&pay=1`;

  return (
    <div className="mt-12 rounded-3xl bg-card p-6 text-navy shadow-2xl shadow-navy-deep/30 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t.booking.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.booking.subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t.booking.securePayment}
        </span>
      </div>

      {/* ---- DATE EDITOR ---- */}
      {editing === 'date' && (
        <div className="mt-6 rounded-2xl bg-muted p-5">
          <h3 className="font-heading text-xl font-semibold">{t.booking.whenTitle}</h3>
          <div className="mt-4">
            <DatePickerPanel
              date={date}
              availability={availability}
              onSelect={(d) => setDate(d)}
              onMonthChange={(m) => getAvailability(m).then(setAvailability)}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">{t.booking.onlyAvailableDays}</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              {t.booking.done}
            </button>
          </div>
        </div>
      )}

      {/* ---- PEOPLE EDITOR ---- */}
      {editing === 'people' && (
        <div className="mt-6 rounded-2xl bg-muted p-5">
          <h3 className="font-heading text-xl font-semibold">{t.booking.whoTitle}</h3>
          <div className="mt-4 space-y-3">
            <CountRow
              label={t.booking.adults}
              hint={interpolate(t.booking.perPerson, { price: `$${props.prices.adult.toFixed(0)}` })}
              value={adults}
              onChange={setAdults}
              testId="hero-adults-count"
            />
            <CountRow
              label={t.booking.children}
              hint={interpolate(t.booking.perPerson, { price: `$${props.prices.child.toFixed(0)}` })}
              value={children}
              onChange={setChildren}
              testId="hero-children-count"
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">{t.booking.totalUpdates}</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              {t.booking.done}
            </button>
          </div>
        </div>
      )}

      {/* ---- TILES ---- */}
      {editing === null && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setEditing('date')}
            className="cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.booking.visitDate}</p>
                <p className="mt-1 font-heading text-lg font-semibold">{visitLabel(date, locale)}</p>
              </div>
              <CalendarCheck className="h-5 w-5 text-teal" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => setEditing('people')}
            className="cursor-pointer rounded-2xl bg-muted p-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t.booking.people}</p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {formatParty(t.party, adults, children) || t.booking.chooseAttendees}
                </p>
              </div>
              <Users className="h-5 w-5 text-teal" />
            </div>
          </button>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-xs font-medium text-secondary-foreground/70">{t.booking.estimatedTotal}</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-secondary-foreground">${usd.toFixed(0)} USD</p>
          </div>
        </div>
      )}

      {/* ---- ACTION ---- */}
      {editing === null && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
            <span className={`h-2 w-2 rounded-full ${open ? 'bg-teal' : 'bg-destructive'}`} />
            {open
              ? interpolate(t.booking.slotsToday, { count: props.remaining })
              : t.booking.noSlotsTodayPickAnother}
          </p>
          {attendeeCount === 0 ? (
            <button
              type="button"
              onClick={() => setEditing('people')}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              {t.booking.continue}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href={continueHref}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              {t.booking.continue}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
