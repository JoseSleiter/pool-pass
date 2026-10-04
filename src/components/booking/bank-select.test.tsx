// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { BankSelect } from './bank-select';

function Harness() {
  const [value, setValue] = useState('');
  return <BankSelect value={value} onChange={setValue} />;
}

describe('BankSelect', () => {
  it('shows an empty chip until a bank is chosen, then its code', async () => {
    renderWithI18n(<Harness />);
    expect(screen.getByTestId('bank-chip')).toHaveTextContent('····');
    await userEvent.selectOptions(screen.getByLabelText(/^banco$/i), '0105');
    expect(screen.getByTestId('bank-chip')).toHaveTextContent('0105');
    expect(screen.getByRole('option', { name: 'Banco Mercantil' })).toHaveProperty('selected', true);
  });

  it('uses no third-party logos (roadmap §2: code chip instead of bank images)', () => {
    const { container } = renderWithI18n(<Harness />);
    expect(container.querySelector('img, svg image')).toBeNull();
  });

  it('shows the validation error', () => {
    renderWithI18n(<BankSelect value="" onChange={() => {}} error="Banco requerido" />);
    expect(screen.getByText('Banco requerido')).toBeInTheDocument();
  });
});
