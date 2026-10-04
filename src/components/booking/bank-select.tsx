'use client';

import { VENEZUELAN_BANKS } from '@/lib/banks';
import { useT } from '@/lib/i18n/provider';

/**
 * Native <select> (accessible, mobile-friendly, and what the e2e suite drives
 * by value) plus a chip with the chosen bank's 4-digit code. No bank logos:
 * we do not ship third-party trademarks (roadmap §2).
 */
export function BankSelect(props: { value: string; onChange: (code: string) => void; error?: string }) {
  const t = useT();
  const bank = VENEZUELAN_BANKS.find((b) => b.code === props.value);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2.5">
      <span className="block text-xs font-medium text-muted-foreground">{t.pay.bank}</span>
      <div className="flex min-h-11 items-center gap-3">
        <span
          aria-hidden="true"
          data-testid="bank-chip"
          className={`inline-flex h-8 min-w-14 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-sm font-bold tabular-nums ${
            bank ? 'bg-navy text-white' : 'bg-muted text-muted-foreground'
          }`}
        >
          {bank ? bank.code : '····'}
        </span>
        <select
          aria-label={t.pay.bank}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="min-h-11 w-full cursor-pointer bg-transparent py-1 font-semibold text-navy outline-none"
        >
          <option value="">{t.pay.bankPlaceholder}</option>
          {VENEZUELAN_BANKS.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
      </div>
      {props.error && <p className="text-xs text-destructive">{props.error}</p>}
    </div>
  );
}
