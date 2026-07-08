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
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error={null} onEdit={vi.fn()} />);
    expect(screen.getByTestId('pay-total-usd')).toHaveTextContent('$35.00');
  });

  it('blocks submission with an invalid phone and shows the message', async () => {
    const onSubmit = vi.fn();
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={onSubmit} submitting={false} error={null} onEdit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/número de documento/i), '12345678');
    await userEvent.type(screen.getByLabelText(/teléfono/i), '123');
    await userEvent.type(screen.getByLabelText(/clave de pago/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /pagar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/teléfono venezolano inválido/i)).toBeInTheDocument();
  });

  it('renders a server error when given', () => {
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error="Clave inválida" onEdit={vi.fn()} />);
    expect(screen.getByText('Clave inválida')).toBeInTheDocument();
  });

  it('disables the pay button while submitting (double-submit guard)', () => {
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={true} error={null} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /procesando/i })).toBeDisabled();
  });

  it('shows the estimated VES total and BCV rate when vesInfo is given', () => {
    render(
      <StepPayment booking={booking} totalUsd={35} vesInfo={{ rate: 36.5, totalVes: 1277.5 }}
        onSubmit={vi.fn()} submitting={false} error={null} onEdit={vi.fn()} />
    );
    expect(screen.getByText(/Bs\. 1277\.50/)).toBeInTheDocument();
    expect(screen.getByText(/tasa BCV 36\.50/)).toBeInTheDocument();
  });

  it('clears stale field errors once a corrected form submits successfully', async () => {
    const onSubmit = vi.fn();
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={onSubmit} submitting={false} error={null} onEdit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/número de documento/i), '12345678');
    await userEvent.type(screen.getByLabelText(/teléfono/i), '123');
    await userEvent.type(screen.getByLabelText(/clave de pago/i), '123456');
    await userEvent.click(document.getElementById('bank')!);
    await userEvent.click(await screen.findByText(/0102 — Banco de Venezuela/));
    await userEvent.click(screen.getByRole('button', { name: /pagar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/teléfono venezolano inválido/i)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.type(screen.getByLabelText(/teléfono/i), '04141234567');
    await userEvent.click(screen.getByRole('button', { name: /pagar/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/teléfono venezolano inválido/i)).not.toBeInTheDocument();
  });

  it('clears the entered OTP when a server error arrives (declined charge)', async () => {
    const { rerender } = render(
      <StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error={null} onEdit={vi.fn()} />
    );
    const otp = screen.getByLabelText(/clave de pago/i);
    await userEvent.type(otp, '123456');
    expect(otp).toHaveValue('123456');
    rerender(
      <StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error="Clave inválida" onEdit={vi.fn()} />
    );
    expect(screen.getByLabelText(/clave de pago/i)).toHaveValue('');
  });

  it('shows the amount on the pay button', () => {
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error={null} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /pagar \$35\.00/i })).toBeInTheDocument();
  });

  it('editar returns to the details step', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<StepPayment booking={booking} totalUsd={35} onSubmit={vi.fn()} submitting={false} error={null} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalled();
  });
});
