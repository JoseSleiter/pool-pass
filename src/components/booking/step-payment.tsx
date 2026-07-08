'use client';

import { useState } from 'react';
import { z } from 'zod';
import { paymentSchema, type BookingInput } from '@/lib/schemas';
import { VENEZUELAN_BANKS } from '@/lib/banks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Manually define payment fields schema (can't .pick() from refined schema)
const payFieldsSchema = z.object({
  idType: z.enum(['V', 'E', 'P', 'J']),
  idNumber: z.string().regex(/^\d{5,10}$/, 'Solo dígitos (5–10)'),
  phone: z.string().regex(/^04(12|14|16|22|24|26)\d{7}$/, 'Teléfono venezolano inválido (04XX...)'),
  bankCode: z.string().regex(/^\d{4}$/, 'Banco requerido'),
  otp: z.string().min(4, 'Clave requerida').max(12),
});
export type PayFields = z.infer<typeof payFieldsSchema>;

export function StepPayment(props: {
  booking: BookingInput;
  totalUsd: number;
  vesInfo?: { rate: number; totalVes: number } | null;
  onSubmit: (fields: PayFields) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [fields, setFields] = useState<PayFields>({
    idType: 'V', idNumber: '', phone: '', bankCode: '', otp: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // A C2P OTP is single-use: once the server rejects a charge, the typed
  // key is dead — clear it so the user must generate a fresh one.
  // (Render-time state adjustment; avoids an extra effect pass.)
  const [prevError, setPrevError] = useState(props.error);
  if (props.error !== prevError) {
    setPrevError(props.error);
    if (props.error) setFields((f) => ({ ...f, otp: '' }));
  }

  function submit() {
    const parsed = payFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    props.onSubmit(parsed.data);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total a pagar</span>
          <span data-testid="pay-total-usd" className="text-xl font-bold">
            ${props.totalUsd.toFixed(2)}
          </span>
        </div>
        {props.vesInfo && (
          <p className="mt-1 text-right text-sm text-muted-foreground">
            Bs. {props.vesInfo.totalVes.toFixed(2)} (tasa BCV {props.vesInfo.rate.toFixed(2)})
          </p>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex gap-2">
            <div className="w-24">
              <Label htmlFor="idType">Tipo</Label>
              <Select value={fields.idType}
                onValueChange={(v) => setFields({ ...fields, idType: v as PayFields['idType'] })}>
                <SelectTrigger id="idType" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['V', 'E', 'P', 'J'] as const).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="idNumber">Número de documento</Label>
              <Input id="idNumber" inputMode="numeric" className="h-11" value={fields.idNumber}
                onChange={(e) => setFields({ ...fields, idNumber: e.target.value })} />
              {errors.idNumber && <p className="text-sm text-destructive">{errors.idNumber}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Teléfono (Pago Móvil)</Label>
            <Input id="phone" inputMode="tel" placeholder="04141234567" className="h-11"
              value={fields.phone}
              onChange={(e) => setFields({ ...fields, phone: e.target.value })} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>

          <div>
            <Label htmlFor="bank">Banco</Label>
            <Select value={fields.bankCode}
              onValueChange={(v) => setFields({ ...fields, bankCode: v ?? '' })}>
              <SelectTrigger id="bank" className="h-11"><SelectValue placeholder="Selecciona tu banco" /></SelectTrigger>
              <SelectContent>
                {VENEZUELAN_BANKS.map((b) => (
                  <SelectItem key={b.code} value={b.code}>{b.code} — {b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bankCode && <p className="text-sm text-destructive">{errors.bankCode}</p>}
          </div>

          <div>
            <Label htmlFor="otp">Clave de pago (C2P)</Label>
            <Input id="otp" inputMode="numeric" type="password" className="h-11" value={fields.otp}
              onChange={(e) => setFields({ ...fields, otp: e.target.value })} />
            {errors.otp && <p className="text-sm text-destructive">{errors.otp}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              Genera la clave C2P desde la app de tu banco antes de pagar.
            </p>
          </div>
        </CardContent>
      </Card>

      {props.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {props.error}
        </p>
      )}

      <Button type="button" className="h-12 w-full text-base" disabled={props.submitting} onClick={submit}>
        {props.submitting ? 'Procesando…' : 'Pagar'}
      </Button>
    </div>
  );
}
