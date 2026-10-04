'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { MetricGrid } from './metric-cards';
import { ReservationsTable, type ChipKey } from './reservations-table';
import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
import type { DayMetrics } from '@/lib/day-metrics';
import { ADMIN_ACTION, ADMIN_INPUT } from './ui-constants';
import { longDateEs } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

export function AdminDayView(props: { date: string; today: string; rows: ReservationRow[]; metrics: DayMetrics }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [chip, setChip] = useState<ChipKey>('all');
  const today = props.today;
  const dismissToast = useCallback(() => setToast(null), []);

  const go = (d: string) => router.push(`/admin?date=${d}`);
  const shift = (days: number) => {
    const d = new Date(`${props.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    go(d.toISOString().slice(0, 10));
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">Reservas del día</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{longDateEs(props.date)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className={`${ADMIN_INPUT} w-full bg-white sm:w-fit`} value={props.date} onChange={(e) => go(e.target.value)} />
        <Button variant="outline" className={ADMIN_ACTION} onClick={() => shift(-1)}>‹ Ayer</Button>
        <Button variant="outline" className={ADMIN_ACTION} onClick={() => shift(1)}>Mañana ›</Button>
        {props.date !== today && <Button className={ADMIN_ACTION} onClick={() => go(today)}>Hoy</Button>}
      </div>

      <MetricGrid metrics={props.metrics} onReviewPending={() => setChip('pending_payment')} />

      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-extrabold">Reservas programadas</h2>
        <p className="mb-3 text-sm text-muted-foreground">Consulta y gestiona los accesos del día</p>
        <ReservationsTable
          rows={props.rows}
          today={today}
          chip={chip}
          onChipChange={setChip}
          onCheckIn={async (id) => {
            const res = await adminCheckIn(id);
            setToast(res.ok
              ? { kind: 'success', message: 'Check-in aprobado' }
              : { kind: 'error', message: res.message ?? 'No se pudo guardar. Revisa la fecha y la capacidad.' });
            router.refresh();
            return res;
          }}
          onResend={async (id) => {
            const res = await adminResendVoucher(id);
            setToast(res.ok
              ? { kind: 'success', message: 'Correo reenviado correctamente' }
              : { kind: 'error', message: res.message ?? 'No se pudo reenviar el correo.' });
          }}
        />
      </div>

      <Toast kind={toast?.kind ?? 'success'} message={toast?.message ?? null} onDismiss={dismissToast} />
    </main>
  );
}
