'use client';

import type { DaySummary } from '@/app/admin/actions';

function Metric(props: { label: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-28 flex-col rounded-2xl border bg-white p-3 ${props.className ?? ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <div className="mt-1 flex-1">{props.children}</div>
      {props.sub && <div className="text-xs text-muted-foreground">{props.sub}</div>}
    </div>
  );
}

function occupancyTone(pct: number): string {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 75) return 'bg-orange-500';
  if (pct >= 40) return 'bg-sky-500';
  return 'bg-green-500';
}

export function MetricGrid(props: { summary: DaySummary; onReviewPending: () => void }) {
  const s = props.summary;
  const pct = s.capacity > 0 ? Math.min(100, Math.round((s.confirmedPeople / s.capacity) * 100)) : 0;
  const pending = s.pendingCount > 0;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Metric label="Ocupación" sub={`${s.confirmedPeople} personas dentro`}>
        <div className="text-xl font-extrabold">
          {s.confirmedPeople}<span className="text-sm font-normal text-muted-foreground">/{s.capacity}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${occupancyTone(pct)}`} style={{ width: `${pct}%` }} />
        </div>
      </Metric>

      <Metric label="Ingresaron" sub={`${s.checkedInPeople} personas dentro`}>
        <div className="text-xl font-extrabold">
          {s.checkedInParties} <span className="text-sm font-normal text-muted-foreground">grupos</span>
        </div>
      </Metric>

      <Metric label="Ingresos del día" sub={`Bs. ${s.revenueVes.toFixed(2)} · ${s.paidCount} reservas`}>
        <div className="text-xl font-extrabold">${s.revenueUsd.toFixed(2)}</div>
      </Metric>

      <Metric
        label="Pagos por verificar"
        className={pending ? 'border-amber-300 bg-amber-50' : ''}
        sub={pending ? undefined : <span className="font-semibold text-green-700">Todo al día</span>}
      >
        <div className={`text-xl font-extrabold ${pending ? 'text-amber-600' : ''}`}>{s.pendingCount}</div>
        {pending && (
          <div className="mt-1 space-y-1">
            <p className="text-xs font-semibold text-amber-700">Requiere atención</p>
            <button
              type="button"
              onClick={props.onReviewPending}
              className="cursor-pointer rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Revisar pagos
            </button>
          </div>
        )}
      </Metric>
    </div>
  );
}
