'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import {
  CalendarCheck,
  Users,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { DatePickerPanel } from '@/components/booking/date-picker-panel';
import { CountRow } from '@/components/booking/count-row';
import {
  getAvailability,
  getCurrentRate,
  submitBookingAndPay,
} from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import { shortDateLabel, visitLabel } from '@/lib/dates';
import { paymentSchema } from '@/lib/schemas';
import { VENEZUELAN_BANKS } from '@/lib/banks';
import { whatsappUrl } from '@/lib/landing-content';
import { Logo } from '@/components/brand/logo';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';
import { validationKey, type ValidationKey } from '@/lib/i18n/validation';
import { submitErrorMessage, type SubmitFailure } from '@/lib/i18n/booking-errors';
import type { BookingResult } from '@/lib/booking/process';

type Confirmed = Extract<BookingResult, { ok: true }>['reservation'];
type View = 'summary' | 'pay' | 'pending' | 'done';
type Editing = null | 'date' | 'people';

export function BookingCard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
  remaining: number;
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [idType, setIdType] = useState<'V' | 'E' | 'P' | 'J'>('V');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [otp, setOtp] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: real users leave this empty
  const [rate, setRate] = useState<number | null>(null);
  // Errors are kept as dictionary keys / raw failures, not strings: a language
  // switch (router.refresh keeps client state) then re-renders them translated.
  const [errors, setErrors] = useState<Partial<Record<string, ValidationKey>>>({});
  const [submitFailure, setSubmitFailure] = useState<SubmitFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<Confirmed | null>(null);

  const usd = totalUsd(adults, children, props.prices);
  const attendeeCount = adults + children;
  const remaining = props.remaining;

  function fieldError(field: string): string | undefined {
    const key = errors[field];
    return key ? t.validation[key] : undefined;
  }

  // Fetch the BCV rate whenever we're in the payment view and don't have it yet.
  useEffect(() => {
    if (view === 'pay' && rate === null) {
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
    const payload = { date, adults, children, firstName, lastName, email, idType, idNumber, phone, bankCode, otp };
    const parsed = paymentSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Partial<Record<string, ValidationKey>> = {};
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
        setOtp('');
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

  const idLabel = `${idType}-${idNumber}`;
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
            ? interpolate(t.booking.slotsToday, { count: remaining })
            : t.booking.noSlotsToday}
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

      {/* ---- SUMMARY action ---- */}
      {view === 'summary' && editing === null && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={goToPay}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
          >
            {t.booking.continue}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ---- PAY form ---- */}
      {view === 'pay' && editing === null && (
        <>
          <div className="mt-5 rounded-2xl bg-muted p-5">
            <h2 className="font-heading text-xl font-semibold">{t.pay.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.pay.intro}</p>

            {/* Honeypot: hidden from real users, catches naive bots. Do not remove. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>
                {t.pay.honeypot}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.pay.firstName} value={firstName} onChange={setFirstName} error={fieldError('firstName')} autoComplete="given-name" />
                <Field label={t.pay.lastName} value={lastName} onChange={setLastName} error={fieldError('lastName')} autoComplete="family-name" />
              </div>
              <Field label={t.pay.email} value={email} onChange={setEmail} error={fieldError('email')} type="email" autoComplete="email" />

              <div className="rounded-xl border border-border bg-card px-4 py-2.5">
                <span className="block text-xs font-medium text-muted-foreground">{t.pay.idLabel}</span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={t.pay.idType}
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as typeof idType)}
                    className="-ml-1 bg-transparent py-1 font-semibold text-navy outline-none"
                  >
                    {(['V', 'E', 'P', 'J'] as const).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">·</span>
                  <input
                    aria-label={t.pay.idNumber}
                    inputMode="numeric"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="12345678"
                    className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
                  />
                </div>
                {fieldError('idNumber') && <p className="text-xs text-destructive">{fieldError('idNumber')}</p>}
              </div>

              <Field label={t.pay.phone} value={phone} onChange={setPhone} error={fieldError('phone')} placeholder="04141234567" inputMode="tel" autoComplete="tel" />

              <div className="rounded-xl border border-border bg-card px-4 py-2.5">
                <span className="block text-xs font-medium text-muted-foreground">{t.pay.bank}</span>
                <select
                  aria-label={t.pay.bank}
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full bg-transparent py-1 font-semibold text-navy outline-none"
                >
                  <option value="">{t.pay.bankPlaceholder}</option>
                  {VENEZUELAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>{b.code} — {b.name}</option>
                  ))}
                </select>
                {fieldError('bankCode') && <p className="text-xs text-destructive">{fieldError('bankCode')}</p>}
              </div>

              <Field label={t.pay.otp} value={otp} onChange={setOtp} error={fieldError('otp')} type="password" inputMode="numeric" hint={t.pay.otpHint} />
            </div>
          </div>

          <button
            type="button"
            onClick={confirmAndPay}
            disabled={submitting}
            className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t.pay.submitting : t.pay.submit}
            {!submitting && <Lock className="h-4 w-4" />}
          </button>
        </>
      )}

      {/* ---- PENDING ---- */}
      {view === 'pending' && (
        <div className="mt-5 rounded-2xl bg-amber-50 p-6 text-center ring-1 ring-amber-200">
          <div className="text-4xl">⏳</div>
          <h2 className="mt-2 font-heading text-xl font-semibold text-amber-900">{t.pending.title}</h2>
          <p className="mt-2 text-sm text-amber-800">{t.pending.message}</p>
          <p className="mt-2 text-sm text-amber-800">{t.pending.doNotRetry}</p>
        </div>
      )}

      {/* ---- DONE ---- */}
      {view === 'done' && reservation && (
        <div className="mt-5 rounded-2xl bg-muted p-6 text-center">
          <p className="font-heading text-xl font-semibold">{t.done.confirmed}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.done.sentTo} <strong className="text-navy">{email}</strong>.{' '}
            {t.done.showAtEntrance}
          </p>
          <div className="mx-auto mt-5 max-w-sm overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            <div className="bg-navy p-4 text-white">
              {/* The margin belongs on this wrapper, not on Logo's className:
                  that lands on the img inside the chip, padding the white
                  pill instead of separating it from the label below. */}
              <div className="mb-3">
                <Logo variant="chip" className="h-9 w-auto" />
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-teal-soft">{t.done.dayPass}</p>
              <p data-testid="reservation-code" className="font-heading text-3xl font-semibold tracking-wider">{reservation.code}</p>
            </div>
            <div className="p-5">
              <Image
                unoptimized
                src={`/api/qr/${reservation.id}`}
                alt={t.done.qrAlt}
                width={168}
                height={168}
                className="mx-auto rounded-lg"
              />
              <div className="mt-4 space-y-1 text-left text-sm">
                <p><strong>{t.done.name}</strong> {firstName} {lastName}</p>
                <p><strong>{t.done.document}</strong> {idLabel}</p>
                <p><strong>{t.done.date}</strong> {shortDateLabel(date, locale)}</p>
                <p><strong>{t.done.attendees}</strong> {formatParty(t.party, adults, children)}</p>
                <p><strong>{t.done.paid}</strong> ${reservation.totalUsd.toFixed(2)} USD · Bs. {reservation.totalVes.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <a href={whatsappUrl()} className="mt-5 inline-block rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground">
            {t.done.whatsapp}
          </a>
        </div>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block rounded-xl border border-border bg-card px-4 py-2.5">
        <span className="block text-xs font-medium text-muted-foreground">{props.label}</span>
        <input
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
      </label>
      {props.error && <p className="mt-1 text-xs text-destructive">{props.error}</p>}
      {props.hint && !props.error && <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
