import Link from 'next/link';
import { X } from 'lucide-react';
import type { StatusCounts } from '@/lib/db/reservation-counts';
import { cn } from '@/lib/utils';
import {
  STATUS_CHIPS, activeFilters, activeStatusChip, clearFiltersHref, reservationsHref, type ReservationsState,
} from '../_lib/search-params';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-teal';

/** Todas · Confirmadas · Ingresaron · Pendientes · Canceladas (roadmap §2). */
export function StatusChips(props: { state: ReservationsState; counts: StatusCounts }) {
  const active = activeStatusChip(props.state);
  return (
    <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {STATUS_CHIPS.map((chip) => {
        const on = chip.key === active;
        return (
          <Link
            key={chip.key}
            href={reservationsHref(props.state, { statuses: chip.statuses })}
            scroll={false}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none',
              FOCUS,
              on ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {chip.label}{' '}
            <span
              className={cn(
                'ml-1 rounded-full px-1.5 text-xs font-semibold tabular-nums',
                on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {props.counts[chip.key].toLocaleString('es-VE')}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Dismissible chips for every active filter, plus "Limpiar todo". */
export function ActiveFilters(props: { state: ReservationsState }) {
  const filters = activeFilters(props.state);
  if (filters.length === 0) return null;
  return (
    <div role="group" aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          scroll={false}
          aria-label={`Quitar filtro ${f.label}`}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-teal/40 bg-mint px-3 text-sm font-medium text-navy hover:bg-teal-soft',
            FOCUS,
          )}
        >
          {f.label}
          <X aria-hidden className="size-4" />
        </Link>
      ))}
      <Link
        href={clearFiltersHref(props.state)}
        scroll={false}
        className={cn('inline-flex min-h-11 items-center px-2 text-sm font-semibold text-navy underline-offset-4 hover:underline', FOCUS)}
      >
        Limpiar todo
      </Link>
    </div>
  );
}
