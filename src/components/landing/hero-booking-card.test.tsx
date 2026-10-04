// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { HeroBookingCard } from './hero-booking-card';
import { renderWithI18n } from '@/test/i18n';

vi.mock('@/app/actions/booking', () => ({ getAvailability: vi.fn(async () => ({})) }));

const props = { prices: { adult: 15, child: 5 }, remaining: 12, initialAvailability: {} };

describe('HeroBookingCard', () => {
  it('keeps the Spanish copy', () => {
    renderWithI18n(<HeroBookingCard {...props} />);
    expect(screen.getByRole('heading', { name: 'Reserva tu pase' })).toBeInTheDocument();
    expect(screen.getByText('12 cupos disponibles hoy')).toBeInTheDocument();
    expect(screen.getByText('2 adultos, 1 niño')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continuar/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/reservar?date=')
    );
  });

  it('renders in English', () => {
    renderWithI18n(<HeroBookingCard {...props} />, { locale: 'en' });
    expect(screen.getByRole('heading', { name: 'Book your pass' })).toBeInTheDocument();
    expect(screen.getByText('Spots left today: 12')).toBeInTheDocument();
    expect(screen.getByText('2 adults, 1 child')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue/i })).toBeInTheDocument();
  });
});
