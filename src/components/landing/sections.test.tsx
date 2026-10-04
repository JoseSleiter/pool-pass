// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Features, HowItWorks, FinalCta } from './sections';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('landing sections', () => {
  it('render the Spanish copy', () => {
    render(<><Features t={es} /><HowItWorks t={es} /><FinalCta t={es} /></>);
    expect(screen.getByRole('heading', { name: /todo lo que necesitas/i })).toBeInTheDocument();
    expect(screen.getByText('Reserva en minutos')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Recibe tu voucher')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reservar mi pase/i })).toHaveAttribute('href', '/reservar');
  });

  it('render the English copy', () => {
    render(<><Features t={en} /><HowItWorks t={en} /><FinalCta t={en} /></>);
    expect(screen.getByRole('heading', { name: /everything you need/i })).toBeInTheDocument();
    expect(screen.getByText('How your booking works')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /book my pass/i })).toBeInTheDocument();
  });
});
