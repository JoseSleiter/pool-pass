'use client';

import { useId } from 'react';

/** Labelled text input of the payment form. The hint/error below it is its accessible description. */
export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
  autoComplete?: string;
}) {
  const noteId = useId();
  const hasNote = Boolean(props.error || props.hint);
  return (
    <div>
      <label className="block rounded-xl border border-border bg-card px-4 py-2.5">
        <span className="block text-xs font-medium text-muted-foreground">{props.label}</span>
        <input
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={hasNote ? noteId : undefined}
          className="w-full bg-transparent py-1 font-semibold text-navy outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
      </label>
      {props.error && <p id={noteId} className="mt-1 text-xs text-destructive">{props.error}</p>}
      {props.hint && !props.error && <p id={noteId} className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}
