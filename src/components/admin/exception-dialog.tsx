'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DIALOG_FOOTER, DIALOG_ACTION, ADMIN_INPUT } from './ui-constants';
import { REASON_PRESETS, reasonKind, type ReasonKind } from './settings/reason-presets';

const CHIPS: ReasonKind[] = [...REASON_PRESETS, 'Otro'];

export function ExceptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, capacity: number, reason?: string) => Promise<{ ok: boolean; message?: string }>;
  initial?: { date: string; capacity: number; reason: string | null };
  /** Prefilled date for a new exception (e.g. the calendar day that was clicked). */
  defaultDate?: string;
}) {
  const [date, setDate] = useState(props.initial?.date ?? props.defaultDate ?? '');
  const [closed, setClosed] = useState(props.initial ? props.initial.capacity === 0 : false);
  const [capacity, setCapacity] = useState(String(props.initial && props.initial.capacity > 0 ? props.initial.capacity : 25));
  const [reason, setReason] = useState(props.initial?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(props.initial);
  const kind = reasonKind(reason);

  function pickChip(chip: ReasonKind) {
    if (chip === 'Otro') {
      setReason('');
      reasonRef.current?.focus();
    } else {
      setReason(chip);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>{editing ? 'Editar excepción' : 'Nueva excepción'}</DialogTitle>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="ex-date">Fecha</Label>
            <Input id="ex-date" type="date" className={ADMIN_INPUT} value={date}
              disabled={editing} onChange={(e) => setDate(e.target.value)} />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Tipo de día</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={!closed} onChange={() => setClosed(false)} />
              Capacidad especial
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={closed} onChange={() => setClosed(true)} />
              Día cerrado
            </label>
          </fieldset>
          {!closed && (
            <div>
              <Label htmlFor="ex-cap">Capacidad máxima</Label>
              <Input id="ex-cap" type="number" min={1} className={ADMIN_INPUT} value={capacity}
                onChange={(e) => setCapacity(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ex-reason">Motivo (opcional)</Label>
            <div role="group" aria-label="Atajos rápidos" className="mt-1 flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={kind === chip}
                  onClick={() => pickChip(chip)}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none',
                    kind === chip ? 'border-navy bg-navy text-white' : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            <Input id="ex-reason" ref={reasonRef} className={cn(ADMIN_INPUT, 'mt-2')}
              placeholder="Escribe el motivo" maxLength={200}
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className={DIALOG_FOOTER}>
          <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cancelar</Button>} />
          <Button className={DIALOG_ACTION} disabled={busy} onClick={async () => {
            setError(null);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Selecciona una fecha válida.'); return; }
            const cap = closed ? 0 : Number(capacity);
            if (!closed && (!Number.isInteger(cap) || cap < 1)) { setError('Capacidad inválida.'); return; }
            setBusy(true);
            const res = await props.onSave(date, cap, reason.trim() || undefined);
            setBusy(false);
            if (res.ok) props.onOpenChange(false);
            else setError(res.message ?? 'No se pudo guardar.');
          }}>
            {busy ? 'Guardando…' : 'Guardar excepción'}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
