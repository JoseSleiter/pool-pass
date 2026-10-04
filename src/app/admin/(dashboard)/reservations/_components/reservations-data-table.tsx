'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Mail, Ticket } from 'lucide-react';
import { StatusPill } from '@/components/admin/status-pill';
import { ADMIN_ICON_ACTION } from '@/components/admin/ui-constants';
import type { ReservationRow } from '@/lib/db/reservations';
import { shortDateEs } from '@/lib/dates';
import { partyShort } from '@/lib/party';
import { cn } from '@/lib/utils';
import { ariaSort, sortHref, type ReservationsState, type SortKey } from '../_lib/search-params';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'date', label: 'Fecha' },
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Cliente' },
  { key: 'guests', label: 'Personas', numeric: true },
  { key: 'total_usd', label: 'Total', numeric: true },
  { key: 'status', label: 'Estado' },
];

const ICON_BUTTON = cn(
  ADMIN_ICON_ACTION,
  'grid cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors motion-reduce:transition-none',
  'hover:bg-slate-100 hover:text-navy focus-visible:outline-2 focus-visible:outline-teal',
);

export interface RowActions {
  onDetail: (id: string) => void;
  onResend: (id: string) => void;
  onCheckin: (id: string) => void;
}

function SortIcon(props: { sort: 'ascending' | 'descending' | 'none' }) {
  if (props.sort === 'ascending') return <ArrowUp aria-hidden className="size-3.5" />;
  if (props.sort === 'descending') return <ArrowDown aria-hidden className="size-3.5" />;
  return <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />;
}

/** Desktop reservations table (md2 §4): URL-sorted columns, clean rows, inline 44px actions. */
export function ReservationsDataTable(props: { state: ReservationsState; rows: ReservationRow[] } & RowActions) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Reservas. Pulsa un encabezado para ordenar.</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          {COLUMNS.map((c) => {
            const sort = ariaSort(props.state, c.key);
            return (
              <th key={c.key} scope="col" aria-sort={sort} className={cn('px-3 py-1 font-semibold', c.numeric && 'text-right')}>
                <Link
                  href={sortHref(props.state, c.key)}
                  scroll={false}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1 rounded-md hover:text-navy focus-visible:outline-2 focus-visible:outline-teal',
                    sort !== 'none' && 'text-navy',
                  )}
                >
                  {c.label}
                  <SortIcon sort={sort} />
                </Link>
              </th>
            );
          })}
          <th scope="col" className="px-3 py-1 text-right font-semibold">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.id} data-testid="res-table-row" className="border-b border-slate-100 transition-colors motion-reduce:transition-none hover:bg-slate-50">
            <td className="whitespace-nowrap px-3 py-2">
              <span className="block first-letter:uppercase">{shortDateEs(r.date)}</span>
            </td>
            <td className="px-3 py-2 font-mono font-semibold">{r.code}</td>
            <td className="px-3 py-2">
              <p className="font-medium text-slate-900">{r.first_name} {r.last_name}</p>
              <p className="text-xs text-muted-foreground">{r.id_type}-{r.id_number}</p>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              <p className="font-medium">{r.adults + r.children}</p>
              <p className="text-xs text-muted-foreground">{partyShort(r.adults, r.children)}</p>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              <p className="font-medium">${Number(r.total_usd).toFixed(2)}</p>
              {r.total_ves != null && (
                <p className="text-xs text-muted-foreground">Bs. {Number(r.total_ves).toFixed(2)}</p>
              )}
            </td>
            <td className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill reservation={r} />
                {r.status === 'pending_payment' && (
                  <button
                    type="button"
                    aria-label={`Verificar pago de ${r.code}`}
                    onClick={() => props.onDetail(r.id)}
                    className="min-h-11 cursor-pointer rounded-lg px-2 text-xs font-semibold text-amber-900 underline underline-offset-4 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-teal"
                  >
                    Verificar
                  </button>
                )}
              </div>
            </td>
            <td className="px-3 py-1">
              <div className="flex justify-end gap-1">
                {r.status === 'confirmed' && (
                  <button type="button" className={ICON_BUTTON} aria-label={`Check-in ${r.code}`} title="Check-in"
                    onClick={() => props.onCheckin(r.id)}>
                    <Ticket aria-hidden className="size-5" />
                  </button>
                )}
                {(r.status === 'confirmed' || r.status === 'checked_in') && (
                  <button type="button" className={ICON_BUTTON} aria-label={`Reenviar voucher ${r.code}`} title="Reenviar voucher"
                    onClick={() => props.onResend(r.id)}>
                    <Mail aria-hidden className="size-5" />
                  </button>
                )}
                <button type="button" className={ICON_BUTTON} aria-label={`Ver detalle ${r.code}`} title="Ver detalle"
                  onClick={() => props.onDetail(r.id)}>
                  <Eye aria-hidden className="size-5" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
