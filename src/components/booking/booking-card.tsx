'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, Users, ShieldCheck } from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import { SummaryStep } from '@/components/booking/summary-step';
import { PayForm, EMPTY_PAY_FORM, type PayFormErrors, type PayFormValues } from '@/components/booking/pay-form';
import { PendingView } from '@/components/booking/pending-view';
import { Voucher, type ConfirmedReservation } from '@/components/booking/voucher';
import {
  getAvailability,
  getCurrentRate,
  submitBookingAndPay,
} from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import { visitLabel } from '@/lib/dates';
import { remainingOn } from '@/lib/availability';
import { paymentSchema } from '@/lib/schemas';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';
import { validationKey } from '@/lib/i18n/validation';
import { submitErrorMessage, type SubmitFailure } from '@/lib/i18n/booking-errors';

type View = 'summary' | 'pay' | 'pending' | 'done';
type Editing = null | 'date' | 'people';

/**
 * Checkout state machine: summary → pay → (pending | done). Owns all state,
 * the server-action calls and the error handling; each view is presentational
 * (summary-step, pay-form, pending-view, voucher).
 */
export function BookingCard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
  remaining: number;
  /** settings.daily_capacity: lets the calendar label days with no bookings yet ("Quedan N"). */
  dailyCapacity?: number;
  startAtPay?: boolean;
  initialDate?: string;
  initialAdults?: number;
  initialChildren?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState<View>(props.startAtPay ? 'pay' : 'summary');
  const [editing, setEditing] = useState<Editing>(null);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [date, setDate] = useState(props.initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [adults, setAdults] = useState(props.initialAdults ?? 2);
  const [children, setChildren] = useState(props.initialChildren ?? 1);
  const [form, setForm] = useState<PayFormValues>(EMPTY_PAY_FORM);
  const [rate, setRate] = useState<number | null>(null);
  // Errors are kept as dictionary keys / raw failures, not strings: a language
  // switch (router.refresh keeps client state) then re-renders them translated.
  const [errors, setErrors] = useState<PayFormErrors>({});
  const [submitFailure, setSubmitFailure] = useState<SubmitFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<ConfirmedReservation | null>(null);

  const usd = totalUsd(adults, children, props.prices);
  const attendeeCount = adults + children;
  // Spots left on the *selected* date (props.remaining is today's count and only a
  // fallback when the page didn't pass the daily capacity).
  const remaining =
    remainingOn(date, availability, props.dailyCapacity) ?? props.remaining;

  function setField<K extends keyof PayFormValues>(key: K, value: PayFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Fetch the BCV rate on the summary (price breakdown) and payment views
  // while we don't have it yet.
  useEffect(() => {
    if ((view === 'summary' || view === 'pay') && rate === null) {
      getCurrentRate().then(setRate).catch(() => setRate(null));
    }
  }, [view, rate]);

  function goToPay() {
    if (attendeeCount === 0) {
      setEditing('people');
      return;
    }
    setView('pay');
  }

  async function confirmAndPay() {
    if (adults + children === 0) {
      setSubmitFailure({ ok: false, error: 'no_attendees' });
      setEditing('people');
      return;
    }
    const { website, ...fields } = form;
    const payload = { date, adults, children, ...fields };
    const parsed = paymentSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: PayFormErrors = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = validationKey(issue);
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitFailure(null);
    setSubmitting(true);
    // Include the honeypot in the raw payload; the schema strips it but the
    // server drops the request if a bot filled it.
    const result = await submitBookingAndPay({ ...parsed.data, website });
    setSubmitting(false);
    if (result.ok) {
      setReservation(result.reservation);
      setView('done');
      return;
    }
    switch (result.error) {
      case 'capacity':
        setSubmitFailure(result);
        setEditing('date');
        getAvailability(date.slice(0, 7)).then(setAvailability);
        break;
      case 'payment_declined':
        setSubmitFailure(result);
        setField('otp', '');
        break;
      case 'payment_pending':
        // The server always sends the same sentence; the dictionary holds it
        // in both languages (pending.message).
        setView('pending');
        break;
      default:
        setSubmitFailure(result);
    }
  }

  const showTiles = (view === 'summary' || view === 'pay') && editing === null;

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-card p-6 text-navy shadow-2xl shadow-navy-deep/10 ring-1 ring-border sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {view === 'done' ? t.booking.titleDone : t.booking.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === 'done' ? t.booking.subtitleDone : t.booking.subtitle}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t.booking.securePayment}
        </span>
      </div>

      {view !== 'pending' && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary-foreground">
          <span className={`h-2 w-2 rounded-full ${remaining > 0 ? 'bg-teal' : 'bg-destructive'}`} />
          {remaining > 0
            ? interpolate(t.booking.slotsOnDate, { count: remaining })
            : t.booking.noSlotsOnDate}
        </p>
      )}

      {submitFailure && view !== 'done' && view !== 'pending' && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {submitErrorMessage(submitFailure, t)}
        </p>
      )}

      {/* ---- DATE EDITOR ---- */}
      {editing === 'date' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h2 className="font-heading text-xl font-semibold">{t.booking.whenTitle}</h2>
          <div className="mt-4">
            <DatePickerPanel
              date={date}
              availability={availability}
              defaultCapacity={props.dailyCapacity}
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
      {editing === 'people' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h2 className="font-heading text-xl font-semibold">{t.booking.whoTitle}</h2>
          <div className="mt-4 space-y-3">
            <CountRow
              label={t.booking.adults}
              hint={interpolate(t.booking.perPerson, { price: `$${props.prices.adult.toFixed(0)}` })}
              value={adults}
              onChange={setAdults}
              testId="adults-count"
            />
            <CountRow
              label={t.booking.children}
              hint={interpolate(t.booking.perPerson, { price: `$${props.prices.child.toFixed(0)}` })}
              value={children}
              onChange={setChildren}
              testId="children-count"
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

      {/* ---- TILES (summary + pay) ---- */}
      {showTiles && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
            <p data-testid="total-usd" className="mt-1 font-heading text-2xl font-semibold text-secondary-foreground">${usd.toFixed(0)} USD</p>
            {view === 'pay' && rate !== null && (
              <p className="mt-0.5 text-xs text-secondary-foreground/80">
                {interpolate(t.booking.rateLine, {
                  ves: usdToVes(usd, rate).toFixed(2),
                  rate: rate.toFixed(2),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'summary' && editing === null && (
        <SummaryStep prices={props.prices} party={{ adults, children }} rate={rate} onContinue={goToPay} />
      )}

      {view === 'pay' && editing === null && (
        <PayForm values={form} onChange={setField} errors={errors} submitting={submitting} onSubmit={confirmAndPay} />
      )}

      {view === 'pending' && <PendingView />}

      {view === 'done' && reservation && (
        <Voucher
          reservation={reservation}
          email={form.email}
          firstName={form.firstName}
          lastName={form.lastName}
          idLabel={`${form.idType}-${form.idNumber}`}
          date={date}
          party={{ adults, children }}
        />
      )}
    </div>
  );
}
