// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MetricGrid, OccupancyCard } from './metric-cards';
import type { DaySummary } from '@/app/admin/actions';
import type { DayMetrics } from '@/lib/day-metrics';

const metrics: DayMetrics = {
  capacity: 100, defaultCapacity: 100, override: null,
  confirmedPeople: 5, checkedInPeople: 1, checkedInParties: 1, checkinsByHour: [],
  collected: { usd: 65, ves: 2390.05, count: 2 },
  pending: { usd: 0, count: 0 },
};
const m = (over: Partial<DayMetrics> = {}): DayMetrics => ({ ...metrics, ...over });

describe('OccupancyCard', () => {
  it.each<[number, string, string, string]>([
    [0, 'normal', 'stroke-teal', 'Normal'],
    [70, 'normal', 'stroke-teal', 'Normal'],
    [71, 'high', 'stroke-amber-500', 'Alta demanda'],
    [90, 'high', 'stroke-amber-500', 'Alta demanda'],
    [91, 'peak', 'stroke-coral', 'Casi lleno'],
    [100, 'peak', 'stroke-coral', 'Lleno'],
  ])('%i of 100 people → %s band', (people, level, stroke, label) => {
    render(<OccupancyCard metrics={m({ confirmedPeople: people })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(card).toHaveAttribute('data-level', level);
    expect(within(card).getByTestId('occupancy-arc')).toHaveClass(stroke);
    expect(within(card).getByText(label)).toBeInTheDocument();
    const meter = within(card).getByRole('meter', { name: 'Ocupación del día' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuenow', String(people));
    expect(meter).toHaveAttribute('aria-valuetext', `${people} de 100 personas (${people} %)`);
    expect(card).toHaveTextContent(`${people} / 100`);
  });

  it('decides the band on the rounded percent it shows (70.5 % → 71 % → amber)', () => {
    render(<OccupancyCard metrics={m({ capacity: 200, defaultCapacity: 200, confirmedPeople: 141 })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(card).toHaveAttribute('data-level', 'high');
    expect(within(card).getByText('71 %')).toBeInTheDocument();
  });

  it('clamps the meter and fills the arc when overbooked, but tells the real number', () => {
    render(<OccupancyCard metrics={m({ confirmedPeople: 120 })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    const meter = within(card).getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter).toHaveAttribute('aria-valuetext', '120 de 100 personas (120 %)');
    expect(within(card).getByTestId('occupancy-arc')).toHaveAttribute('stroke-dashoffset', '0');
    expect(within(card).getByText('Lleno')).toBeInTheDocument();
  });

  it('shows "Cerrado" and no meter on a day closed by an override (capacity 0)', () => {
    render(<OccupancyCard metrics={m({
      capacity: 0, override: { capacity: 0, reason: 'Mantenimiento' }, confirmedPeople: 0,
    })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(card).toHaveAttribute('data-level', 'closed');
    expect(within(card).getByText('Cerrado')).toBeInTheDocument();
    expect(within(card).getByText('Día cerrado por excepción · Mantenimiento')).toBeInTheDocument();
    expect(within(card).queryByRole('meter')).toBeNull();
    expect(within(card).queryByText(/con reserva este día/)).toBeNull();
  });

  it('warns about people still booked on a closed day', () => {
    render(<OccupancyCard metrics={m({
      capacity: 0, override: { capacity: 0, reason: null }, confirmedPeople: 3,
    })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(within(card).getByText('Día cerrado por excepción')).toBeInTheDocument();
    expect(within(card).getByText('3 personas con reserva este día')).toBeInTheDocument();
  });

  it('explains a closed day that comes from a default capacity of 0', () => {
    render(<OccupancyCard metrics={m({ capacity: 0, defaultCapacity: 0, override: null, confirmedPeople: 0 })} />);
    expect(screen.getByText('La capacidad diaria está en 0')).toBeInTheDocument();
  });

  it('measures against a special-capacity day and explains it', () => {
    render(<OccupancyCard metrics={m({
      capacity: 50, override: { capacity: 50, reason: 'Evento privado' }, confirmedPeople: 25,
    })} />);
    const card = screen.getByRole('region', { name: 'Ocupación' });
    expect(within(card).getByRole('meter')).toHaveAttribute('aria-valuemax', '50');
    expect(within(card).getByText('50 %')).toBeInTheDocument();
    expect(within(card).getByText('Capacidad especial (normal: 100) · Evento privado')).toBeInTheDocument();
  });
});

// Legacy grid (DaySummary) — replaced in Task 10.
const summary: DaySummary = {
  capacity: 100, confirmedPeople: 5, checkedInParties: 1, checkedInPeople: 1,
  revenueUsd: 65, revenueVes: 2390.05, paidCount: 2, pendingCount: 0,
  checkinsByHour: [],
};

describe('MetricGrid (legacy)', () => {
  it('shows occupancy, arrivals, revenue and "Todo al día" when no pending', () => {
    render(<MetricGrid summary={summary} onReviewPending={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
    expect(screen.getByText('$65.00')).toBeInTheDocument();
    expect(screen.getByText(/Todo al día/i)).toBeInTheDocument();
  });
  it('shows "Requiere atención" and a review button when pending > 0', () => {
    render(<MetricGrid summary={{ ...summary, pendingCount: 3 }} onReviewPending={() => {}} />);
    expect(screen.getByText(/Requiere atención/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar pagos/i })).toBeInTheDocument();
  });
});
