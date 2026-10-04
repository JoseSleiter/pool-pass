// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodayBadge, WeekendChip } from './hero-signals';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('TodayBadge', () => {
  it('open: "Piscina abierta" with a pulsing dot and the remaining count', () => {
    const { container } = render(<TodayBadge t={es} remaining={80} capacity={100} />);
    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-state', 'open');
    expect(badge).toHaveTextContent('Piscina abierta');
    expect(badge).toHaveTextContent('Quedan 80 cupos hoy');
    expect(container.querySelector('[data-pulse]')).not.toBeNull();
  });

  it('pulses only under prefers-reduced-motion: no-preference', () => {
    const { container } = render(<TodayBadge t={es} remaining={80} capacity={100} />);
    expect(container.querySelector('[data-pulse]')?.className).toMatch(/motion-safe:animate-ping/);
  });

  it('low: "Últimos cupos" below 20 % of today\'s capacity, without the pulse', () => {
    const { container } = render(<TodayBadge t={es} remaining={19} capacity={100} />);
    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-state', 'low');
    expect(badge).toHaveTextContent('Últimos cupos');
    expect(badge).toHaveTextContent('Quedan 19 cupos hoy');
    expect(container.querySelector('[data-pulse]')).toBeNull();
  });

  it('exactly 20 % is still open', () => {
    render(<TodayBadge t={es} remaining={20} capacity={100} />);
    expect(screen.getByTestId('today-badge')).toHaveAttribute('data-state', 'open');
  });

  it('soldOut: "Agotado hoy" and no count', () => {
    render(<TodayBadge t={es} remaining={0} capacity={100} />);
    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-state', 'soldOut');
    expect(badge).toHaveTextContent('Agotado hoy');
    expect(badge).not.toHaveTextContent(/Quedan/);
  });

  it('a closed day (capacity 0) is sold out', () => {
    render(<TodayBadge t={es} remaining={0} capacity={0} />);
    expect(screen.getByTestId('today-badge')).toHaveAttribute('data-state', 'soldOut');
  });

  it('speaks English', () => {
    render(<TodayBadge t={en} remaining={10} capacity={100} />);
    expect(screen.getByTestId('today-badge')).toHaveTextContent('Last spots left');
    expect(screen.getByTestId('today-badge')).toHaveTextContent('10 spots left today');
  });
});

describe('WeekendChip', () => {
  it('shows the real weekend count', () => {
    render(<WeekendChip t={es} people={24} />);
    expect(screen.getByText('🔥 24 personas ya reservaron para este fin de semana')).toBeInTheDocument();
  });

  it('renders nothing when there is no real number (null)', () => {
    const { container } = render(<WeekendChip t={es} people={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('speaks English', () => {
    render(<WeekendChip t={en} people={12} />);
    expect(screen.getByText('🔥 12 people already booked for this weekend')).toBeInTheDocument();
  });
});
