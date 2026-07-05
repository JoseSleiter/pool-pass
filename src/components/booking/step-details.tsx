'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Stepper } from './stepper';
import { bookingSchema, type BookingInput } from '@/lib/schemas';
import { totalUsd } from '@/lib/money';

export function StepDetails(props: {
  prices: { adult: number; child: number };
  availability: Record<string, number>; // date → remaining; 0 = full/closed. Absent key = default capacity available.
  initial: BookingInput;
  onNext: (data: BookingInput) => void;
  onMonthChange?: (month: string) => void;
}) {
  const [data, setData] = useState<BookingInput>(props.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const usd = totalUsd(data.adults, data.children, props.prices);
  const selected = data.date ? new Date(`${data.date}T12:00:00`) : undefined;

  function submit() {
    const parsed = bookingSchema.safeParse(data);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    if (props.availability[parsed.data.date] !== undefined && props.availability[parsed.data.date] <= 0) {
      setErrors({ date: 'Fecha no disponible. Elige otra fecha.' });
      return;
    }
    props.onNext(parsed.data);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center pt-4">
          <Calendar
            className="[--cell-size:2.75rem]"
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                setData({ ...data, date: format(d, 'yyyy-MM-dd') });
                setErrors((e) => {
                  const rest = { ...e };
                  delete rest.date;
                  return rest;
                });
              }
            }}
            onMonthChange={(m) => props.onMonthChange?.(format(m, 'yyyy-MM'))}
            disabled={(d) => {
              const key = format(d, 'yyyy-MM-dd');
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (d < today) return true;
              return props.availability[key] !== undefined && props.availability[key] <= 0;
            }}
          />
          {errors.date && <p className="mt-2 text-sm text-destructive">{errors.date}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y pt-2">
          <Stepper
            label="Adultos" priceUsd={props.prices.adult} value={data.adults} min={1}
            onChange={(v) => setData({ ...data, adults: v })} testId="adults-count"
          />
          <Stepper
            label="Niños" priceUsd={props.prices.child} value={data.children} min={0}
            onChange={(v) => setData({ ...data, children: v })} testId="children-count"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div>
            <Label htmlFor="firstName">Nombre</Label>
            <Input id="firstName" className="h-11" value={data.firstName}
              onChange={(e) => setData({ ...data, firstName: e.target.value })} />
            {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
          </div>
          <div>
            <Label htmlFor="lastName">Apellido</Label>
            <Input id="lastName" className="h-11" value={data.lastName}
              onChange={(e) => setData({ ...data, lastName: e.target.value })} />
            {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
          </div>
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" className="h-11" value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })} />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-lg bg-muted p-4">
        <span className="text-sm text-muted-foreground">Total</span>
        <span data-testid="total-usd" className="text-2xl font-bold">${usd.toFixed(2)}</span>
      </div>

      <Button type="button" className="h-12 w-full text-base" onClick={submit}>
        Continuar
      </Button>
    </div>
  );
}
