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

// base-ui's Select positioner sets inline pointer-events:none while inert
// during open/close transitions, which never settles in jsdom (no real layout
// pass). Disable
// user-event's pointer-events guard so clicks on those items aren't flagged
// as "not clickable" — the click itself is still a real, valid interaction.
const user = userEvent.setup({ pointerEventsCheck: 0 });

async function fillDetailsAndContinue() {
  await user.type(screen.getByLabelText(/nombre/i), 'Ana');
  await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
  await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
  await user.click(screen.getByRole('button', { name: /continuar/i }));
}

async function fillPaymentAndPay() {
  await user.type(screen.getByLabelText(/número de documento/i), '12345678');
  await user.type(screen.getByLabelText(/teléfono/i), '04141234567');
  await user.click(document.getElementById('bank')!);
  await user.click(await screen.findByText(/0102 — Banco de Venezuela/));
  await user.type(screen.getByLabelText(/clave de pago/i), '123456');
  await user.click(screen.getByRole('button', { name: /pagar/i }));
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

  it('shows the ticket-style confirmation with QR and WhatsApp link after a successful payment', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({
      ok: true,
      reservation: {
        id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
        code: 'ABC123',
        totalUsd: 15,
        totalVes: 547.5,
        bcvRate: 36.5,
      },
    });
    render(<BookingWizard prices={prices} initialAvailability={{}} />);
    await fillDetailsAndContinue();
    await fillPaymentAndPay();

    expect(await screen.findByTestId('reservation-code')).toHaveTextContent('ABC123');
    expect(screen.getByAltText(/código qr/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
  });
});
