import { caracasHour } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

type CheckinRow = Pick<ReservationRow, 'status' | 'checked_in_at' | 'adults' | 'children'>;

/**
 * People checked in per hour of the day (Caracas, 0–23), ascending.
 * Sparse: hours with no check-ins are omitted.
 */
export function bucketCheckinsByHour(rows: CheckinRow[]): { hour: number; people: number }[] {
  const buckets = new Map<number, number>();
  for (const r of rows) {
    if (r.status !== 'checked_in' || !r.checked_in_at) continue;
    const hour = caracasHour(r.checked_in_at);
    buckets.set(hour, (buckets.get(hour) ?? 0) + r.adults + r.children);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, people]) => ({ hour, people }));
}
