'use client';

import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';
import { interpolate } from '@/lib/i18n/format';

/** Per-group upper bound from bookingSchema (0–20 adults, 0–20 children). */
const GROUP_MAX = 20;

const STEP_BUTTON =
  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border text-navy transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export function CountRow(props: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
  /** Optional leading icon (e.g. User / Baby) to tell the groups apart at a glance. */
  icon?: ReactNode;
  /** Override the default per-group bounds, e.g. to enforce a whole-party limit. */
  canDecrease?: boolean;
  canIncrease?: boolean;
}) {
  const t = useT();
  const label = props.label.toLowerCase();
  const canDecrease = props.canDecrease ?? props.value > 0;
  const canIncrease = props.canIncrease ?? props.value < GROUP_MAX;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        {props.icon && (
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            {props.icon}
          </span>
        )}
        <div>
          <p className="font-bold text-navy">{props.label}</p>
          <p className="text-xs text-muted-foreground">{props.hint}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={interpolate(t.booking.decrease, { label })}
          disabled={!canDecrease}
          onClick={() => props.onChange(Math.max(props.value - 1, 0))}
          className={STEP_BUTTON}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          data-testid={props.testId}
          aria-live="polite"
          className="w-7 text-center font-heading text-lg font-semibold"
        >
          {props.value}
        </span>
        <button
          type="button"
          aria-label={interpolate(t.booking.increase, { label })}
          disabled={!canIncrease}
          onClick={() => props.onChange(Math.min(props.value + 1, GROUP_MAX))}
          className={STEP_BUTTON}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
