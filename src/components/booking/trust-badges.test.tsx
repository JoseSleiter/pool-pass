// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithI18n } from '@/test/i18n';
import { TrustBadges } from './trust-badges';

describe('TrustBadges', () => {
  it('lists the two factual badges in Spanish', () => {
    renderWithI18n(<TrustBadges />);
    const list = screen.getByRole('list', { name: 'Seguridad del pago' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Pago Móvil C2P · Banco Mercantil',
      'Datos de pago cifrados (AES-256)',
    ]);
  });

  it('translates to English', () => {
    renderWithI18n(<TrustBadges />, { locale: 'en' });
    expect(screen.getByText('Pago Móvil C2P via Banco Mercantil')).toBeInTheDocument();
    expect(screen.getByText('Payment data encrypted (AES-256)')).toBeInTheDocument();
  });
});
