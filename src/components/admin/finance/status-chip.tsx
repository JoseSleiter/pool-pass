// src/components/admin/finance/status-chip.tsx
import { cn } from '@/lib/utils';
import { STATUS_CHIP_CLASS, statusLabelEs } from '@/lib/reservation-status';
import type { ReservationRow } from '@/lib/db/reservations';

/** Status pill using the central colours/labels (src/lib/reservation-status.ts, owned by PR 10). */
export function StatusChip({ row }: { row: Pick<ReservationRow, 'status' | 'checked_in_at'> }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold',
        STATUS_CHIP_CLASS[row.status],
      )}
    >
      {statusLabelEs(row)}
    </span>
  );
}
