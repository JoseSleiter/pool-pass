import { adminListReservations } from '../actions';
import { adminGetDayMetrics } from '../metrics-actions';
import { AdminDayView } from '@/components/admin/day-view';
import { todayCaracas } from '@/lib/dates';
import { parseDayParam } from '@/lib/day-metrics';

export const dynamic = 'force-dynamic';

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: rawDate } = await searchParams;
  const today = todayCaracas();
  const date = parseDayParam(rawDate, today);
  const [rows, metrics] = await Promise.all([
    adminListReservations(date),
    adminGetDayMetrics(date),
  ]);

  // key: a new day starts with fresh view state (chip "Todas", no toast).
  return <AdminDayView key={date} date={date} today={today} rows={rows} metrics={metrics} />;
}
