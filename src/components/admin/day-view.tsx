'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { ReservationsTable } from './reservations-table';
import { adminCheckIn, adminResendVoucher, type DaySummary } from '@/app/admin/actions';
import { longDateEs, todayCaracas } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

function Kpi(props: { label: string; children: React.ReactNode; sub?: string; tone?: 'amber' }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <div className={`text-xl font-extrabold ${props.tone === 'amber' ? 'text-amber-600' : ''}`}>{props.children}</div>
      {props.sub && <p className="text-xs text-muted-foreground">{props.sub}</p>}
    </div>
  );
}

export function AdminDayView(props: {
  date: string;
  rows: ReservationRow[];
  summary: DaySummary;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const s = props.summary;
  const go = (d: string) => { setNotice(null); router.push(`/admin?date=${d}`); };
  const shift = (days: number) => go(format(addDays(new Date(`${props.date}T12:00:00-04:00`), days), 'yyyy-MM-dd'));
  const pct = s.capacity > 0 ? Math.min(100, Math.round((s.confirmedPeople / s.capacity) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-extrabold capitalize">
          {props.date === todayCaracas() ? 'Hoy · ' : ''}{longDateEs(props.date)}
        </h2>
        <button type="button" className="min-h-11 rounded-lg border bg-white px-3 text-sm" onClick={() => shift(-1)}>‹ ayer</button>
        <button type="button" className="min-h-11 rounded-lg border bg-white px-3 text-sm" onClick={() => shift(1)}>mañana ›</button>
        <Input type="date" className="h-11 w-fit bg-white" value={props.date} onChange={(e) => go(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Ocupación">
          {s.confirmedPeople}<span className="text-sm font-normal text-muted-foreground">/{s.capacity}</span>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
          </div>
        </Kpi>
        <Kpi label="Ingresaron" sub={`${s.checkedInPeople} personas dentro`}>{s.checkedInParties} <span className="text-sm font-normal text-muted-foreground">grupos</span></Kpi>
        <Kpi label="Ingresos del día" sub={`Bs. ${s.revenueVes.toFixed(2)} · ${s.paidCount} reservas`}>${s.revenueUsd.toFixed(2)}</Kpi>
        <Kpi label="Pendientes" sub="por verificar pago" tone="amber">{s.pendingCount}</Kpi>
      </div>

      {notice && <p role="alert" className="rounded-md bg-muted p-3 text-sm">{notice}</p>}
      <ReservationsTable
        rows={props.rows}
        onCheckIn={async (id) => {
          setNotice(null);
          const res = await adminCheckIn(id);
          setNotice(res.ok ? 'Entrada registrada.' : res.message ?? null);
          router.refresh();
        }}
        onResend={async (id) => {
          setNotice(null);
          const res = await adminResendVoucher(id);
          setNotice(res.ok ? 'Correo reenviado.' : res.message ?? null);
        }}
      />
    </div>
  );
}
