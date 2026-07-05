// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepPayment } from './step-payment';

const booking = {
  date: '2030-01-15', adults: 2, children: 1,
  firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
};

describe('StepPayment', () => {
  it('shows the USD total for the booking', () => {
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error={null} />);
    expect(screen.getByTestId('pay-total-usd')).toHaveTextContent('$35.00');
  });

  it('blocks submission with an invalid phone and shows the message', async () => {
    const onSubmit = vi.fn();
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={onSubmit} submitting={false} error={null} />);
    await userEvent.type(screen.getByLabelText(/número de documento/i), '12345678');
    await userEvent.type(screen.getByLabelText(/teléfono/i), '123');
    await userEvent.type(screen.getByLabelText(/clave de pago/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /pagar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/teléfono venezolano inválido/i)).toBeInTheDocument();
  });

  it('renders a server error when given', () => {
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error="Clave inválida" />);
    expect(screen.getByText('Clave inválida')).toBeInTheDocument();
  });

  it('disables the pay button while submitting (double-submit guard)', () => {
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={true} error={null} />);
    expect(screen.getByRole('button', { name: /procesando/i })).toBeDisabled();
  });
});
