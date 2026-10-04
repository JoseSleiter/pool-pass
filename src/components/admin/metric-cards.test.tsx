// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { C2PQueueCard, CheckinsCard, MetricGrid, OccupancyCard, RevenueCard } from './metric-cards';
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

describe('CheckinsCard', () => {
  it('shows checked-in vs confirmed people, the ratio and the parties', () => {
    render(<CheckinsCard metrics={m({ confirmedPeople: 8, checkedInPeople: 4, checkedInParties: 2 })} />);
    const card = screen.getByRole('region', { name: 'Check-ins' });
    expect(card).toHaveTextContent('4 / 8 personas');
    expect(card).toHaveTextContent('50 % ya ingresó · 2 grupos');
  });

  it('uses 0 % and singular wording without dividing by zero', () => {
    render(<CheckinsCard metrics={m({ confirmedPeople: 0, checkedInPeople: 0, checkedInParties: 1 })} />);
    expect(screen.getByRole('region', { name: 'Check-ins' })).toHaveTextContent('0 % ya ingresó · 1 grupo');
  });

  it('shows an empty state instead of a chart when nobody has checked in', () => {
    render(<CheckinsCard metrics={m({ checkinsByHour: [] })} />);
    const card = screen.getByRole('region', { name: 'Check-ins' });
    expect(within(card).getByText('Aún no hay ingresos registrados.')).toBeInTheDocument();
    expect(within(card).queryByRole('list')).toBeNull();
  });

  it('draws one bar per hour (gaps filled), scaled to the busiest hour, with text for screen readers', () => {
    render(<CheckinsCard metrics={m({
      checkinsByHour: [{ hour: 9, people: 3 }, { hour: 11, people: 5 }],
    })} />);
    const card = screen.getByRole('region', { name: 'Check-ins' });
    const list = within(card).getByRole('list', { name: 'Ingresos por hora (hora de Caracas)' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('09:00: 3 personas')).toBeInTheDocument();
    expect(within(items[1]).getByText('10:00: 0 personas')).toBeInTheDocument();
    expect(within(items[2]).getByText('11:00: 5 personas')).toBeInTheDocument();
    expect(within(items[0]).getByTestId('hour-bar')).toHaveStyle({ height: '60%' });
    expect(within(items[2]).getByTestId('hour-bar')).toHaveStyle({ height: '100%' });
    expect(within(card).getByText('Hora pico: 11:00 (5 personas)')).toBeInTheDocument();
  });

  it('uses singular wording for a single person in an hour', () => {
    render(<CheckinsCard metrics={m({ checkinsByHour: [{ hour: 14, people: 1 }] })} />);
    expect(screen.getByText('14:00: 1 persona')).toBeInTheDocument();
    expect(screen.getByText('Hora pico: 14:00 (1 persona)')).toBeInTheDocument();
  });
});

describe('RevenueCard', () => {
  it('shows collected USD as primary and Bs. as secondary', () => {
    render(<RevenueCard metrics={m()} />);
    const card = screen.getByRole('region', { name: 'Ingresos' });
    expect(within(card).getByTestId('revenue-usd')).toHaveTextContent('$65.00');
    expect(within(card).getByText('Bs. 2390.05')).toBeInTheDocument();
  });

  it('splits the money by payment status', () => {
    render(<RevenueCard metrics={m({ pending: { usd: 30, count: 1 } })} />);
    const card = screen.getByRole('region', { name: 'Ingresos' });
    expect(within(card).getByText('Cobrado · 2 reservas').parentElement).toHaveTextContent('$65.00');
    expect(within(card).getByText('Por verificar · 1 pago').parentElement).toHaveTextContent('$30.00');
    expect(within(card).getByText('El monto en Bs. de los pagos por verificar se fija al confirmarlos.')).toBeInTheDocument();
  });

  it('shows $0.00 pending and no Bs. note when nothing awaits verification', () => {
    render(<RevenueCard metrics={m({ collected: { usd: 10, ves: 1234.5, count: 1 } })} />);
    const card = screen.getByRole('region', { name: 'Ingresos' });
    expect(within(card).getByText('Bs. 1234.50')).toBeInTheDocument();
    expect(within(card).getByText('Cobrado · 1 reserva').parentElement).toHaveTextContent('$10.00');
    expect(within(card).getByText('Por verificar · 0 pagos').parentElement).toHaveTextContent('$0.00');
    expect(within(card).queryByText(/se fija al confirmarlos/)).toBeNull();
  });
});

describe('C2PQueueCard', () => {
  it('is calm with "Todo al día" and no action when nothing is pending', () => {
    render(<C2PQueueCard metrics={m()} onReviewPending={() => {}} />);
    const card = screen.getByRole('region', { name: 'Cola C2P' });
    expect(card).not.toHaveClass('bg-amber-50');
    expect(within(card).getByText('Todo al día')).toBeInTheDocument();
    expect(within(card).queryByRole('button')).toBeNull();
    expect(within(card).queryByTestId('c2p-pulse')).toBeNull();
  });

  it('turns amber with a motion-safe pulsing badge and the amount waiting', () => {
    render(<C2PQueueCard metrics={m({ pending: { usd: 45, count: 3 } })} onReviewPending={() => {}} />);
    const card = screen.getByRole('region', { name: 'Cola C2P' });
    expect(card).toHaveClass('bg-amber-50');
    expect(card).toHaveTextContent('3 pagos por verificar');
    expect(within(card).getByText('$45.00 en espera de conciliación bancaria')).toBeInTheDocument();
    const ping = within(card).getByTestId('c2p-pulse').firstElementChild;
    expect(ping).toHaveClass('motion-safe:animate-ping');
    expect(ping).not.toHaveClass('animate-ping');
  });

  it('uses singular wording for one pending payment', () => {
    render(<C2PQueueCard metrics={m({ pending: { usd: 10, count: 1 } })} onReviewPending={() => {}} />);
    expect(screen.getByRole('region', { name: 'Cola C2P' })).toHaveTextContent('1 pago por verificar');
  });

  it('"Revisar C2P pendientes" is a 44px button that calls onReviewPending', async () => {
    const onReview = vi.fn();
    render(<C2PQueueCard metrics={m({ pending: { usd: 45, count: 3 } })} onReviewPending={onReview} />);
    const button = screen.getByRole('button', { name: 'Revisar C2P pendientes' });
    expect(button).toHaveClass('h-11');
    await userEvent.click(button);
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});

describe('MetricGrid', () => {
  it('renders the four KPI cards in operating order', () => {
    render(<MetricGrid metrics={m()} onReviewPending={() => {}} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Ocupación', 'Check-ins', 'Ingresos', 'Cola C2P',
    ]);
  });

  it('wires "Revisar C2P pendientes" to onReviewPending', async () => {
    const onReview = vi.fn();
    render(<MetricGrid metrics={m({ pending: { usd: 20, count: 2 } })} onReviewPending={onReview} />);
    await userEvent.click(screen.getByRole('button', { name: 'Revisar C2P pendientes' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});
