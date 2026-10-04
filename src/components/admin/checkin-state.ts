import type { ReservationRow } from '@/lib/db/reservations';

export type InvalidReason = 'not-found' | 'pending' | 'failed' | 'expired';

export type CheckinState =
  | { kind: 'valid' }
  | { kind: 'wrong-date'; date: string }
  | { kind: 'already-in'; checkedInAt: string | null }
  | { kind: 'invalid'; reason: InvalidReason };

/**
 * Gate verdict for a scanned reservation. Order matters: a ticket that was
 * already used is reported as such even if its date is also wrong, and any
 * non-confirmed status is invalid regardless of date.
 */
export function classifyCheckin(r: ReservationRow | null, today: string): CheckinState {
  if (!r) return { kind: 'invalid', reason: 'not-found' };
  if (r.status === 'checked_in') return { kind: 'already-in', checkedInAt: r.checked_in_at };
  if (r.status === 'pending_payment') return { kind: 'invalid', reason: 'pending' };
  if (r.status === 'failed') return { kind: 'invalid', reason: 'failed' };
  if (r.status === 'expired') return { kind: 'invalid', reason: 'expired' };
  if (r.date !== today) return { kind: 'wrong-date', date: r.date };
  return { kind: 'valid' };
}

/** Reason line under "Reserva no encontrada o no válida". */
export const INVALID_REASON_TEXT: Record<InvalidReason, string> = {
  'not-found': 'Este código QR no corresponde a ninguna reserva.',
  pending: 'Pago pendiente de verificación: la reserva aún no está confirmada.',
  failed: 'El pago fue rechazado: la reserva no está confirmada.',
  expired: 'La reserva expiró sin completar el pago.',
};
