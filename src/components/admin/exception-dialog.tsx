'use client';

import { useState } from 'react';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ExceptionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, capacity: number, reason?: string) => Promise<{ ok: boolean; message?: string }>;
  initial?: { date: string; capacity: number; reason: string | null };
}) {
  const [date, setDate] = useState(props.initial?.date ?? '');
  const [closed, setClosed] = useState(props.initial ? props.initial.capacity === 0 : false);
  const [capacity, setCapacity] = useState(String(props.initial && props.initial.capacity > 0 ? props.initial.capacity : 25));
  const [reason, setReason] = useState(props.initial?.reason ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(props.initial);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>{editing ? 'Editar excepción' : 'Nueva excepción'}</DialogTitle>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="ex-date">Fecha</Label>
            <Input id="ex-date" type="date" className="h-11" value={date}
              disabled={editing} onChange={(e) => setDate(e.target.value)} />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Tipo de día</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={!closed} onChange={() => setClosed(false)} />
              Capacidad especial
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ex-type" checked={closed} onChange={() => setClosed(true)} />
              Día cerrado
            </label>
          </fieldset>
          {!closed && (
            <div>
              <Label htmlFor="ex-cap">Capacidad máxima</Label>
              <Input id="ex-cap" type="number" className="h-11" value={capacity}
                onChange={(e) => setCapacity(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ex-reason">Motivo (opcional)</Label>
            <Input id="ex-reason" className="h-11" placeholder="Mantenimiento de piscina"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button disabled={busy} onClick={async () => {
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
