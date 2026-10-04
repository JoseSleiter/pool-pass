// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DayMetrics } from '@/lib/day-metrics';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/app/admin/actions', () => ({ adminCheckIn: vi.fn(), adminResendVoucher: vi.fn() }));
vi.mock('./reservations-table', async () => {
  const { createElement } = await import('react');
  return {
    ReservationsTable: (p: { chip?: string }) =>
      createElement('div', { 'data-testid': 'reservations-table', 'data-chip': p.chip }),
  };
});

import { AdminDayView } from './day-view';

const metrics: DayMetrics = {
  capacity: 100, defaultCapacity: 100, override: null,
  confirmedPeople: 10, checkedInPeople: 2, checkedInParties: 1, checkinsByHour: [],
  collected: { usd: 100, ves: 3650, count: 3 },
  pending: { usd: 30, count: 2 },
};

function renderView(date: string, today = '2030-01-15') {
  render(<AdminDayView date={date} today={today} rows={[]} metrics={metrics} />);
  return screen.getByRole('group', { name: 'Elegir día' });
}

const scrollIntoView = vi.fn();
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('AdminDayView — date toolbar', () => {
  it('on today: title "Hoy" and the Hoy jumper is the active (current) date', () => {
    const toolbar = renderView('2030-01-15');
    expect(screen.getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-current', 'date');
  });

  it('shows the long Caracas date with first-letter uppercase (not capitalize)', () => {
    renderView('2030-01-10');
    const subtitle = screen.getByText(/10 de enero/);
    expect(subtitle).toHaveClass('first-letter:uppercase');
    expect(subtitle).not.toHaveClass('capitalize');
  });

  it('‹ Ayer and Mañana › move one day from the shown date via ?date=', async () => {
    const toolbar = renderView('2030-03-01', '2030-03-05');
    await userEvent.click(within(toolbar).getByRole('button', { name: '‹ Ayer' }));
    expect(push).toHaveBeenLastCalledWith('/admin?date=2030-02-28');
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Mañana ›' }));
    expect(push).toHaveBeenLastCalledWith('/admin?date=2030-03-02');
  });

  it('on another day: "Resumen del día", Hoy is not active and jumps to today', async () => {
    const toolbar = renderView('2030-01-10');
    expect(screen.getByRole('heading', { level: 1, name: 'Resumen del día' })).toBeInTheDocument();
    const hoy = within(toolbar).getByRole('button', { name: 'Hoy' });
    expect(hoy).not.toHaveAttribute('aria-current');
    await userEvent.click(hoy);
    expect(push).toHaveBeenCalledWith('/admin?date=2030-01-15');
  });

  it('Hoy does not navigate when already on today', async () => {
    const toolbar = renderView('2030-01-15');
    await userEvent.click(within(toolbar).getByRole('button', { name: 'Hoy' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('the labelled date input navigates only to real dates', () => {
    const toolbar = renderView('2030-01-15');
    const input = within(toolbar).getByLabelText('Fecha');
    expect(input).toHaveValue('2030-01-15');
    fireEvent.change(input, { target: { value: '2030-02-01' } });
    expect(push).toHaveBeenCalledWith('/admin?date=2030-02-01');
    push.mockClear();
    fireEvent.change(input, { target: { value: '' } });
    expect(push).not.toHaveBeenCalled();
  });

  it('every toolbar control is a 44px touch target', () => {
    const toolbar = renderView('2030-01-15');
    for (const name of ['‹ Ayer', 'Hoy', 'Mañana ›']) {
      expect(within(toolbar).getByRole('button', { name })).toHaveClass('h-11');
    }
    expect(within(toolbar).getByLabelText('Fecha')).toHaveClass('h-11');
  });
});

describe('AdminDayView — "Revisar C2P pendientes"', () => {
  it('starts on the "Todas" chip', () => {
    renderView('2030-01-15');
    expect(screen.getByTestId('reservations-table')).toHaveAttribute('data-chip', 'all');
  });

  it('filters the day list to pending payments, scrolls to it and moves focus there', async () => {
    renderView('2030-01-15');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar C2P pendientes' }));
    expect(screen.getByTestId('reservations-table')).toHaveAttribute('data-chip', 'pending_payment');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Reservas programadas' }));
  });

  it('scrolls without animation when the user prefers reduced motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    renderView('2030-01-15');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar C2P pendientes' }));
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
