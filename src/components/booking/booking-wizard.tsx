'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { StepDetails } from './step-details';
import { getAvailability } from '@/app/actions/booking';
import type { BookingInput } from '@/lib/schemas';

export function BookingWizard(props: {
  prices: { adult: number; child: number };
  initialAvailability: Record<string, number>;
}) {
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [booking, setBooking] = useState<BookingInput>({
    date: format(new Date(), 'yyyy-MM-dd'),
    adults: 1, children: 0, firstName: '', lastName: '', email: '',
  });

  if (step === 'details') {
    return (
      <StepDetails
        prices={props.prices}
        availability={availability}
        initial={booking}
        onMonthChange={async (m) => setAvailability(await getAvailability(m))}
        onNext={(data) => { setBooking(data); setStep('payment'); }}
      />
    );
  }
  return <p className="text-center text-muted-foreground">Pago — próximo paso</p>;
}
