import type { ReservationRow } from '@/lib/db/reservations';

export type ReservationStatus = ReservationRow['status'];

/** Canonical status order for filters, URLs and chips. "Canceladas" = failed + expired, last. */
export const STATUS_ORDER = [
  'pending_payment', 'confirmed', 'checked_in', 'failed', 'expired',
] as const satisfies readonly ReservationStatus[];

/** Short singular name for filter chips: "Estado: Confirmada". */
export const STATUS_NAME_ES: Record<ReservationStatus, string> = {
  pending_payment: 'Pendiente',
  confirmed: 'Confirmada',
  checked_in: 'Ingresó',
  failed: 'Fallida',
  expired: 'Expirada',
};

// ICU separates "a. m." with no-break spaces; normalize so labels are predictable.
const ANY_SPACE = /\s/g;

/** "10:15 a. m." — 12-hour time in Venezuela for an ISO timestamp. */
export function caracasTime12(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)).replace(ANY_SPACE, ' ');
}

/** "10 ene. 2030, 6:00 a. m." — Caracas date + 12-hour time (created_at, checked_in_at…). */
export function caracasDateTime12(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)).replace(ANY_SPACE, ' ');
}

export function statusLabelEs(r: Pick<ReservationRow, 'status' | 'checked_in_at'>): string {
  switch (r.status) {
    case 'checked_in': return `Ingresó ${r.checked_in_at ? caracasTime12(r.checked_in_at) : ''}`.trim();
    case 'pending_payment': return 'Pago en verificación';
    case 'confirmed': return 'Confirmada';
    case 'failed': return 'Fallida';
    case 'expired': return 'Expirada';
  }
}

/**
 * Status badge colors (md2 §4), the single source for every admin surface:
 * confirmed = solid emerald, checked_in = soft blue outline, pending = amber
 * (the pill adds a motion-safe pulse), failed/expired = muted gray.
 */
export const STATUS_CHIP_CLASS: Record<ReservationStatus, string> = {
  confirmed: 'border-transparent bg-emerald-700 text-white',
  checked_in: 'border-sky-300 bg-sky-50 text-sky-800',
  pending_payment: 'border-amber-300 bg-amber-50 text-amber-900',
  failed: 'border-slate-200 bg-slate-100 text-slate-600',
  expired: 'border-slate-200 bg-slate-100 text-slate-600',
};
