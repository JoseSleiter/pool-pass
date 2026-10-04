'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
import { CheckinDialog } from '@/components/admin/checkin-dialog';
import { Pagination } from '@/components/admin/pagination';
import { ReservationCard } from '@/components/admin/reservation-card';
import { ReservationDetailDialog } from '@/components/admin/reservation-detail-dialog';
import { Toast } from '@/components/ui/toast';
import type { StatusCounts } from '@/lib/db/reservation-counts';
import type { ReservationRow } from '@/lib/db/reservations';
import {
  RESERVATIONS_PATH, activeFilters, clearFiltersHref, stateToParams, type ReservationsState,
} from '../_lib/search-params';
import { ActiveFilters, StatusChips } from './filter-chips';
import { FiltersDrawer } from './filters-drawer';
import { ReservationsDataTable } from './reservations-data-table';
import { SearchBox } from './search-box';

type ToastState = { kind: 'success' | 'error'; message: string } | null;

export function ReservationsView(props: {
  state: ReservationsState;
  rows: ReservationRow[];
  total: number;
  /** Rows per status chip, for the same search minus its status filter. */
  counts: StatusCounts;
  /** Caracas date, for CheckinDialog's wrong-date warning. */
  today: string;
}) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const detail = props.rows.find((r) => r.id === detailId) ?? null;
  const checkin = props.rows.find((r) => r.id === checkinId) ?? null;
  const filtered = activeFilters(props.state).length > 0;

  async function resend(id: string) {
    const res = await adminResendVoucher(id);
    setToast(res.ok
      ? { kind: 'success', message: 'Voucher reenviado por correo' }
      : { kind: 'error', message: res.message ?? 'No se pudo reenviar el correo.' });
  }

  async function approve(id: string) {
    const res = await adminCheckIn(id);
    setToast(res.ok
      ? { kind: 'success', message: 'Check-in aprobado' }
      : { kind: 'error', message: res.message ?? 'No se pudo registrar la entrada.' });
    // adminCheckIn only revalidates /admin; refresh this list ourselves.
    if (res.ok) router.refresh();
    return res;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="font-heading text-2xl font-extrabold text-navy">Reservas</h1>
        <p className="text-sm text-muted-foreground">Busca, filtra y gestiona todas las reservas.</p>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2">
          <SearchBox state={props.state} />
          <FiltersDrawer state={props.state} />
        </div>
        <StatusChips state={props.state} counts={props.counts} />
        <ActiveFilters state={props.state} />
      </div>

      <section aria-label="Resultados" className="rounded-2xl border border-slate-200 bg-white">
        {props.rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-semibold text-navy">No hay reservas que coincidan.</p>
            {filtered && (
              <Link
                href={clearFiltersHref(props.state)}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4"
              >
                Limpiar filtros
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <ReservationsDataTable
                state={props.state}
                rows={props.rows}
                onDetail={setDetailId}
                onResend={resend}
                onCheckin={setCheckinId}
              />
            </div>
            <ul className="space-y-2 p-3 md:hidden">
              {props.rows.map((r) => (
                <li key={r.id}>
                  <ReservationCard reservation={r} onDetail={setDetailId} onResend={resend} onCheckin={setCheckinId} />
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="sticky bottom-0 z-10 rounded-b-2xl bg-white/95 px-4 pb-3 backdrop-blur">
          <Pagination
            pathname={RESERVATIONS_PATH}
            params={stateToParams(props.state)}
            page={props.state.page}
            pageSize={props.state.pageSize}
            total={props.total}
            noun="reservas"
          />
        </div>
      </section>

      {detail && (
        <ReservationDetailDialog
          reservation={detail}
          open
          onOpenChange={(o) => { if (!o) setDetailId(null); }}
          onResend={resend}
          onStartCheckin={() => { setDetailId(null); setCheckinId(detail.id); }}
        />
      )}
      {checkin && (
        <CheckinDialog
          reservation={checkin}
          today={props.today}
          open
          onOpenChange={(o) => { if (!o) setCheckinId(null); }}
          onApprove={approve}
        />
      )}
      <Toast kind={toast?.kind ?? 'success'} message={toast?.message ?? null} onDismiss={dismissToast} />
    </main>
  );
}
