import Link from 'next/link';
import { getReservation } from '@/lib/db/reservations';
import { adminCheckIn } from '@/app/admin/actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { CheckinCard } from '@/components/admin/checkin-card';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Defense in depth: this page reads customer PII via the service role, so it
  // re-verifies the admin token here instead of trusting middleware alone.
  await requireAdmin();
  const { id } = await params;
  const reservation = UUID_RE.test(id) ? await getReservation(id).catch(() => null) : null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Check-in</h1>
        <Link href="/admin" className="text-sm underline">← Reservas</Link>
      </div>
      {reservation ? (
        <CheckinCard reservation={reservation} today={todayCaracas()} onCheckIn={adminCheckIn} />
      ) : (
        <p className="rounded-lg bg-red-100 p-4 text-center font-semibold text-red-900">
          ⛔ Reserva no encontrada
        </p>
      )}
    </main>
  );
}
