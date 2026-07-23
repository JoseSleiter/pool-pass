import { adminListReservations, adminGetDaySummary } from '../actions';
import { AdminDayView } from '@/components/admin/day-view';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: rawDate } = await searchParams;
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayCaracas();
  const [rows, summary] = await Promise.all([
    adminListReservations(date),
    adminGetDaySummary(date),
  ]);

  return <AdminDayView date={date} rows={rows} summary={summary} />;
}
