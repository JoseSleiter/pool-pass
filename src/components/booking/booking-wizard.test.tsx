// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingWizard } from './booking-wizard';

vi.mock('@/app/actions/booking', () => ({
  submitBookingAndPay: vi.fn(),
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => 36.5),
}));

import { submitBookingAndPay } from '@/app/actions/booking';

const prices = { adult: 15, child: 5 };

async function fillDetailsAndContinue() {
  await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana');
  await userEvent.type(screen.getByLabelText(/apellido/i), 'Pérez');
  await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
  await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

async function fillPaymentAndPay() {
  await userEvent.type(screen.getByLabelText(/número de documento/i), '12345678');
  await userEvent.type(screen.getByLabelText(/teléfono/i), '04141234567');
  await userEvent.click(document.getElementById('bank')!);
  await userEvent.click(await screen.findByText(/0102 — Banco de Venezuela/));
  await userEvent.type(screen.getByLabelText(/clave de pago/i), '123456');
  await userEvent.click(screen.getByRole('button', { name: /pagar/i }));
}

describe('BookingWizard', () => {
  beforeEach(() => {
    vi.mocked(submitBookingAndPay).mockReset();
  });

  it('locks the form on payment_pending: terminal screen, no Pagar button', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({
      ok: false,
      error: 'payment_pending',
      message: 'Tu pago está siendo verificado. Te contactaremos con la confirmación.',
    });
    render(<BookingWizard prices={prices} initialAvailability={{}} />);
    await fillDetailsAndContinue();
    await fillPaymentAndPay();

    expect(await screen.findByText(/pago en verificación/i)).toBeInTheDocument();
    expect(screen.getByText(/no intentes pagar de nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument();
  });

  it('shows the estimated VES total on the payment step (rate fetched on transition)', async () => {
    render(<BookingWizard prices={prices} initialAvailability={{}} />);
    await fillDetailsAndContinue();
    // 1 adult × $15 at rate 36.5 → Bs. 547.50
    expect(await screen.findByText(/Bs\. 547\.50/)).toBeInTheDocument();
    expect(screen.getByText(/tasa BCV 36\.50/)).toBeInTheDocument();
  });

  it('shows the step progress label', () => {
    // freshly rendered wizard starts at step 1
    render(<BookingWizard prices={prices} initialAvailability={{}} />);
    expect(screen.getByText(/paso 1 de 2/i)).toBeInTheDocument();
  });
});
