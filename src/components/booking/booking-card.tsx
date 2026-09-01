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
import { partyLabel } from '@/lib/party';
import { shortDateEs, visitLabelEs } from '@/lib/dates';
import { paymentSchema } from '@/lib/schemas';
import { VENEZUELAN_BANKS } from '@/lib/banks';
import { whatsappUrl } from '@/lib/landing-content';
import { Logo } from '@/components/brand/logo';
import type { BookingResult } from '@/lib/booking/process';

type Confirmed = Extract<BookingResult, { ok: true }>['reservation'];
type View = 'summary' | 'pay' | 'pending' | 'done';
type Editing = null | 'date' | 'people';

function capitalize(s: string): string {
  // Capitalize the first letter of each space-delimited token. A \b\p{L} regex
  // would misfire on accented weekdays (JS word boundaries are ASCII-based),
  // producing "MiÉ"/"SÁb" instead of "Mié"/"Sáb".
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function BookingCard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
  remaining: number;
  startAtPay?: boolean;
  initialDate?: string;
  initialAdults?: number;
  initialChildren?: number;
}) {
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<Confirmed | null>(null);

  const usd = totalUsd(adults, children, props.prices);
  const attendeeCount = adults + children;
  const remaining = props.remaining;

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
      setSubmitError('Agrega al menos un asistente para continuar.');
      setEditing('people');
      return;
    }
    const payload = { date, adults, children, firstName, lastName, email, idType, idNumber, phone, bankCode, otp };
    const parsed = paymentSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitError(null);
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
        setSubmitError(`Ya no hay cupo suficiente para esa fecha. Quedan ${result.remaining} puestos. Elige otra fecha.`);
        setEditing('date');
        getAvailability(date.slice(0, 7)).then(setAvailability);
        break;
      case 'payment_declined':
        setSubmitError(`Pago rechazado: ${result.message}. Genera una nueva clave C2P e intenta de nuevo.`);
        setOtp('');
        break;
      case 'payment_pending':
        setPendingMessage(result.message);
        setView('pending');
        break;
      default:
        setSubmitError(result.message);
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
            {view === 'done' ? 'Tu pase está listo' : 'Reserva tu pase'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === 'done'
              ? 'Guarda este comprobante para el acceso'
              : 'Completa estos datos para ver tu total'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pago seguro
        </span>
      </div>

      {view !== 'pending' && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary-foreground">
          <span className={`h-2 w-2 rounded-full ${remaining > 0 ? 'bg-teal' : 'bg-destructive'}`} />
          {remaining > 0 ? `${remaining} cupos disponibles hoy` : 'Sin cupos hoy'}
        </p>
      )}

      {submitError && view !== 'done' && view !== 'pending' && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      {/* ---- DATE EDITOR ---- */}
      {editing === 'date' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h2 className="font-heading text-xl font-semibold">¿Cuándo vienes?</h2>
          <div className="mt-4">
            <DatePickerPanel
              date={date}
              availability={availability}
              onSelect={(d) => setDate(d)}
              onMonthChange={(m) => getAvailability(m).then(setAvailability)}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">Solo mostramos días con cupo disponible</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* ---- PEOPLE EDITOR ---- */}
      {editing === 'people' && (view === 'summary' || view === 'pay') && (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h2 className="font-heading text-xl font-semibold">¿Quiénes van?</h2>
          <div className="mt-4 space-y-3">
            <CountRow label="Adultos" hint={`$${props.prices.adult.toFixed(0)} por persona`} value={adults} onChange={setAdults} testId="adults-count" />
            <CountRow label="Niños" hint={`$${props.prices.child.toFixed(0)} por persona`} value={children} onChange={setChildren} testId="children-count" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-secondary-foreground">El total se actualiza automáticamente</p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white"
            >
              Listo
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
                <p className="text-xs font-medium text-muted-foreground">Fecha de visita</p>
                <p className="mt-1 font-heading text-lg font-semibold">{visitLabelEs(date)}</p>
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
                <p className="text-xs font-medium text-muted-foreground">Personas</p>
                <p className="mt-1 font-heading text-lg font-semibold">{partyLabel(adults, children) || 'Elige asistentes'}</p>
              </div>
              <Users className="h-5 w-5 text-teal" />
            </div>
          </button>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-xs font-medium text-secondary-foreground/70">Total estimado</p>
            <p data-testid="total-usd" className="mt-1 font-heading text-2xl font-semibold text-secondary-foreground">${usd.toFixed(0)} USD</p>
            {view === 'pay' && rate !== null && (
              <p className="mt-0.5 text-xs text-secondary-foreground/80">Bs. {usdToVes(usd, rate).toFixed(2)} · tasa {rate.toFixed(2)}</p>
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
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ---- PAY form ---- */}
      {view === 'pay' && editing === null && (
        <>
          <div className="mt-5 rounded-2xl bg-muted p-5">
            <h2 className="font-heading text-xl font-semibold">Datos para confirmar tu reserva</h2>
            <p className="mt-1 text-sm text-muted-foreground">Usaremos estos datos para validar tu identidad y procesar el Pago Móvil.</p>

            {/* Honeypot: hidden from real users, catches naive bots. Do not remove. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>
                No llenar este campo
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
                <Field label="Nombre" value={firstName} onChange={setFirstName} error={errors.firstName} autoComplete="given-name" />
                <Field label="Apellido" value={lastName} onChange={setLastName} error={errors.lastName} autoComplete="family-name" />
              </div>
              <Field label="Correo electrónico" value={email} onChange={setEmail} error={errors.email} type="email" autoComplete="email" />

              <div className="rounded-xl border border-border bg-card px-4 py-2.5">
                <span className="block text-xs font-medium text-muted-foreground">Cédula / RIF</span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Tipo de documento"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as typeof idType)}
                    className="-ml-1 bg-transparent py-1 font-semibold text-navy outline-none"
                  >
                    {(['V', 'E', 'P', 'J'] as const).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">·</span>
                  <input
                    aria-label="Número de documento"
                    inputMode="numeric"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="12345678"
                    className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
                  />
                </div>
                {errors.idNumber && <p className="text-xs text-destructive">{errors.idNumber}</p>}
              </div>

              <Field label="Teléfono" value={phone} onChange={setPhone} error={errors.phone} placeholder="04141234567" inputMode="tel" autoComplete="tel" />

              <div className="rounded-xl border border-border bg-card px-4 py-2.5">
                <span className="block text-xs font-medium text-muted-foreground">Banco</span>
                <select
                  aria-label="Banco"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full bg-transparent py-1 font-semibold text-navy outline-none"
                >
                  <option value="">Selecciona tu banco</option>
                  {VENEZUELAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>{b.code} — {b.name}</option>
                  ))}
                </select>
                {errors.bankCode && <p className="text-xs text-destructive">{errors.bankCode}</p>}
              </div>

              <Field label="Clave de Pago (C2P)" value={otp} onChange={setOtp} error={errors.otp} type="password" inputMode="numeric" hint="Genera la clave C2P desde la app de tu banco antes de pagar." />
            </div>
          </div>

          <button
            type="button"
            onClick={confirmAndPay}
            disabled={submitting}
            className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Procesando…' : 'Confirmar y pagar'}
            {!submitting && <Lock className="h-4 w-4" />}
          </button>
        </>
      )}

      {/* ---- PENDING ---- */}
      {view === 'pending' && (
        <div className="mt-5 rounded-2xl bg-amber-50 p-6 text-center ring-1 ring-amber-200">
          <div className="text-4xl">⏳</div>
          <h2 className="mt-2 font-heading text-xl font-semibold text-amber-900">Pago en verificación</h2>
          {pendingMessage && <p className="mt-2 text-sm text-amber-800">{pendingMessage}</p>}
          <p className="mt-2 text-sm text-amber-800">Te contactaremos con la confirmación. No intentes pagar de nuevo.</p>
        </div>
      )}

      {/* ---- DONE ---- */}
      {view === 'done' && reservation && (
        <div className="mt-5 rounded-2xl bg-muted p-6 text-center">
          <p className="font-heading text-xl font-semibold">¡Reserva confirmada! 🎉</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu pase digital fue enviado a <strong className="text-navy">{email}</strong>.
            Muéstralo en la entrada junto con tu identificación.
          </p>
          <div className="mx-auto mt-5 max-w-sm overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            <div className="bg-navy p-4 text-white">
              <Logo variant="chip" className="mx-auto mb-3 h-9 w-auto" />
              <p className="text-xs uppercase tracking-[0.2em] text-teal-soft">Pase del día</p>
              <p data-testid="reservation-code" className="font-heading text-3xl font-semibold tracking-wider">{reservation.code}</p>
            </div>
            <div className="p-5">
              <Image
                unoptimized
                src={`/api/qr/${reservation.id}`}
                alt="Código QR de tu pase"
                width={168}
                height={168}
                className="mx-auto rounded-lg"
              />
              <div className="mt-4 space-y-1 text-left text-sm">
                <p><strong>Nombre:</strong> {firstName} {lastName}</p>
                <p><strong>Documento:</strong> {idLabel}</p>
                <p><strong>Fecha:</strong> {capitalize(shortDateEs(date).replace(/\./g, ''))}</p>
                <p><strong>Asistentes:</strong> {partyLabel(adults, children)}</p>
                <p><strong>Pagado:</strong> ${reservation.totalUsd.toFixed(2)} USD · Bs. {reservation.totalVes.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <a href={whatsappUrl()} className="mt-5 inline-block rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground">
            ¿Dudas? Escríbenos por WhatsApp
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
