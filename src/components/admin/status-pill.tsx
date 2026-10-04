import { Ban, CircleCheck, LogIn } from 'lucide-react';
import type { ReservationRow } from '@/lib/db/reservations';
import { STATUS_CHIP_CLASS, statusLabelEs } from '@/lib/reservation-status';
import { cn } from '@/lib/utils';

type Status = ReservationRow['status'];

function StatusIcon(props: { status: Status }) {
  switch (props.status) {
    case 'pending_payment':
      return (
        <span aria-hidden data-testid="pending-pulse" className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-amber-500 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
        </span>
      );
    case 'confirmed':
      return <CircleCheck aria-hidden className="size-3.5" />;
    case 'checked_in':
      return <LogIn aria-hidden className="size-3.5" />;
    default:
      return <Ban aria-hidden className="size-3.5" />;
  }
}

/** Reservation status badge (md2 §4). Colors come from STATUS_CHIP_CLASS. */
export function StatusPill(props: {
  reservation: Pick<ReservationRow, 'status' | 'checked_in_at'>;
  className?: string;
}) {
  const { status } = props.reservation;
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        STATUS_CHIP_CLASS[status],
        props.className,
      )}
    >
      <StatusIcon status={status} />
      {statusLabelEs(props.reservation)}
    </span>
  );
}
