'use client';

import type { KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION, ADMIN_INPUT } from '../ui-constants';

export interface StepperBounds {
  min: number;
  max: number;
  step: number;
  decimals: number;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** The field as a number; '' or garbage → null. Accepts a decimal comma. */
export function parseStepperValue(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** current ± delta, rounded and clamped. An empty/invalid field steps from `min`. */
export function stepValue(current: string, delta: number, b: StepperBounds): string {
  const base = parseStepperValue(current) ?? b.min;
  const next = Math.min(b.max, Math.max(b.min, round(base + delta, b.decimals)));
  return String(next);
}

/** WAI-ARIA spinbutton keys → new value, or null for keys we don't handle. */
export function stepperKeyValue(key: string, current: string, b: StepperBounds): string | null {
  switch (key) {
    case 'ArrowUp': return stepValue(current, b.step, b);
    case 'ArrowDown': return stepValue(current, -b.step, b);
    case 'PageUp': return stepValue(current, b.step * 10, b);
    case 'PageDown': return stepValue(current, -b.step * 10, b);
    case 'Home': return String(b.min);
    case 'End': return String(b.max);
    default: return null;
  }
}

export function NumberStepper(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  bounds: StepperBounds;
  hint?: string;
  unit?: string;
}) {
  const b = props.bounds;
  const n = parseStepperValue(props.value);
  const hintId = props.hint ? `${props.id}-hint` : undefined;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const next = stepperKeyValue(e.key, props.value, b);
    if (next === null) return;
    e.preventDefault();
    props.onChange(next);
  }

  return (
    <div>
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Button
          type="button" variant="outline" size="icon" className={ADMIN_ICON_ACTION}
          aria-label={`Disminuir ${props.label}`}
          disabled={n !== null && n <= b.min}
          onClick={() => props.onChange(stepValue(props.value, -b.step, b))}
        >
          <Minus />
        </Button>
        <Input
          id={props.id}
          role="spinbutton"
          inputMode={b.decimals > 0 ? 'decimal' : 'numeric'}
          className={cn(ADMIN_INPUT, 'w-28 text-center tabular-nums')}
          value={props.value}
          aria-valuemin={b.min}
          aria-valuemax={b.max}
          aria-valuenow={n ?? undefined}
          aria-describedby={hintId}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          type="button" variant="outline" size="icon" className={ADMIN_ICON_ACTION}
          aria-label={`Aumentar ${props.label}`}
          disabled={n !== null && n >= b.max}
          onClick={() => props.onChange(stepValue(props.value, b.step, b))}
        >
          <Plus />
        </Button>
        {props.unit && <span className="text-sm text-muted-foreground">{props.unit}</span>}
      </div>
      {props.hint && <p id={hintId} className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
