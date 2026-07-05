'use client';

import { Button } from '@/components/ui/button';

export function Stepper(props: {
  label: string;
  priceUsd: number;
  value: number;
  min: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium">{props.label}</p>
        <p className="text-sm text-muted-foreground">${props.priceUsd.toFixed(2)} c/u</p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          aria-label={`Disminuir ${props.label.toLowerCase()}`}
          disabled={props.value <= props.min}
          onClick={() => props.onChange(Math.max(props.value - 1, props.min))}
        >
          −
        </Button>
        <span data-testid={props.testId} className="w-6 text-center text-lg font-semibold">
          {props.value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11"
          aria-label={`Aumentar ${props.label.toLowerCase()}`}
          disabled={props.value >= 20}
          onClick={() => props.onChange(Math.min(props.value + 1, 20))}
        >
          +
        </Button>
      </div>
    </div>
  );
}
