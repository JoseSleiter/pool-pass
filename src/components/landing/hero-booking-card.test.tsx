// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroBookingCard } from './hero-booking-card';
import { renderWithI18n } from '@/test/i18n';
import { todayCaracas } from '@/lib/dates';

vi.mock('@/app/actions/booking', () => ({
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => 36.5),
}));

import { getCurrentRate } from '@/app/actions/booking';

const props = { prices: { adult: 15, child: 5 }, dailyCapacity: 100, initialAvailability: {} };
const user = userEvent.setup();

function cta(name: RegExp = /reservar mi pase ahora/i) {
  return screen.getByRole('link', { name });
}

describe('HeroBookingCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('summary: date with slots, party, total in USD and Bs., coral CTA to /reservar', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(screen.getByRole('heading', { name: 'Reserva tu pase' })).toBeInTheDocument();
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Quedan 100 cupos');
    expect(screen.getByTestId('hero-step-guests')).toHaveTextContent('2 adultos, 1 niño');
    expect(screen.getByTestId('hero-total-usd')).toHaveTextContent('$35 USD');
    expect(await screen.findByText('Bs. 1277.50 · tasa 36.50')).toBeInTheDocument();
    expect(cta()).toHaveAttribute(
      'href',
      `/reservar?date=${todayCaracas()}&adults=2&children=1&pay=1`
    );
  });

  it('renders in English', async () => {
    renderWithI18n(<HeroBookingCard {...props} />, { locale: 'en' });
    expect(screen.getByRole('heading', { name: 'Book your pass' })).toBeInTheDocument();
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('100 spots left');
    expect(screen.getByTestId('hero-step-guests')).toHaveTextContent('2 adults, 1 child');
    expect(await screen.findByText('Bs. 1277.50 · rate 36.50')).toBeInTheDocument();
    expect(cta(/book my pass now/i)).toBeInTheDocument();
  });

  it('uses the day\'s computed remaining slots and flags a sold-out day', () => {
    const today = todayCaracas();
    const { unmount } = renderWithI18n(
      <HeroBookingCard {...props} initialAvailability={{ [today]: 12 }} />
    );
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Quedan 12 cupos');
    unmount();
    renderWithI18n(<HeroBookingCard {...props} initialAvailability={{ [today]: 0 }} />);
    expect(screen.getByTestId('hero-step-date')).toHaveTextContent('Sin cupos para esta fecha');
  });

  it('degrades gracefully when the BCV rate is unavailable', async () => {
    vi.mocked(getCurrentRate).mockResolvedValueOnce(null);
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(await screen.findByText('Verás el monto en Bs. al pagar')).toBeInTheDocument();
    expect(screen.getByTestId('hero-total-usd')).toHaveTextContent('$35 USD');
  });

  it('degrades gracefully when fetching the rate fails', async () => {
    vi.mocked(getCurrentRate).mockRejectedValueOnce(new Error('bcv down'));
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(await screen.findByText('Verás el monto en Bs. al pagar')).toBeInTheDocument();
  });

  it('walks the 3 steps: date → guests → total', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-date'));
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Cuándo vienes?' })).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument(); // the calendar

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Quiénes van?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver total' }));
    expect(screen.getByTestId('hero-total-usd')).toBeInTheDocument();
    // The CTA is reachable at every step.
    expect(cta()).toBeInTheDocument();
  });

  it('never lets the party drop below 1 person', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-guests'));
    await user.click(screen.getByRole('button', { name: 'Disminuir niños' }));
    await user.click(screen.getByRole('button', { name: 'Disminuir adultos' }));
    expect(screen.getByTestId('hero-adults-count')).toHaveTextContent('1');
    expect(screen.getByTestId('hero-children-count')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Disminuir adultos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disminuir niños' })).toBeDisabled();
    expect(cta()).toHaveAttribute('href', expect.stringContaining('&adults=1&children=0&pay=1'));
  });

  it('follows the schema: up to 20 adults and 20 children, independently', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-guests'));
    expect(screen.getByText('Hasta 20 adultos y 20 niños, mínimo 1 persona')).toBeInTheDocument();
    const addAdult = screen.getByRole('button', { name: 'Aumentar adultos' });
    const addChild = screen.getByRole('button', { name: 'Aumentar niños' });
    for (let i = 0; i < 18; i++) await user.click(addAdult); // 20 adults
    for (let i = 0; i < 19; i++) await user.click(addChild); // 20 children
    expect(screen.getByTestId('hero-adults-count')).toHaveTextContent('20');
    expect(screen.getByTestId('hero-children-count')).toHaveTextContent('20');
    expect(addAdult).toBeDisabled();
    expect(addChild).toBeDisabled();
    expect(cta()).toHaveAttribute('href', expect.stringContaining('&adults=20&children=20&pay=1'));
  });

  it('shows User / Baby icons on the guest rows', async () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    await user.click(screen.getByTestId('hero-step-guests'));
    const adultsRow = screen.getByText('Adultos').closest('div.rounded-xl') as HTMLElement;
    const kidsRow = screen.getByText('Niños').closest('div.rounded-xl') as HTMLElement;
    expect(within(adultsRow).getByTestId('icon-adult')).toBeInTheDocument();
    expect(within(kidsRow).getByTestId('icon-child')).toBeInTheDocument();
  });

  it('CTA scales on hover/press only when motion is allowed', () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    const cls = cta().className;
    expect(cls).toMatch(/motion-safe:hover:scale-\[1\.02\]/);
    expect(cls).toMatch(/motion-safe:active:scale-\[0\.98\]/);
    expect(cls).not.toMatch(/(^|\s)hover:scale-/);
  });
});
