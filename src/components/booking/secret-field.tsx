'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Masked input with a show/hide toggle (WAI-ARIA toggle button: constant
 * label, state in aria-pressed). The <label> wraps only the text so the
 * field's label never names the button; keep `toggleLabel` free of the
 * field label's words for the same reason.
 */
export function SecretField(props: {
  label: string;
  toggleLabel: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const [visible, setVisible] = useState(false);
  const hasNote = Boolean(props.error || props.hint);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card py-2.5 pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
            {props.label}
          </label>
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            aria-invalid={props.error ? true : undefined}
            aria-describedby={hasNote ? noteId : undefined}
            className="w-full bg-transparent py-1 font-semibold tracking-widest text-navy outline-none"
          />
        </div>
        <button
          type="button"
          aria-label={props.toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {props.error && <p id={noteId} className="mt-1 text-xs text-destructive">{props.error}</p>}
      {props.hint && !props.error && <p id={noteId} className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
