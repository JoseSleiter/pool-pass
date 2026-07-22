'use client';

import { useState } from 'react';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { partyLabel } from '@/lib/party';
import { longDateEs } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

export function CheckinDialog(props: {
  reservation: ReservationRow;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const r = props.reservation;
  const wrongDate = r.date !== props.today;
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>Aprobar check-in</DialogTitle>
        {wrongDate && (
          <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm font-semibold text-amber-900">
            ⚠️ Fecha distinta: la reserva es para {longDateEs(r.date)}
          </p>
        )}
        <div className="mt-3 space-y-1 text-sm">
          <p className="font-mono text-lg font-bold">{r.code}</p>
          <p className="font-medium">{r.first_name} {r.last_name} · {r.id_type}-{r.id_number}</p>
          <p>{partyLabel(r.adults, r.children)}</p>
          <p className="text-muted-foreground">
            Pago: ${Number(r.total_usd).toFixed(2)} · Bs. {Number(r.total_ves ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await props.onApprove(r.id);
              setBusy(false);
              if (res.ok) props.onOpenChange(false);
            }}
          >
            {busy ? 'Aprobando…' : 'Aprobar check-in'}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
