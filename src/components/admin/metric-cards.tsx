'use client';

import { useId } from 'react';
import { CalendarX2, DoorOpen, Users, type LucideIcon } from 'lucide-react';
import type { DaySummary } from '@/app/admin/actions';
import {
  hourLabel, hourlySeries, occupancyLevel, occupancyPercent, type DayMetrics, type OccupancyLevel,
} from '@/lib/day-metrics';
import { cn } from '@/lib/utils';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** KPI card shell: a labelled region (h2) so screen readers and tests can find each card by name. */
function MetricCard(props: {
  title: string;
  icon: LucideIcon;
  level?: string;
  alert?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const Icon = props.icon;
  return (
    <section
      aria-labelledby={titleId}
      data-level={props.level}
      className={cn(
        'flex min-h-44 flex-col rounded-2xl border bg-white p-4 shadow-sm',
        props.alert && 'border-amber-300 bg-amber-50',
      )}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        {props.title}
      </h2>
      <div className="mt-3 flex flex-1 flex-col">{props.children}</div>
    </section>
  );
}

const LEVEL_STROKE: Record<OccupancyLevel, string> = {
  normal: 'stroke-teal',
  high: 'stroke-amber-500',
  peak: 'stroke-coral',
};

const LEVEL_CHIP: Record<OccupancyLevel, string> = {
  normal: 'bg-mint text-navy',
  high: 'bg-amber-100 text-amber-800',
  peak: 'bg-coral/15 text-red-800',
};

function levelLabel(percent: number): string {
  if (percent >= 100) return 'Lleno';
  const level = occupancyLevel(percent);
  if (level === 'peak') return 'Casi lleno';
  if (level === 'high') return 'Alta demanda';
  return 'Normal';
}

const GAUGE_R = 30;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

/** Decorative radial gauge; the accessible value lives on the role="meter" wrapper. */
function RadialGauge(props: { percent: number; level: OccupancyLevel }) {
  const fill = Math.min(100, Math.max(0, props.percent));
  return (
    <svg viewBox="0 0 72 72" aria-hidden className="size-20 -rotate-90">
      <circle cx="36" cy="36" r={GAUGE_R} fill="none" strokeWidth="8" className="stroke-slate-200" />
      <circle
        data-testid="occupancy-arc"
        cx="36" cy="36" r={GAUGE_R} fill="none" strokeWidth="8"
        strokeLinecap={fill > 0 ? 'round' : 'butt'}
        strokeDasharray={GAUGE_C}
        strokeDashoffset={GAUGE_C * (1 - fill / 100)}
        className={cn(LEVEL_STROKE[props.level], 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500')}
      />
    </svg>
  );
}

export function OccupancyCard(props: { metrics: DayMetrics }) {
  const { capacity, defaultCapacity, override, confirmedPeople: people } = props.metrics;
  const percent = occupancyPercent(people, capacity);

  if (percent === null) {
    const why = override
      ? `Día cerrado por excepción${override.reason ? ` · ${override.reason}` : ''}`
      : 'La capacidad diaria está en 0';
    return (
      <MetricCard title="Ocupación" icon={Users} level="closed">
        <p className="flex items-center gap-2 text-2xl font-extrabold text-navy">
          <CalendarX2 aria-hidden className="size-6 text-coral" />
          Cerrado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{why}</p>
        {people > 0 && (
          <p className="mt-2 text-sm font-semibold text-red-800">
            {plural(people, 'persona', 'personas')} con reserva este día
          </p>
        )}
      </MetricCard>
    );
  }

  const level = occupancyLevel(percent);
  return (
    <MetricCard title="Ocupación" icon={Users} level={level}>
      <div className="flex items-center gap-4">
        <div
          role="meter"
          aria-label="Ocupación del día"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={Math.min(people, capacity)}
          aria-valuetext={`${people} de ${capacity} personas (${percent} %)`}
          className="relative size-20 shrink-0"
        >
          <RadialGauge percent={percent} level={level} />
          <span aria-hidden className="absolute inset-0 grid place-items-center text-base font-extrabold text-navy">
            {percent} %
          </span>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-navy">
            {people}<span className="text-sm font-normal text-muted-foreground"> / {capacity}</span>
          </p>
          <p className="text-xs text-muted-foreground">personas confirmadas</p>
          <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', LEVEL_CHIP[level])}>
            {levelLabel(percent)}
          </span>
        </div>
      </div>
      {override && (
        <p className="mt-auto pt-3 text-xs text-muted-foreground">
          {`Capacidad especial (normal: ${defaultCapacity})${override.reason ? ` · ${override.reason}` : ''}`}
        </p>
      )}
    </MetricCard>
  );
}

/** Tiny inline bar sparkline (no chart lib). Bars are decorative; each hour has sr-only text. */
function HourlyBars(props: { byHour: DayMetrics['checkinsByHour'] }) {
  const series = hourlySeries(props.byHour);
  const max = Math.max(...series.map((b) => b.people));
  const peak = series.find((b) => b.people === max)!;
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <div className="mt-auto pt-3">
      <ul role="list" aria-label="Ingresos por hora (hora de Caracas)" className="flex h-10 items-end gap-0.5">
        {series.map((b) => (
          <li key={b.hour} className="flex h-full flex-1 items-end" title={`${hourLabel(b.hour)} · ${plural(b.people, 'persona', 'personas')}`}>
            <span
              data-testid="hour-bar"
              aria-hidden
              className={cn('w-full rounded-sm', b.people > 0 ? 'bg-teal' : 'bg-slate-200')}
              style={{ height: b.people > 0 ? `${Math.max(10, Math.round((b.people / max) * 100))}%` : '2px' }}
            />
            <span className="sr-only">{`${hourLabel(b.hour)}: ${plural(b.people, 'persona', 'personas')}`}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{hourLabel(first.hour)}</span>
        {last.hour !== first.hour && <span>{hourLabel(last.hour)}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {`Hora pico: ${hourLabel(peak.hour)} (${plural(peak.people, 'persona', 'personas')})`}
      </p>
    </div>
  );
}

export function CheckinsCard(props: { metrics: DayMetrics }) {
  const { checkedInPeople, confirmedPeople, checkedInParties, checkinsByHour } = props.metrics;
  const ratio = confirmedPeople > 0 ? Math.round((checkedInPeople / confirmedPeople) * 100) : 0;
  return (
    <MetricCard title="Check-ins" icon={DoorOpen}>
      <p className="text-2xl font-extrabold text-navy">
        {checkedInPeople}
        <span className="text-sm font-normal text-muted-foreground"> / {confirmedPeople} personas</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {`${ratio} % ya ingresó · ${plural(checkedInParties, 'grupo', 'grupos')}`}
      </p>
      {checkinsByHour.length === 0 ? (
        <p className="mt-auto pt-3 text-xs text-muted-foreground">Aún no hay ingresos registrados.</p>
      ) : (
        <HourlyBars byHour={checkinsByHour} />
      )}
    </MetricCard>
  );
}

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
