'use client';

import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { partyLabel } from '@/lib/party';
import { longDateEs } from '@/lib/dates';
import { statusLabelEs } from '@/lib/reservation-status';
import { DIALOG_FOOTER, DIALOG_ACTION } from './ui-constants';
import type { ReservationRow } from '@/lib/db/reservations';

export function ReservationDetailDialog(props: {
  reservation: ReservationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartCheckin: () => void;
}) {
  const r = props.reservation;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogTitle>Detalle de la reserva</DialogTitle>
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-mono text-lg font-bold">{r.code}</p>
          <p className="font-medium">{r.first_name} {r.last_name}</p>
          <p className="text-muted-foreground">{r.id_type}-{r.id_number}</p>
          <p>{partyLabel(r.adults, r.children)}</p>
          <p className="text-muted-foreground">
            Pago: ${Number(r.total_usd).toFixed(2)} · Bs. {Number(r.total_ves ?? 0).toFixed(2)}
          </p>
          <p className="capitalize text-muted-foreground">Fecha: {longDateEs(r.date)}</p>
          <p className="font-semibold">Estado: {statusLabelEs(r)}</p>
        </div>
        <div className={DIALOG_FOOTER}>
          <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cerrar</Button>} />
          {r.status === 'confirmed' && (
            <Button className={DIALOG_ACTION} onClick={props.onStartCheckin}>Iniciar check-in</Button>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
