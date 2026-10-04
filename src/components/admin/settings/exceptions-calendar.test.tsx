// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExceptionsCalendar, dayKind } from './exceptions-calendar';
import type { OverrideRow } from '@/lib/db/reservations';

const rows: OverrideRow[] = [
  { date: '2030-08-15', capacity: 0, reason: 'Mantenimiento' },
  { date: '2030-08-20', capacity: 40, reason: null },
];
const overrides = new Map(rows.map((o) => [o.date, o]));

function setup(today = '2030-08-01') {
  const onSelectDay = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <ExceptionsCalendar month="2030-08" today={today} overrides={overrides}
      onSelectDay={onSelectDay} onMonthChange={onMonthChange} />,
  );
  return { onSelectDay, onMonthChange };
}

describe('dayKind', () => {
  it('classifies overrides', () => {
    expect(dayKind(undefined)).toBe('normal');
    expect(dayKind(rows[0])).toBe('closed');
    expect(dayKind(rows[1])).toBe('special');
  });
});

describe('ExceptionsCalendar', () => {
  it('renders the month with one button per day', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'agosto de 2030' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /de agosto/ })).toHaveLength(31);
  });

  it('highlights closed and special days with distinct styles and labels', () => {
    setup();
    const closed = screen.getByRole('button', { name: /15 de agosto: cerrado \(Mantenimiento\)/ });
    const special = screen.getByRole('button', { name: /20 de agosto: capacidad especial de 40/ });
    const normal = screen.getByRole('button', { name: /10 de agosto: sin excepción/ });
    expect(closed).toHaveAttribute('data-kind', 'closed');
    expect(special).toHaveAttribute('data-kind', 'special');
    expect(normal).toHaveAttribute('data-kind', 'normal');
    expect(closed.className).toContain('bg-coral/20');
    expect(special.className).toContain('bg-teal/20');
    expect(closed.className).not.toBe(special.className);
    expect(closed).toHaveTextContent('Cerr.');
    expect(special).toHaveTextContent('40');
  });

  it('shows a legend', () => {
    setup();
    const legend = screen.getByRole('list', { name: 'Leyenda' });
    expect(legend).toHaveTextContent('Día cerrado (capacidad 0)');
    expect(legend).toHaveTextContent('Capacidad especial');
    expect(legend).toHaveTextContent('Hoy');
  });

  it('day buttons are 44px targets and today is marked', () => {
    setup('2030-08-01');
    const today = screen.getByRole('button', { name: /\b1 de agosto:/ });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today.className).toContain('min-h-11');
  });

  it('clicking a day reports its date', async () => {
    const { onSelectDay } = setup();
    await userEvent.click(screen.getByRole('button', { name: /10 de agosto/ }));
    expect(onSelectDay).toHaveBeenCalledWith('2030-08-10');
  });

  it('disables past days without an exception but keeps past exceptions editable', () => {
    setup('2030-08-16');
    expect(screen.getByRole('button', { name: /10 de agosto/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /15 de agosto/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /16 de agosto/ })).toBeEnabled();
  });

  it('navigates months', async () => {
    const { onMonthChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2030-09');
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(onMonthChange).toHaveBeenLastCalledWith('2030-07');
  });
});
