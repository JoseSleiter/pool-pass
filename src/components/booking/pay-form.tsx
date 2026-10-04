'use client';

import { Lock } from 'lucide-react';
import { Field } from '@/components/booking/field';
import { SecretField } from '@/components/booking/secret-field';
import { BankSelect } from '@/components/booking/bank-select';
import { TrustBadges } from '@/components/booking/trust-badges';
import { useT } from '@/lib/i18n/provider';
import { interpolate } from '@/lib/i18n/format';
import type { ValidationKey } from '@/lib/i18n/validation';
import { formatVePhone, normalizeVePhone, VE_MOBILE_PREFIXES } from '@/lib/phone';

export type IdType = 'V' | 'E' | 'P' | 'J';
const ID_TYPES: readonly IdType[] = ['V', 'E', 'P', 'J'];

export interface PayFormValues {
  firstName: string;
  lastName: string;
  email: string;
  idType: IdType;
  idNumber: string;
  /** Digits only ("04141234567"): the shape paymentSchema validates. Displayed formatted. */
  phone: string;
  bankCode: string;
  otp: string;
  /** Honeypot: real users leave it empty; the server drops the request otherwise. */
  website: string;
}

export const EMPTY_PAY_FORM: PayFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  idType: 'V',
  idNumber: '',
  phone: '',
  bankCode: '',
  otp: '',
  website: '',
};

/** Dictionary keys (not strings), so a language switch re-translates errors already on screen. */
export type PayFormErrors = Partial<Record<string, ValidationKey>>;

/** State 2 of the checkout. Presentational: BookingCard owns the values and the submit. */
export function PayForm(props: {
  values: PayFormValues;
  onChange: <K extends keyof PayFormValues>(key: K, value: PayFormValues[K]) => void;
  errors: PayFormErrors;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const t = useT();
  const { values, onChange } = props;

  function fieldError(field: keyof PayFormValues): string | undefined {
    const key = props.errors[field];
    return key ? t.validation[key] : undefined;
  }

  return (
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
              value={values.website}
              onChange={(e) => onChange('website', e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.pay.firstName} value={values.firstName} onChange={(v) => onChange('firstName', v)} error={fieldError('firstName')} autoComplete="given-name" />
            <Field label={t.pay.lastName} value={values.lastName} onChange={(v) => onChange('lastName', v)} error={fieldError('lastName')} autoComplete="family-name" />
          </div>
          <Field label={t.pay.email} value={values.email} onChange={(v) => onChange('email', v)} error={fieldError('email')} type="email" autoComplete="email" />

          <div className="rounded-xl border border-border bg-card px-4 py-2.5">
            <span className="block text-xs font-medium text-muted-foreground">{t.pay.idLabel}</span>
            <div className="flex items-center gap-2">
              <select
                aria-label={t.pay.idType}
                value={values.idType}
                onChange={(e) => onChange('idType', e.target.value as IdType)}
                className="-ml-1 bg-transparent py-1 font-semibold text-navy outline-none"
              >
                {ID_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <span className="text-muted-foreground">·</span>
              <input
                aria-label={t.pay.idNumber}
                inputMode="numeric"
                value={values.idNumber}
                onChange={(e) => onChange('idNumber', e.target.value)}
                placeholder="12345678"
                className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </div>
            {fieldError('idNumber') && <p className="text-xs text-destructive">{fieldError('idNumber')}</p>}
          </div>

          <Field
            label={t.pay.phone}
            value={formatVePhone(values.phone)}
            onChange={(v) => onChange('phone', normalizeVePhone(v))}
            error={fieldError('phone')}
            type="tel"
            placeholder="0414-123-4567"
            inputMode="tel"
            autoComplete="tel"
            hint={interpolate(t.pay.phoneHint, { prefixes: VE_MOBILE_PREFIXES.join(', ') })}
          />

          <BankSelect value={values.bankCode} onChange={(code) => onChange('bankCode', code)} error={fieldError('bankCode')} />

          <SecretField
            label={t.pay.otp}
            toggleLabel={t.pay.showKey}
            value={values.otp}
            onChange={(v) => onChange('otp', v)}
            error={fieldError('otp')}
            hint={t.pay.otpHint}
          />
        </div>
      </div>

      <TrustBadges />

      <button
        type="button"
        onClick={props.onSubmit}
        disabled={props.submitting}
        className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        {props.submitting ? t.pay.submitting : t.pay.submit}
        {!props.submitting && <Lock className="h-4 w-4" aria-hidden="true" />}
      </button>
    </>
  );
}
