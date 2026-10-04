// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { BookingCard } from './booking-card';

vi.mock('@/app/actions/booking', () => ({
  submitBookingAndPay: vi.fn(),
  getAvailability: vi.fn(async () => ({})),
  getCurrentRate: vi.fn(async () => 36.5),
}));

import { submitBookingAndPay, getCurrentRate } from '@/app/actions/booking';

const prices = { adult: 15, child: 5 };
const user = userEvent.setup();

const confirmed = {
  ok: true as const,
  reservation: {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    code: 'PP-ABC12',
    totalUsd: 35,
    totalVes: 1277.5,
    bcvRate: 36.5,
  },
};

function renderCard() {
  return renderWithI18n(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />);
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
    vi.mocked(getCurrentRate).mockClear();
  });

  it('labels untouched calendar days with the daily capacity ("Quedan N")', async () => {
    const { container } = renderWithI18n(
      <BookingCard
        prices={prices}
        initialAvailability={{ '2099-03-12': 7 }}
        remaining={40}
        dailyCapacity={100}
        initialDate="2099-03-10"
      />
    );
    await user.click(screen.getByRole('button', { name: /fecha de visita/i }));
    const day = (d: string) => container.querySelector(`td[data-day="${d}"]:not([data-outside])`);
    expect(day('2099-03-12')).toHaveTextContent('Quedan 7');
    expect(day('2099-03-14')).toHaveTextContent('Quedan 100');
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

  it('shows the price breakdown with the BCV rate and the VES total on the summary', async () => {
    renderCard();
    expect(await screen.findByTestId('breakdown-total-ves')).toHaveTextContent('Bs. 1277.50');
    expect(screen.getByTestId('breakdown-rate')).toHaveTextContent('Bs. 36.50 / $');
    expect(screen.getByTestId('breakdown-total-usd')).toHaveTextContent('$35.00 USD');
    expect(getCurrentRate).toHaveBeenCalledTimes(1);
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

  it('submits the phone as digits only (schema shape) plus the empty honeypot', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue(confirmed);
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    await screen.findByTestId('reservation-code');
    expect(submitBookingAndPay).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '04141234567', bankCode: '0102', otp: '123456', website: '' })
    );
  });

  it('payment_declined: shows the bank reason and clears only the C2P key', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({ ok: false, error: 'payment_declined', message: 'Clave vencida' });
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Pago rechazado: Clave vencida');
    expect(screen.getByLabelText(/clave de pago/i)).toHaveValue('');
    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0414-123-4567');
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

  it('shows the ticket-style confirmation with pass code, QR and WhatsApp links after payment', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue(confirmed);
    renderCard();
    await goToPay();
    await fillPaymentAndConfirm();
    expect(await screen.findByTestId('reservation-code')).toHaveTextContent('PP-ABC12');
    expect(screen.getByAltText(/código qr/i)).toBeInTheDocument();
    // Two WhatsApp links since PR 06 (share the pass + ask the club), so each is
    // queried by its own name instead of the old /whatsapp/i.
    expect(screen.getByRole('link', { name: /compartir por whatsapp/i })).toHaveAttribute(
      'href',
      expect.stringContaining('PP-ABC12')
    );
    expect(screen.getByRole('link', { name: /escríbenos por whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar \/ imprimir/i })).toBeInTheDocument();
  });

  it('renders in English and shows English validation messages', async () => {
    renderWithI18n(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />, { locale: 'en' });
    expect(screen.getByText('Spots left today: 40')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /details to confirm your booking/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^first name$/i), 'Ana');
    await user.type(screen.getByLabelText(/last name/i), 'Pérez');
    await user.type(screen.getByLabelText(/^email$/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/document number/i), '12345678');
    await user.type(screen.getByLabelText(/^phone$/i), '123');
    await user.selectOptions(screen.getByLabelText(/^bank$/i), '0102');
    await user.type(screen.getByLabelText(/c2p payment key/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));
    expect(submitBookingAndPay).not.toHaveBeenCalled();
    expect(await screen.findByText(/invalid venezuelan phone number/i)).toBeInTheDocument();
  });

  it('translates a capacity failure from the server in English', async () => {
    vi.mocked(submitBookingAndPay).mockResolvedValue({ ok: false, error: 'capacity', remaining: 1 });
    renderWithI18n(<BookingCard prices={prices} initialAvailability={{}} remaining={40} />, { locale: 'en' });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/^first name$/i), 'Ana');
    await user.type(screen.getByLabelText(/last name/i), 'Pérez');
    await user.type(screen.getByLabelText(/^email$/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/document number/i), '12345678');
    await user.type(screen.getByLabelText(/^phone$/i), '04141234567');
    await user.selectOptions(screen.getByLabelText(/^bank$/i), '0102');
    await user.type(screen.getByLabelText(/c2p payment key/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('spots left: 1');
    expect(screen.getByRole('heading', { name: /when are you coming/i })).toBeInTheDocument();
  });
});
