// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { PayForm, EMPTY_PAY_FORM, type PayFormErrors, type PayFormValues } from './pay-form';

function Harness(props: { onSubmit?: (v: PayFormValues) => void; errors?: PayFormErrors; submitting?: boolean }) {
  const [values, setValues] = useState<PayFormValues>(EMPTY_PAY_FORM);
  return (
    <PayForm
      values={values}
      onChange={(key, value) => setValues((f) => ({ ...f, [key]: value }))}
      errors={props.errors ?? {}}
      submitting={props.submitting ?? false}
      onSubmit={() => props.onSubmit?.(values)}
    />
  );
}

describe('PayForm', () => {
  it('formats the phone while typing but keeps the digits-only value', async () => {
    const onSubmit = vi.fn();
    renderWithI18n(<Harness onSubmit={onSubmit} />);
    const phone = screen.getByLabelText(/teléfono/i);
    await userEvent.type(phone, '04141234567');
    expect(phone).toHaveValue('0414-123-4567');
    await userEvent.click(screen.getByRole('button', { name: /confirmar y pagar/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ phone: '04141234567' }));
  });

  it('normalizes a pasted international number', async () => {
    renderWithI18n(<Harness />);
    const phone = screen.getByLabelText(/teléfono/i);
    await userEvent.click(phone);
    await userEvent.paste('+58 424 555 1234');
    expect(phone).toHaveValue('0424-555-1234');
  });

  it('lists the accepted operators as the phone hint', () => {
    renderWithI18n(<Harness />);
    expect(screen.getByLabelText(/teléfono/i)).toHaveAccessibleDescription(
      'Operadoras: 0412, 0414, 0416, 0422, 0424, 0426'
    );
  });

  it('keeps the honeypot off-screen and out of the tab order', () => {
    renderWithI18n(<Harness />);
    const honeypot = screen.getByLabelText(/no llenar este campo/i);
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows translated validation messages from error keys', () => {
    renderWithI18n(<Harness errors={{ phone: 'invalidPhone', bankCode: 'bankRequired', otp: 'pinRequired' }} />);
    expect(screen.getByText('Teléfono venezolano inválido (04XX...)')).toBeInTheDocument();
    expect(screen.getByText('Banco requerido')).toBeInTheDocument();
    expect(screen.getByText('Clave requerida')).toBeInTheDocument();
  });

  it('shows the trust badges and the masked C2P key with its toggle', () => {
    renderWithI18n(<Harness />);
    expect(screen.getByRole('list', { name: 'Seguridad del pago' })).toBeInTheDocument();
    expect(screen.getByLabelText(/clave de pago/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar clave' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables the pay button while submitting', () => {
    renderWithI18n(<Harness submitting />);
    expect(screen.getByRole('button', { name: /procesando/i })).toBeDisabled();
  });
});
