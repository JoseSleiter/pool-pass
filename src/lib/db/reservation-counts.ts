import { filteredReservations, type ReservationQuery, type ReservationRow } from './reservations';

type Status = ReservationRow['status'];

/** Counts behind the admin status chips; keys match the chips ("Canceladas" = failed + expired). */
export interface StatusCounts {
  all: number;
  confirmed: number;
  checked_in: number;
  pending: number;
  canceled: number;
}

const BUCKETS: readonly { key: keyof StatusCounts; statuses: Status[] | undefined }[] = [
  { key: 'all', statuses: undefined },
  { key: 'confirmed', statuses: ['confirmed'] },
  { key: 'checked_in', statuses: ['checked_in'] },
  { key: 'pending', statuses: ['pending_payment'] },
  { key: 'canceled', statuses: ['failed', 'expired'] },
];

/**
 * Exact per-status counts for the same search as `searchReservations`, ignoring
 * only its status filter (so each chip shows how many rows it would list).
 * One head-only count query per bucket, run in parallel. Caller must validate
 * `q` (parseReservationQuery) and gate on requireAdmin().
 */
export async function countReservationsByStatus(q: ReservationQuery): Promise<StatusCounts> {
  const counts = await Promise.all(
    BUCKETS.map(async (b) => {
      const { count, error } = await filteredReservations({ ...q, statuses: b.statuses }, true);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
  );
  return Object.fromEntries(BUCKETS.map((b, i) => [b.key, counts[i]])) as unknown as StatusCounts;
}
