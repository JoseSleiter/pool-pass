import { caracasTime } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

export function statusLabelEs(r: Pick<ReservationRow, 'status' | 'checked_in_at'>): string {
  switch (r.status) {
    case 'checked_in': return `Ingresó ${r.checked_in_at ? caracasTime(r.checked_in_at) : ''}`.trim();
    case 'pending_payment': return 'Pago en verificación';
    case 'confirmed': return 'Confirmada';
    case 'failed': return 'Fallida';
    case 'expired': return 'Expirada';
  }
}

export const STATUS_CHIP_CLASS: Record<ReservationRow['status'], string> = {
  confirmed: 'bg-sky-100 text-sky-800',
  checked_in: 'bg-green-100 text-green-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};
