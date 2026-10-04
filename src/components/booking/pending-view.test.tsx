// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test/i18n';
import { PendingView } from './pending-view';

describe('PendingView', () => {
  it('tells the guest the payment is being verified and not to retry', () => {
    renderWithI18n(<PendingView />);
    expect(screen.getByRole('heading', { name: /pago en verificación/i })).toBeInTheDocument();
    expect(screen.getByText(/tu pago está siendo verificado/i)).toBeInTheDocument();
    expect(screen.getByText(/no intentes pagar de nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders in English', () => {
    renderWithI18n(<PendingView />, { locale: 'en' });
    expect(screen.getByRole('heading', { name: /payment being verified/i })).toBeInTheDocument();
  });
});
