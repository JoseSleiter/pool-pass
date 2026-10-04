// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Hero } from './hero';
import { renderWithI18n } from '@/test/i18n';
import { es } from '@/lib/i18n/es';

vi.mock('@/app/actions/booking', () => ({
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => null),
}));

const base = {
  t: es,
  today: { remaining: 80, capacity: 100, dailyCapacity: 100 },
  weekendPeople: null as number | null,
  prices: { adult: 15, child: 5 },
  initialAvailability: {},
};

describe('Hero', () => {
  it('keeps the headline and prices', () => {
    renderWithI18n(<Hero {...base} />);
    expect(screen.getByRole('heading', { level: 1, name: /disfruta el agua/i })).toBeInTheDocument();
    expect(screen.getByText(/adultos desde/i)).toHaveTextContent('$15');
  });

  it("wires today's numbers into the live badge", () => {
    renderWithI18n(<Hero {...base} today={{ remaining: 15, capacity: 100, dailyCapacity: 100 }} />);
    expect(screen.getByTestId('today-badge')).toHaveAttribute('data-state', 'low');
  });

  it('hides the social proof chip without a real number', () => {
    renderWithI18n(<Hero {...base} />);
    expect(screen.queryByTestId('weekend-chip')).toBeNull();
  });

  it('shows the social proof chip with the real weekend count', () => {
    renderWithI18n(<Hero {...base} weekendPeople={24} />);
    expect(screen.getByTestId('weekend-chip')).toHaveTextContent(
      '🔥 24 personas ya reservaron para este fin de semana'
    );
  });

  it('passes the default capacity to the booking card', () => {
    renderWithI18n(<Hero {...base} today={{ remaining: 80, capacity: 100, dailyCapacity: 60 }} />);
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Quedan 60 cupos');
  });
});
