// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckinCard } from './checkin-card';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: ID, code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

const okAction = () => vi.fn(async () => ({ ok: true }));
const gate = () => screen.getByTestId('gate');
const title = () => screen.getByRole('heading', { level: 1 });
const registerButton = () => screen.queryByRole('button', { name: 'Registrar entrada' });

describe('CheckinCard — states', () => {
  it('valid: green gate with guest data and the 60px "Registrar entrada" button', () => {
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'valid');
    expect(gate()).toHaveClass('bg-green-800', 'text-white');
    expect(title()).toHaveTextContent('Reserva válida para hoy');
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('V-12345678')).toBeInTheDocument();
    expect(screen.getByTestId('gate-adults')).toHaveTextContent('2');
    expect(screen.getByTestId('gate-children')).toHaveTextContent('1');
    const btn = registerButton();
    expect(btn).toBeEnabled();
    expect(btn).toHaveClass('h-[60px]', 'w-full');
  });

  it('valid: child-only booking shows 0 adults and the children count', () => {
    render(<CheckinCard reservation={row({ adults: 0, children: 2 })} today={TODAY} onCheckIn={okAction()} />);
    expect(screen.getByTestId('gate-adults')).toHaveTextContent('0');
    expect(screen.getByTestId('gate-children')).toHaveTextContent('2');
  });

  it('wrong date: amber gate with the real date in long Spanish and no button', () => {
    render(<CheckinCard reservation={row({ date: '2030-01-20' })} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'wrong-date');
    expect(gate()).toHaveClass('bg-amber-400', 'text-navy-deep');
    expect(title()).toHaveTextContent('Reserva para otra fecha');
    expect(screen.getByText('Fecha de la reserva: domingo, 20 de enero de 2030')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(registerButton()).toBeNull();
  });

  it('already in: red gate with the entry time in Caracas 12h and no button', () => {
    render(
      <CheckinCard
        reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' })}
        today={TODAY}
        onCheckIn={okAction()}
      />
    );
    expect(gate()).toHaveAttribute('data-state', 'already-in');
    expect(gate()).toHaveClass('bg-red-800', 'text-white');
    // 14:00 UTC = 10:00 a. m. in America/Caracas (UTC-4)
    expect(title()).toHaveTextContent('Entrada ya registrada a las 10:00 a. m.');
    expect(registerButton()).toBeNull();
  });

  it('already in without timestamp still reads as already registered', () => {
    render(<CheckinCard reservation={row({ status: 'checked_in' })} today={TODAY} onCheckIn={okAction()} />);
    expect(title()).toHaveTextContent(/^Entrada ya registrada$/);
  });

  it('already in wins over wrong date', () => {
    render(
      <CheckinCard
        reservation={row({ status: 'checked_in', date: '2030-01-20', checked_in_at: '2030-01-20T14:00:00Z' })}
        today={TODAY}
        onCheckIn={okAction()}
      />
    );
    expect(gate()).toHaveAttribute('data-state', 'already-in');
    expect(registerButton()).toBeNull();
  });

  it('pending payment: red invalid gate with a pending-payment reason line', () => {
    render(<CheckinCard reservation={row({ status: 'pending_payment' })} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'invalid');
    expect(gate()).toHaveClass('bg-red-900', 'text-white');
    expect(title()).toHaveTextContent('Reserva no encontrada o no válida');
    expect(screen.getByText(/^Pago pendiente de verificación/)).toBeInTheDocument();
    expect(registerButton()).toBeNull();
  });

  it.each([
    ['failed', /pago fue rechazado/i],
    ['expired', /expiró sin completar el pago/i],
  ] as const)('status %s: invalid gate with its own reason', (status, reason) => {
    render(<CheckinCard reservation={row({ status })} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText(/pago pendiente/i)).toBeNull();
  });

  it('not found: invalid gate, no guest details, placeholder code', () => {
    render(<CheckinCard reservation={null} today={TODAY} onCheckIn={okAction()} />);
    expect(gate()).toHaveAttribute('data-state', 'invalid');
    expect(title()).toHaveTextContent('Reserva no encontrada o no válida');
    expect(screen.getByText(/no corresponde a ninguna reserva/i)).toBeInTheDocument();
    expect(screen.queryByTestId('gate-details')).toBeNull();
    expect(screen.getByTestId('gate-code')).toHaveTextContent('Sin código');
  });

  it.each([
    ['valid', row()],
    ['wrong-date', row({ date: '2030-01-20' })],
    ['already-in', row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' })],
    ['invalid', row({ status: 'expired' })],
  ] as const)('%s: back link, reservation code and a state icon are always visible', (_state, r) => {
    render(<CheckinCard reservation={r} today={TODAY} onCheckIn={okAction()} />);
    expect(screen.getByRole('link', { name: /volver al panel/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByTestId('gate-code')).toHaveTextContent('PP-AAAAA');
    expect(screen.getByTestId('gate-icon').tagName.toLowerCase()).toBe('svg');
  });
});

describe('CheckinCard — register flow', () => {
  it('success: calls the action, shows the entry time in Caracas and hides the button', async () => {
    const onCheckIn = okAction();
    render(
      <CheckinCard
        reservation={row()}
        today={TODAY}
        onCheckIn={onCheckIn}
        now={() => new Date('2030-01-15T14:05:00Z')}
      />
    );
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' })).toBeInTheDocument();
    expect(onCheckIn).toHaveBeenCalledWith(ID);
    expect(gate()).toHaveAttribute('data-state', 'success');
    expect(gate()).toHaveClass('bg-green-900');
    expect(screen.getByText('Hora de entrada: 10:05 a. m.')).toBeInTheDocument();
    expect(registerButton()).toBeNull();
    expect(screen.getByRole('link', { name: /volver al panel/i })).toBeInTheDocument();
    expect(screen.getByTestId('gate-code')).toHaveTextContent('PP-AAAAA');
  });

  it('loading: button shows "Registrando…", is disabled and cannot fire twice', async () => {
    let resolve!: (v: { ok: boolean }) => void;
    const onCheckIn = vi.fn(() => new Promise<{ ok: boolean }>((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await user.click(registerButton()!);
    const busy = screen.getByRole('button', { name: /registrando/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy);
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrada registrada' })).toBeInTheDocument();
  });

  it('failure: shows the returned message and lets the operator retry', async () => {
    const onCheckIn = vi.fn(async () => ({ ok: false, message: 'La reserva no está en estado confirmado.' }));
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent('La reserva no está en estado confirmado.');
    expect(gate()).toHaveAttribute('data-state', 'valid');
    expect(registerButton()).toBeEnabled();
  });

  it('failure without message uses a generic one', async () => {
    const onCheckIn = vi.fn(async () => ({ ok: false }));
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar la entrada.');
  });

  it('thrown action (network/server error) shows a connection hint and re-enables the button', async () => {
    const onCheckIn = vi.fn(async () => { throw new Error('fetch failed'); });
    render(<CheckinCard reservation={row()} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(registerButton()!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/revisa la conexión/i);
    expect(registerButton()).toBeEnabled();
  });
});
