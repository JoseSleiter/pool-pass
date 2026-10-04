'use client';

import { useId } from 'react';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { interpolate } from '@/lib/i18n/format';
import { roundMoney, totalUsd, usdToVes } from '@/lib/money';

const usd = (n: number) => `$${n.toFixed(2)}`;

/**
 * State 1 of the checkout: what the guest is buying and what it costs in
 * bolívares at today's BCV rate. `rate` is null while it loads (or if the
 * lookup failed): then we say how the amount is computed, never a made-up one.
 */
export function SummaryStep(props: {
  prices: { adult: number; child: number };
  party: { adults: number; children: number };
  rate: number | null;
  onContinue: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const { adults, children } = props.party;
  const total = totalUsd(adults, children, props.prices);
  const lines = [
    { key: 'adults', label: t.booking.adults, count: adults, price: props.prices.adult },
    { key: 'children', label: t.booking.children, count: children, price: props.prices.child },
  ].filter((line) => line.count > 0);

  return (
    <>
      <section aria-labelledby={titleId} className="mt-5 rounded-2xl bg-muted p-5">
        <h2 id={titleId} className="font-heading text-lg font-semibold">{t.booking.breakdownTitle}</h2>
        <dl data-testid="price-breakdown" className="mt-3 divide-y divide-border text-sm">
          {lines.map((line) => (
            <div key={line.key} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-muted-foreground">
                {interpolate(t.booking.lineItem, { label: line.label, count: line.count, price: usd(line.price) })}
              </dt>
              <dd className="font-semibold tabular-nums">{usd(roundMoney(line.count * line.price))}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 py-2">
            <dt className="font-semibold">{t.booking.totalUsd}</dt>
            <dd data-testid="breakdown-total-usd" className="font-heading text-lg font-semibold tabular-nums">
              {usd(total)} USD
            </dd>
          </div>
          {props.rate !== null && (
            <>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{t.booking.bcvRate}</dt>
                <dd data-testid="breakdown-rate" className="font-semibold tabular-nums">
                  Bs. {props.rate.toFixed(2)} / $
                </dd>
              </div>
              <div className="-mx-3 flex items-baseline justify-between gap-4 rounded-xl bg-secondary px-3 py-3">
                <dt className="font-semibold text-secondary-foreground">{t.booking.totalVes}</dt>
                <dd data-testid="breakdown-total-ves" className="font-heading text-xl font-bold whitespace-nowrap text-secondary-foreground tabular-nums">
                  Bs. {usdToVes(total, props.rate).toFixed(2)}
                </dd>
              </div>
            </>
          )}
        </dl>
        {props.rate === null && (
          <p className="mt-2 text-xs text-muted-foreground">{t.booking.rateAtPayment}</p>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={props.onContinue}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          {t.booking.continue}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
