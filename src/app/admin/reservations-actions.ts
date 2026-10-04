'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { countReservationsByStatus, type StatusCounts } from '@/lib/db/reservation-counts';
import { parseReservationQuery } from '@/lib/reservation-search';

/**
 * Counts for the status chips of /admin/reservations: same search as
 * adminSearchReservations, minus its status filter. Read-only (no audit entry).
 */
export async function adminCountReservationStatuses(raw: unknown): Promise<StatusCounts> {
  await requireAdmin();
  const query = parseReservationQuery(raw);
  if (!query) throw new Error('Invalid query');
  return countReservationsByStatus(query);
}
