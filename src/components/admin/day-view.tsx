'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { MetricGrid } from './metric-cards';
import { ReservationsTable, type ChipKey } from './reservations-table';
import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
import { ADMIN_ACTION, ADMIN_INPUT } from './ui-constants';
import { longDateEs } from '@/lib/dates';
import { isIsoDate, shiftIsoDate, type DayMetrics } from '@/lib/day-metrics';
import type { ReservationRow } from '@/lib/db/reservations';
import { cn } from '@/lib/utils';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** "‹ Ayer" / "Mañana ›" move one day from the shown date; "Hoy" is highlighted when the shown date is today. */
function DateToolbar(props: { date: string; today: string; onGo: (date: string) => void }) {
  const isToday = props.date === props.today;
  return (
    <div
      role="group"
      aria-label="Elegir día"
      className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm"
    >
      <Button variant="outline" className={ADMIN_ACTION} onClick={() => props.onGo(shiftIsoDate(props.date, -1))}>
        ‹ Ayer
      </Button>
      <Button
        variant={isToday ? 'default' : 'outline'}
        aria-current={isToday ? 'date' : undefined}
        className={cn(ADMIN_ACTION, isToday && 'bg-navy text-white hover:bg-navy/90')}
        onClick={() => { if (!isToday) props.onGo(props.today); }}
      >
        Hoy
      </Button>
      <Button variant="outline" className={ADMIN_ACTION} onClick={() => props.onGo(shiftIsoDate(props.date, 1))}>
        Mañana ›
      </Button>
      <label htmlFor="admin-day-date" className="sr-only">Fecha</label>
      <Input
        id="admin-day-date"
        type="date"
        className={`${ADMIN_INPUT} w-full bg-white sm:ml-auto sm:w-fit`}
        value={props.date}
        onChange={(e) => { if (isIsoDate(e.target.value)) props.onGo(e.target.value); }}
      />
    </div>
  );
}

export function AdminDayView(props: { date: string; today: string; rows: ReservationRow[]; metrics: DayMetrics }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [chip, setChip] = useState<ChipKey>('all');
  const listRef = useRef<HTMLElement>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const isToday = props.date === props.today;

  const go = (d: string) => router.push(`/admin?date=${d}`);

  const reviewPending = () => {
    setChip('pending_payment');
    const list = listRef.current;
    list?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    list?.focus({ preventScroll: true });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">{isToday ? 'Hoy' : 'Resumen del día'}</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{longDateEs(props.date)}</p>
      </div>

      <DateToolbar date={props.date} today={props.today} onGo={go} />

      <MetricGrid metrics={props.metrics} onReviewPending={reviewPending} />

      <section
        ref={listRef}
        tabIndex={-1}
        aria-labelledby="day-list-title"
        className="scroll-mt-4 rounded-2xl border bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <h2 id="day-list-title" className="font-extrabold">Reservas programadas</h2>
        <p className="mb-3 text-sm text-muted-foreground">Consulta y gestiona los accesos del día</p>
        <ReservationsTable
          rows={props.rows}
          today={props.today}
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
      </section>

      <Toast kind={toast?.kind ?? 'success'} message={toast?.message ?? null} onDismiss={dismissToast} />
    </main>
  );
}
