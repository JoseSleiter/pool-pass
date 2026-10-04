// src/components/admin/topbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight } from 'lucide-react';
import { longDateEs } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { breadcrumbFor } from './nav-config';
import type { ShellStatus } from './topbar-data';
import { ADMIN_ICON_ACTION } from './ui-constants';

/** Pending payments are reviewed from "Hoy" until PR 10 ships /admin/reservations. */
export const PENDING_HREF = '/admin';

export function Breadcrumb(props: { pathname: string }) {
  const crumb = breadcrumbFor(props.pathname);
  return (
    <nav aria-label="Ruta" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumb && (
          <li className="hidden items-center gap-1 text-muted-foreground sm:flex">
            {crumb.group}
            <ChevronRight aria-hidden className="size-4" />
          </li>
        )}
        <li aria-current="page" className="truncate font-heading text-base font-semibold text-navy">
          {crumb?.label ?? 'Panel'}
        </li>
      </ol>
    </nav>
  );
}

function updatedAt(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Cached BCV rate only; this component never triggers a fetch. */
export function BcvBadge(props: { bcv: ShellStatus['bcv'] }) {
  const base = 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium';
  if (!props.bcv) {
    return <span className={cn(base, 'bg-slate-100 text-slate-600')}>BCV · sin tasa</span>;
  }
  const title = props.bcv.at ? `Tasa en caché, actualizada ${updatedAt(props.bcv.at)}` : 'Tasa en caché';
  return (
    <span title={title} className={cn(base, 'bg-mint text-navy')}>
      <span aria-hidden className="size-2 rounded-full bg-teal" />
      {`BCV · Bs. ${props.bcv.rate.toFixed(2)}`}
    </span>
  );
}

export function PendingBell(props: { count: number | null }) {
  const n = props.count ?? 0;
  const label =
    props.count === null ? 'Pagos pendientes'
      : n === 1 ? '1 pago pendiente por verificar'
        : `${n} pagos pendientes por verificar`;
  return (
    <Link
      href={PENDING_HREF}
      aria-label={label}
      title={label}
      className={cn(
        ADMIN_ICON_ACTION,
        'relative grid shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-navy transition-colors motion-reduce:transition-none',
        'hover:bg-mint focus-visible:outline-2 focus-visible:outline-teal',
      )}
    >
      <Bell aria-hidden className="size-5" />
      {n > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs font-semibold text-white"
        >
          {n > 99 ? '99+' : n}
        </span>
      )}
    </Link>
  );
}

export function Topbar(props: { status: ShellStatus }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
      <Breadcrumb pathname={pathname} />
      <div className="flex shrink-0 items-center gap-2">
        <time dateTime={props.status.today} className="hidden text-sm capitalize text-muted-foreground lg:block">
          {longDateEs(props.status.today)}
        </time>
        <BcvBadge bcv={props.status.bcv} />
        <PendingBell count={props.status.pendingCount} />
      </div>
    </header>
  );
}
