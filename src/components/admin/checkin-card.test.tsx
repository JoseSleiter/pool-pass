// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckinCard } from './checkin-card';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';

function row(over: Partial<ReservationRow>): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

describe('CheckinCard', () => {
  it('valid: confirmed reservation for today shows green banner and button', () => {
    render(<CheckinCard reservation={row({})} today={TODAY} onCheckIn={vi.fn()} />);
    expect(screen.getByTestId('banner')).toHaveTextContent(/válida para hoy/i);
    expect(screen.getByRole('button', { name: /registrar entrada/i })).toBeEnabled();
  });

  it('wrong date: shows warning and no button', () => {
    render(<CheckinCard reservation={row({ date: '2030-01-20' })} today={TODAY} onCheckIn={vi.fn()} />);
    expect(screen.getByTestId('banner')).toHaveTextContent(/fecha distinta/i);
    expect(screen.queryByRole('button', { name: /registrar entrada/i })).toBeNull();
  });

  it('already checked in: shows red banner and no button', () => {
    render(
      <CheckinCard
        reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' })}
        today={TODAY}
        onCheckIn={vi.fn()}
      />
    );
    expect(screen.getByTestId('banner')).toHaveTextContent(/ya registró entrada/i);
    expect(screen.queryByRole('button', { name: /registrar entrada/i })).toBeNull();
  });

  it('unpaid statuses are marked not valid', () => {
    render(<CheckinCard reservation={row({ status: 'pending_payment' })} today={TODAY} onCheckIn={vi.fn()} />);
    expect(screen.getByTestId('banner')).toHaveTextContent(/no válida/i);
  });

  it('failed check-in action shows the returned message', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onCheckIn = vi.fn(async () => ({ ok: false as const, message: 'La reserva no está en estado confirmado.' }));
    render(<CheckinCard reservation={row({})} today={TODAY} onCheckIn={onCheckIn} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /registrar entrada/i }));
    expect(await screen.findByText(/no está en estado confirmado/i)).toBeInTheDocument();
  });
});
