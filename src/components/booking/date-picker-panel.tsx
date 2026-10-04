'use client';

import { createContext, useContext } from 'react';
import { format } from 'date-fns';
import type { DayButtonProps } from 'react-day-picker';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/lib/i18n/provider';
import { dateFnsLocale } from '@/lib/i18n/date-locale';
import { interpolate } from '@/lib/i18n/format';
import { remainingOn } from '@/lib/availability';

type SlotsInfo = {
  slotsFor: (isoDate: string) => number | undefined;
  label: (count: number) => string;
};

// react-day-picker renders the day buttons, so the per-day numbers reach them
// through context. A module-level component keeps a stable type, so the
// buttons are not remounted on every render (keyboard focus survives).
const SlotsContext = createContext<SlotsInfo>({ slotsFor: () => undefined, label: String });

function SlotDayButton({ children, className, ...props }: DayButtonProps) {
  const { slotsFor, label } = useContext(SlotsContext);
  const { day, modifiers } = props;
  // Outside days belong to another month whose availability is not loaded.
  const slots = modifiers.disabled || modifiers.outside ? undefined : slotsFor(day.isoDate);
  const text = slots !== undefined && slots > 0 ? label(slots) : null;
  return (
    <CalendarDayButton
      {...props}
      className={cn(className, 'gap-0.5')}
      aria-label={[props['aria-label'], text].filter(Boolean).join(', ')}
    >
      {children}
      {text && (
        <span
          data-slot="slots-left"
          className="whitespace-normal text-[9px]! leading-none! sm:text-[10px]!"
        >
          {text}
        </span>
      )}
    </CalendarDayButton>
  );
}

/**
 * Shared calendar editor. Reports the picked day as a `YYYY-MM-DD` string and the
 * viewed month as `YYYY-MM`. Disables past days and days with no availability,
 * and prints "Quedan N" under every available day (always visible, not on
 * hover, so it works on phones).
 *
 * `defaultCapacity` (settings.daily_capacity) labels days that are absent from
 * `availability` (no bookings, no override). Without it only listed days get
 * a label.
 *
 * Renders a bare, centered calendar with no surrounding chrome — callers wrap it
 * in their editor box. Month and weekday names follow the visitor's language.
 */
export function DatePickerPanel(props: {
  date: string;
  availability: Record<string, number>;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
  defaultCapacity?: number;
}) {
  const locale = useLocale();
  const t = useT();
  const anchor = new Date(`${props.date}T12:00:00`);
  const slots: SlotsInfo = {
    slotsFor: (isoDate) => remainingOn(isoDate, props.availability, props.defaultCapacity),
    label: (count) => interpolate(t.datePicker.slotsLeft, { count }),
  };
  return (
    <SlotsContext value={slots}>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          locale={dateFnsLocale(locale)}
          weekStartsOn={0}
          // 7 × 36px fits a 360px phone inside the cards; 44px touch targets from sm up.
          className="bg-transparent p-0 [--cell-size:2.25rem] sm:p-2 sm:[--cell-size:2.75rem]"
          selected={anchor}
          defaultMonth={anchor}
          components={{ DayButton: SlotDayButton }}
          onSelect={(d) => {
            if (d) props.onSelect(format(d, 'yyyy-MM-dd'));
          }}
          onMonthChange={(m) => props.onMonthChange(format(m, 'yyyy-MM'))}
          disabled={(d) => {
            const key = format(d, 'yyyy-MM-dd');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (d < today) return true;
            return props.availability[key] !== undefined && props.availability[key] <= 0;
          }}
        />
      </div>
    </SlotsContext>
  );
}
