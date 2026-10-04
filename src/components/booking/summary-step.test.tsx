// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { SummaryStep } from './summary-step';

const prices = { adult: 15, child: 5 };

describe('SummaryStep', () => {
  it('breaks the total down per ticket type, with BCV rate and final VES amount', () => {
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={36.5} onContinue={() => {}} />);
    const breakdown = screen.getByTestId('price-breakdown');
    expect(within(breakdown).getByText('Adultos × 2 · $15.00 c/u')).toBeInTheDocument();
    expect(within(breakdown).getByText('$30.00')).toBeInTheDocument();
    expect(within(breakdown).getByText('Niños × 1 · $5.00 c/u')).toBeInTheDocument();
    expect(within(breakdown).getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByTestId('breakdown-total-usd')).toHaveTextContent('$35.00 USD');
    expect(screen.getByTestId('breakdown-rate')).toHaveTextContent('Bs. 36.50 / $');
    expect(screen.getByTestId('breakdown-total-ves')).toHaveTextContent('Bs. 1277.50');
  });

  it('omits ticket types with zero people', () => {
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 3, children: 0 }} rate={36.5} onContinue={() => {}} />);
    expect(screen.queryByText(/Niños ×/)).not.toBeInTheDocument();
    expect(screen.getByTestId('breakdown-total-usd')).toHaveTextContent('$45.00 USD');
  });

  it('without a rate yet, explains the VES amount instead of inventing one', () => {
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={null} onContinue={() => {}} />);
    expect(screen.queryByTestId('breakdown-total-ves')).not.toBeInTheDocument();
    expect(screen.getByText(/se calcula con la tasa BCV del día/i)).toBeInTheDocument();
  });

  it('renders in English', () => {
    renderWithI18n(
      <SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={36.5} onContinue={() => {}} />,
      { locale: 'en' }
    );
    expect(screen.getByText('Adults × 2 · $15.00 each')).toBeInTheDocument();
    expect(screen.getByText('Total to pay in bolívares')).toBeInTheDocument();
  });

  it('calls onContinue from the Continuar button', async () => {
    const onContinue = vi.fn();
    renderWithI18n(<SummaryStep prices={prices} party={{ adults: 2, children: 1 }} rate={null} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
