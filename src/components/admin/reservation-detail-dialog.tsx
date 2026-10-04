'use client';

import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReservationRow } from '@/lib/db/reservations';
import { longDateEs } from '@/lib/dates';
import { partyLabel } from '@/lib/party';
import { caracasDateTime12 } from '@/lib/reservation-status';
import { cn } from '@/lib/utils';
import { SlideOver } from './slide-over';
import { StatusPill } from './status-pill';
import { DIALOG_ACTION } from './ui-constants';

const DASH = '—';

function Field(props: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className={cn('min-w-0 break-words font-medium text-slate-900', props.mono && 'font-mono')}>
        {props.children}
      </dd>
    </div>
  );
}

/** Full reservation data in a right-hand slide-over (md2 §4 "Full Detail Drawer"). */
export function ReservationDetailDialog(props: {
  reservation: ReservationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartCheckin: () => void;
  onResend?: (id: string) => void;
}) {
  const r = props.reservation;
  const canResend = Boolean(props.onResend) && (r.status === 'confirmed' || r.status === 'checked_in');
  const canCheckin = r.status === 'confirmed';

  const footer = canResend || canCheckin ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {canResend && (
        <Button variant="outline" className={cn(DIALOG_ACTION, 'gap-2')} onClick={() => props.onResend?.(r.id)}>
          <Mail aria-hidden className="size-4" />
          Reenviar voucher
        </Button>
      )}
      {canCheckin && (
        <Button className={DIALOG_ACTION} onClick={props.onStartCheckin}>Iniciar check-in</Button>
      )}
    </div>
  ) : undefined;

  return (
    <SlideOver open={props.open} onOpenChange={props.onOpenChange} title="Detalle de la reserva" footer={footer}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xl font-bold">{r.code}</p>
        <StatusPill reservation={r} />
      </div>
      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        <Field label="Visita">
          <span className="block first-letter:uppercase">{longDateEs(r.date)}</span>
        </Field>
        <Field label="Cliente">{r.first_name} {r.last_name}</Field>
        <Field label="Documento">{r.id_type}-{r.id_number}</Field>
        <Field label="Correo">{r.email}</Field>
        <Field label="Personas">{partyLabel(r.adults, r.children)}</Field>
        <Field label="Total USD">${Number(r.total_usd).toFixed(2)}</Field>
        <Field label="Tasa BCV">{r.bcv_rate == null ? DASH : `Bs. ${Number(r.bcv_rate).toFixed(2)} / USD`}</Field>
        <Field label="Total Bs.">{r.total_ves == null ? DASH : `Bs. ${Number(r.total_ves).toFixed(2)}`}</Field>
        <Field label="Referencia C2P" mono>{r.payment_ref ?? DASH}</Field>
        <Field label="Creada">{caracasDateTime12(r.created_at)}</Field>
        <Field label="Ingreso">{r.checked_in_at ? caracasDateTime12(r.checked_in_at) : DASH}</Field>
        {r.status === 'pending_payment' && r.expires_at && (
          <Field label="Expira">{caracasDateTime12(r.expires_at)}</Field>
        )}
      </dl>
    </SlideOver>
  );
}
