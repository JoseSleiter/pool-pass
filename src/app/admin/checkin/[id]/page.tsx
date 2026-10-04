import type { Metadata } from 'next';
import { getReservation } from '@/lib/db/reservations';
import { adminCheckIn } from '@/app/admin/actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { CheckinCard } from '@/components/admin/checkin-card';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Control de entrada',
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gate screen opened by the operator's phone camera from the voucher QR.
 * Lives outside the admin shell on purpose: the whole viewport is the verdict.
 */
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
    <main className="flex min-h-dvh flex-1 flex-col">
      <CheckinCard reservation={reservation} today={todayCaracas()} onCheckIn={adminCheckIn} />
    </main>
  );
}
