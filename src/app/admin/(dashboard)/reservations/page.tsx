import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminSearchReservations } from '@/app/admin/actions';
import { adminCountReservationStatuses } from '@/app/admin/reservations-actions';
import { todayCaracas } from '@/lib/dates';
import { ReservationsView } from './_components/reservations-view';
import {
  lastPage, parseReservationsParams, reservationsHref, type RawSearchParams,
} from './_lib/search-params';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reservas' };

/** Every reservation, searchable and filterable. The URL is the state (see _lib/search-params). */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { state, query } = parseReservationsParams(await searchParams);
  const [{ rows, total }, counts] = await Promise.all([
    adminSearchReservations(query),
    adminCountReservationStatuses(query),
  ]);

  const last = lastPage(total, state.pageSize);
  if (state.page > last) redirect(reservationsHref(state, { page: last }));

  return <ReservationsView state={state} rows={rows} total={total} counts={counts} today={todayCaracas()} />;
}
