// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingCard } from './booking-card';

vi.mock('@/app/actions/booking', () => ({
  submitBookingAndPay: vi.fn(),
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => 36.5),
}));

import { submitBookingAndPay } from '@/app/actions/booking';

const prices = { adult: 15, child: 5 };
const user = userEvent.setup();

function renderCard() {
  return render(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />);
}

async function goToPay() {
  await user.click(screen.getByRole('button', { name: /continuar/i }));
}

async function fillPaymentAndConfirm() {
  await user.type(screen.getByLabelText(/^nombre$/i), 'Ana');
  await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
  await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
  await user.type(screen.getByLabelText(/número de documento/i), '12345678');
  await user.type(screen.getByLabelText(/teléfono/i), '04141234567');
  await user.selectOptions(screen.getByLabelText(/banco/i), '0102');
  await user.type(screen.getByLabelText(/clave de pago/i), '123456');
  await user.click(screen.getByRole('button', { name: /confirmar y pagar/i }));
}

describe('BookingCard', () => {
  beforeEach(() => {
    vi.mocked(submitBookingAndPay).mockReset();
  });

  it('shows the default party total in the summary (2 adultos · 1 niño = $35)', () => {
    renderCard();
    expect(screen.getByTestId('total-usd')).toHaveTextContent('$35 USD');
  });

  it('recalculates the total when adjusting the people stepper', async () => {
    renderCard();
    await user.click(screen.getByRole('button', { name: /personas/i }));
    await user.click(screen.getByRole('button', { name: /aumentar adultos/i })); // 3 adultos · 1 niño
    await user.click(screen.getByRole('button', { name: /listo/i }));
    expect(screen.getByTestId('total-usd')).toHaveTextContent('$50 USD'); // 3*15 + 5
  });

  it('shows the estimated VES total on the payment step (rate fetched on transition)', async () => {
    renderCard();
    await goToPay();
    // $35 at rate 36.5 → Bs. 1277.50
    expect(await screen.findByText(/Bs\. 1277\.50/)).toBeInTheDocument();
    expect(screen.getByText(/tasa 36\.50/)).toBeInTheDocument();
  });

  it('blocks payment with an invalid phone and shows the message', async () => {
    renderCard();
    await goToPay();
    await user.type(screen.getByLabelText(/^nombre$/i), 'Ana');
    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/número de documento/i), '12345678');
    await user.type(screen.getByLabelText(/teléfono/i), '123');
    await user.selectOptions(screen.getByLabelText(/banco/i), '0102');
    await user.type(screen.getByLabelText(/clave de pago/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirmar y pagar/i }));
    expect(submitBookingAndPay).not.toHaveBeenCalled();
    expect(await screen.findByText(/teléfono venezolano inválido/i)).toBeInTheDocument();
  });

  it('locks the form on payment_pending: verification screen, no pay button', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({
      ok: false,
      error: 'payment_pending',
      message: 'Tu pago está siendo verificado. Te contactaremos con la confirmación.',
    });
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByText(/pago en verificación/i)).toBeInTheDocument();
    expect(screen.getByText(/no intentes pagar de nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar y pagar/i })).not.toBeInTheDocument();
  });

  it('shows the ticket-style confirmation with pass code, QR and WhatsApp link after payment', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({
      ok: true,
      reservation: {
        id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
        code: 'PP-ABC12',
        totalUsd: 35,
        totalVes: 1277.5,
        bcvRate: 36.5,
      },
    });
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByTestId('reservation-code')).toHaveTextContent('PP-ABC12');
    expect(screen.getByAltText(/código qr/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
  });
});
