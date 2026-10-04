'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { longDateEs } from '@/lib/dates';
import type { OverrideRow } from '@/lib/db/reservations';
import { ADMIN_ICON_ACTION } from '../ui-constants';
import { monthGrid, monthLabelEs, shiftMonth, WEEKDAYS_ES } from './month-grid';

export type DayKind = 'closed' | 'special' | 'normal';

export function dayKind(o: OverrideRow | undefined): DayKind {
  if (!o) return 'normal';
  return o.capacity === 0 ? 'closed' : 'special';
}

const KIND_CLASS: Record<DayKind, string> = {
  closed: 'bg-coral/20 font-bold text-navy ring-1 ring-inset ring-coral',
  special: 'bg-teal/20 font-bold text-navy ring-1 ring-inset ring-teal',
  normal: 'text-slate-700 hover:bg-muted',
};

function dayLabel(date: string, o: OverrideRow | undefined): string {
  const base = longDateEs(date);
  if (!o) return `${base}: sin excepción`;
  const what = o.capacity === 0 ? 'cerrado' : `capacidad especial de ${o.capacity}`;
  return `${base}: ${what}${o.reason ? ` (${o.reason})` : ''}`;
}

export function ExceptionsCalendar(props: {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD, Caracas
  overrides: Map<string, OverrideRow>;
  onMonthChange: (month: string) => void;
  onSelectDay: (date: string) => void;
}) {
  const weeks = monthGrid(props.month);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" className={ADMIN_ICON_ACTION} aria-label="Mes anterior"
          onClick={() => props.onMonthChange(shiftMonth(props.month, -1))}>
          <ChevronLeft />
        </Button>
        <h3 aria-live="polite" className="font-bold first-letter:uppercase">{monthLabelEs(props.month)}</h3>
        <Button variant="ghost" size="icon" className={ADMIN_ICON_ACTION} aria-label="Mes siguiente"
          onClick={() => props.onMonthChange(shiftMonth(props.month, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS_ES.map((d) => (
              <th key={d.long} scope="col" className="text-xs font-semibold text-muted-foreground">
                <abbr title={d.long} className="no-underline">{d.short}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                if (!date) return <td key={`pad-${wi}-${di}`} />;
                const o = props.overrides.get(date);
                const kind = dayKind(o);
                const isToday = date === props.today;
                return (
                  <td key={date}>
                    <button
                      type="button"
                      data-kind={kind}
                      aria-label={dayLabel(date, o)}
                      aria-current={isToday ? 'date' : undefined}
                      disabled={date < props.today && !o}
                      onClick={() => props.onSelectDay(date)}
                      className={cn(
                        'flex min-h-11 w-full flex-col items-center justify-center rounded-lg text-sm tabular-nums',
                        'transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40',
                        KIND_CLASS[kind],
                        isToday && 'outline-2 outline-offset-1 outline-navy',
                      )}
                    >
                      <span>{Number(date.slice(8))}</span>
                      {kind === 'closed' && <span aria-hidden className="text-[10px] leading-none">Cerr.</span>}
                      {kind === 'special' && <span aria-hidden className="text-[10px] leading-none">{o!.capacity}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label="Leyenda" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded bg-coral/20 ring-1 ring-inset ring-coral" />
          Día cerrado (capacidad 0)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded bg-teal/20 ring-1 ring-inset ring-teal" />
          Capacidad especial (el número es el cupo)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded outline-2 outline-offset-[-2px] outline-navy" />
          Hoy
        </li>
      </ul>
    </div>
  );
}
