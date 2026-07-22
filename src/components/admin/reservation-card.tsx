'use client';

import { Button } from '@/components/ui/button';
import { partyLabel } from '@/lib/party';
import { caracasTime } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

const CHIP: Record<ReservationRow['status'], string> = {
  confirmed: 'bg-sky-100 text-sky-800',
  checked_in: 'bg-green-100 text-green-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};

function statusLabel(r: ReservationRow): string {
  switch (r.status) {
    case 'checked_in': return `Ingresó ${r.checked_in_at ? caracasTime(r.checked_in_at) : ''}`.trim();
    case 'pending_payment': return 'Pago en verificación';
    case 'confirmed': return 'Confirmada';
    case 'failed': return 'Fallida';
    case 'expired': return 'Expirada';
  }
}

export function ReservationCard(props: {
  reservation: ReservationRow;
  onCheckin: (id: string) => void;
  onResend: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  const r = props.reservation;
  return (
    <div data-testid="res-row" className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold">{r.code}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CHIP[r.status]}`}>
          {statusLabel(r)}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium">{r.first_name} {r.last_name}</p>
      <p className="text-sm text-muted-foreground">{r.id_type}-{r.id_number}</p>
      <p className="text-sm text-muted-foreground">
        {partyLabel(r.adults, r.children)} · ${Number(r.total_usd).toFixed(2)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="secondary" size="sm" onClick={() => props.onDetail(r.id)}>Ver detalle</Button>
        {['confirmed', 'checked_in'].includes(r.status) && (
          <Button variant="outline" size="sm" onClick={() => props.onResend(r.id)}>✉️ Reenviar correo</Button>
        )}
        <div className="ml-auto">
          {r.status === 'confirmed' ? (
            <Button size="sm" onClick={() => props.onCheckin(r.id)}>Check-in</Button>
          ) : r.status === 'checked_in' ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              Ingreso registrado
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
