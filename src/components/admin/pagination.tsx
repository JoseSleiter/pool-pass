'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION, ADMIN_INPUT } from './ui-constants';

/**
 * URL-driven pagination for admin lists (reservations, C2P transactions, BCV
 * rates, audit log). State lives in `?page=&pageSize=` so server pages can read
 * it and links stay shareable; every other search param is preserved.
 */

export const PAGE_SIZES = [10, 25, 50] as const;

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** "Mostrando 1–10 de 142 reservas" (clamped to the last row). */
export function rangeLabel(page: number, pageSize: number, total: number, noun: string): string {
  if (total === 0) return `Sin ${noun}`;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `Mostrando ${from}–${to} de ${total} ${noun}`;
}

/** Page numbers to render: first, last, current ± 1, with 'gap' for elided runs. */
export function pageWindow(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export function pageHref(
  pathname: string,
  params: Record<string, string>,
  page: number,
  pageSize: number,
): string {
  const sp = new URLSearchParams(params);
  sp.delete('page');
  sp.delete('pageSize');
  sp.set('page', String(page));
  sp.set('pageSize', String(pageSize));
  return `${pathname}?${sp.toString()}`;
}

const CELL = cn(ADMIN_ICON_ACTION, 'inline-flex items-center justify-center rounded-lg text-sm tabular-nums');
const LINK = cn(CELL, 'border border-border bg-background hover:bg-muted');
const INERT = cn(CELL, 'border border-transparent text-muted-foreground/40');

function Step(props: { href: string | null; label: string; children: React.ReactNode }) {
  return props.href ? (
    <Link href={props.href} aria-label={props.label} className={LINK}>
      {props.children}
    </Link>
  ) : (
    <span aria-hidden className={INERT}>
      {props.children}
    </span>
  );
}

export function Pagination(props: {
  pathname: string;
  /** Current search params (page/pageSize are overridden). */
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun for the range label: "reservas", "registros"… */
  noun: string;
}) {
  const router = useRouter();
  const pages = totalPages(props.total, props.pageSize);
  const page = Math.min(Math.max(1, props.page), pages);
  const href = (p: number) => pageHref(props.pathname, props.params, p, props.pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {rangeLabel(page, props.pageSize, props.total, props.noun)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Filas por página
          <select
            className={cn(ADMIN_INPUT, 'rounded-lg border border-border bg-background px-2')}
            value={props.pageSize}
            onChange={(e) => router.push(pageHref(props.pathname, props.params, 1, Number(e.target.value)))}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <nav aria-label="Paginación" className="flex items-center gap-1">
          <Step href={page > 1 ? href(1) : null} label="Primera página"><ChevronsLeft className="size-4" /></Step>
          <Step href={page > 1 ? href(page - 1) : null} label="Página anterior"><ChevronLeft className="size-4" /></Step>
          {pageWindow(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">…</span>
            ) : p === page ? (
              <span key={p} aria-current="page" className={cn(CELL, 'bg-navy-deep font-semibold text-white')}>
                {p}
              </span>
            ) : (
              <Link key={p} href={href(p)} aria-label={`Página ${p}`} className={LINK}>
                {p}
              </Link>
            ),
          )}
          <Step href={page < pages ? href(page + 1) : null} label="Página siguiente"><ChevronRight className="size-4" /></Step>
          <Step href={page < pages ? href(pages) : null} label="Última página"><ChevronsRight className="size-4" /></Step>
        </nav>
      </div>
    </div>
  );
}
