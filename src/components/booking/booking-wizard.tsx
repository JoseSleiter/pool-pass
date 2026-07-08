'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { StepDetails } from './step-details';
import { StepPayment, type PayFields } from './step-payment';
import { Confirmation } from './confirmation';
import { getAvailability, getCurrentRate, submitBookingAndPay } from '@/app/actions/booking';
import { totalUsd, usdToVes } from '@/lib/money';
import type { BookingInput } from '@/lib/schemas';
import type { BookingResult } from '@/lib/booking/process';

type Confirmed = Extract<BookingResult, { ok: true }>['reservation'];

export function BookingWizard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
}) {
  const [step, setStep] = useState<'details' | 'payment' | 'pending' | 'done'>('details');
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [booking, setBooking] = useState<BookingInput>({
    date: format(new Date(), 'yyyy-MM-dd'),
    adults: 1, children: 0, firstName: '', lastName: '', email: '',
  });
  const [rate, setRate] = useState<number | null>(null);
  const [idLabel, setIdLabel] = useState('');
  const [reservation, setReservation] = useState<Confirmed | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState('');

  async function handlePay(fields: PayFields) {
    setSubmitting(true);
    setError(null);
    const result = await submitBookingAndPay({ ...booking, ...fields });
    setSubmitting(false);
    if (result.ok) {
      setIdLabel(`${fields.idType}-${fields.idNumber}`);
      setReservation(result.reservation);
      setStep('done');
      return;
    }
    switch (result.error) {
      case 'capacity':
        setError(`Ya no hay cupo suficiente para esa fecha. Quedan ${result.remaining} puestos.`);
        setStep('details');
        getAvailability(booking.date.slice(0, 7)).then(setAvailability);
        break;
      case 'payment_declined':
        setError(`Pago rechazado: ${result.message}. Genera una nueva clave C2P e intenta de nuevo.`);
        break;
      case 'payment_pending':
        // Ambiguous charge result: the bank may have debited. Lock the form —
        // never allow a second C2P attempt from here.
        setPendingMessage(result.message);
        setStep('pending');
        break;
      default:
        setError(result.message);
    }
  }

  if (step === 'done' && reservation) {
    return <Confirmation booking={booking} reservation={reservation} idLabel={idLabel} />;
  }
  if (step === 'pending') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <div className="text-5xl">⏳</div>
        <h2 className="mt-2 text-xl font-extrabold text-amber-900">Pago en verificación</h2>
        {pendingMessage && <p className="mt-2 text-amber-800">{pendingMessage}</p>}
        <p className="mt-2 text-amber-800">
          Te contactaremos con la confirmación. No intentes pagar de nuevo.
        </p>
      </div>
    );
  }
  if (step === 'payment') {
    const usd = totalUsd(booking.adults, booking.children, props.prices);
    return (
      <>
        <Progress step={2} />
        <StepPayment
          booking={booking}
          totalUsd={usd}
          // Estimate for display only; the authoritative rate is re-fetched server-side at charge time.
          vesInfo={rate !== null ? { rate, totalVes: usdToVes(usd, rate) } : null}
          onSubmit={handlePay}
          submitting={submitting}
          error={error}
        />
      </>
    );
  }
  return (
    <>
      <Progress step={1} />
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <StepDetails
        prices={props.prices}
        availability={availability}
        initial={booking}
        onMonthChange={async (m) => setAvailability(await getAvailability(m))}
        onNext={(data) => {
          setBooking(data);
          setError(null);
          setStep('payment');
          // Fire-and-forget: don't block the step transition on the rate lookup.
          getCurrentRate().then(setRate).catch(() => setRate(null));
        }}
      />
    </>
  );
}

function Progress(props: { step: 1 | 2 }) {
  const label = props.step === 1 ? 'Paso 1 de 2 · Fecha y asistentes' : 'Paso 2 de 2 · Pago Móvil C2P';
  return (
    <div className="mb-4">
      <div className="flex gap-1.5" aria-hidden>
        <div className="h-1 flex-1 rounded-full bg-sky-500" />
        <div className={`h-1 flex-1 rounded-full ${props.step === 2 ? 'bg-sky-500' : 'bg-slate-200'}`} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
