import Link from 'next/link';
import { getReservation } from '@/lib/db/reservations';
import { adminCheckIn } from '@/app/admin/actions';
import { CheckinCard } from '@/components/admin/checkin-card';

export const dynamic = 'force-dynamic';

function todayCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
