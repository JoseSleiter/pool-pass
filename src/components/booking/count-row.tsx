import { Minus, Plus } from 'lucide-react';

export function CountRow(props: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
      <div>
        <p className="font-bold text-navy">{props.label}</p>
        <p className="text-xs text-muted-foreground">{props.hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Disminuir ${props.label.toLowerCase()}`}
          disabled={props.value <= 0}
          onClick={() => props.onChange(Math.max(props.value - 1, 0))}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span data-testid={props.testId} className="w-6 text-center font-heading text-lg font-semibold">{props.value}</span>
        <button
          type="button"
          aria-label={`Aumentar ${props.label.toLowerCase()}`}
          disabled={props.value >= 20}
          onClick={() => props.onChange(Math.min(props.value + 1, 20))}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border text-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
