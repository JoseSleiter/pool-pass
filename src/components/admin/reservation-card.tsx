'use client';

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReservationRow } from '@/lib/db/reservations';
import { shortDateEs } from '@/lib/dates';
import { partyLabel } from '@/lib/party';
import { cn } from '@/lib/utils';
import { StatusPill } from './status-pill';
import { ADMIN_ACTION } from './ui-constants';

/** Stacked reservation card: the mobile layout of every admin reservation list. */
export function ReservationCard(props: {
  reservation: ReservationRow;
  onCheckin: (id: string) => void;
  onResend: (id: string) => void;
  onDetail: (id: string) => void;
}) {
  const r = props.reservation;
  const resendable = r.status === 'confirmed' || r.status === 'checked_in';
  return (
    <div data-testid="res-row" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold">{r.code}</span>
        <StatusPill reservation={r} />
      </div>
      <p className="mt-1 text-sm font-medium">{r.first_name} {r.last_name}</p>
      <p className="text-sm text-muted-foreground">{r.id_type}-{r.id_number}</p>
      <p className="text-sm text-muted-foreground first-letter:uppercase">
        {shortDateEs(r.date)} · {partyLabel(r.adults, r.children)} · ${Number(r.total_usd).toFixed(2)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Button variant="secondary" className={ADMIN_ACTION} onClick={() => props.onDetail(r.id)}>Ver detalle</Button>
        {resendable && (
          <Button variant="outline" className={cn(ADMIN_ACTION, 'gap-2')} onClick={() => props.onResend(r.id)}>
            <Mail aria-hidden className="size-4" />
            Reenviar voucher
          </Button>
        )}
        <div className="ml-auto">
          {r.status === 'confirmed' ? (
            <Button className={ADMIN_ACTION} onClick={() => props.onCheckin(r.id)}>Check-in</Button>
          ) : r.status === 'pending_payment' ? (
            <Button
              variant="outline"
              className={cn(ADMIN_ACTION, 'border-amber-300 text-amber-900 hover:bg-amber-50')}
              onClick={() => props.onDetail(r.id)}
            >
              Verificar
            </Button>
          ) : r.status === 'checked_in' ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
              Ingreso registrado
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
