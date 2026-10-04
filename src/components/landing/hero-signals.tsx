import type { Dictionary } from '@/lib/i18n/types';
import { interpolate } from '@/lib/i18n/format';
import { todayState, type TodayState } from '@/lib/availability';
import { cn } from '@/lib/utils';

const GLASS = 'border border-white/20 bg-white/10 backdrop-blur-md';

const DOT: Record<TodayState, string> = {
  open: 'bg-emerald-400',
  low: 'bg-amber-400',
  soldOut: 'bg-destructive',
};

const RING: Record<TodayState, string> = {
  open: 'ring-emerald-300/30',
  low: 'ring-amber-300/60',
  soldOut: 'ring-destructive/60',
};

/**
 * Live availability for today (Caracas): green pulsing dot while there is room,
 * amber "Últimos cupos" below 20 % of today's capacity, red "Agotado hoy" at 0.
 * Server-safe (no hooks): the hero renders it on the server with fresh numbers.
 */
export function TodayBadge(props: { t: Dictionary; remaining: number; capacity: number }) {
  const { t } = props;
  const state = todayState(props.remaining, props.capacity);
  const label =
    state === 'open' ? t.hero.poolOpen : state === 'low' ? t.hero.lastSpots : t.hero.soldOutToday;
  return (
    <div
      role="status"
      data-testid="today-badge"
      data-state={state}
      className={cn('inline-flex items-center gap-3 rounded-full px-4 py-2 ring-1', GLASS, RING[state])}
    >
      <span aria-hidden className="relative flex h-2.5 w-2.5">
        {state === 'open' && (
          <span
            data-pulse
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping"
          />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', DOT[state])} />
      </span>
      <span className="text-sm font-semibold text-white">{label}</span>
      {state !== 'soldOut' && (
        <span className="text-xs text-white/75">
          {interpolate(t.hero.spotsLeftToday, { count: props.remaining })}
        </span>
      )}
    </div>
  );
}

/**
 * Social proof with real numbers only (roadmap §2): people with a confirmed or
 * checked-in booking for the upcoming weekend. `null` (below the threshold or
 * on error) renders nothing.
 */
export function WeekendChip(props: { t: Dictionary; people: number | null; className?: string }) {
  if (props.people === null) return null;
  return (
    <p
      data-testid="weekend-chip"
      className={cn('inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white', GLASS, props.className)}
    >
      {interpolate(props.t.hero.weekendBooked, { count: props.people })}
    </p>
  );
}
