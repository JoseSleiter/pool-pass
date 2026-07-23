'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';

/**
 * Shared calendar editor. Reports the picked day as a `YYYY-MM-DD` string and the
 * viewed month as `YYYY-MM`. Disables past days and days with no availability.
 *
 * Renders a bare, centered calendar with no surrounding chrome — callers wrap it
 * in the editor box (header + "Listo" button) so it stays homogeneous with the
 * people editor and users can close it without picking a new date.
 */
export function DatePickerPanel(props: {
  date: string;
  availability: Record<string, number>;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
}) {
  const anchor = new Date(`${props.date}T12:00:00`);
  return (
    <div className="flex justify-center">
      <Calendar
        mode="single"
        locale={es}
        weekStartsOn={0}
        className="bg-transparent [--cell-size:2.5rem]"
        selected={anchor}
        defaultMonth={anchor}
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
  );
}
