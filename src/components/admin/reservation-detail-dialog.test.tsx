// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { longDateEs } from '@/lib/dates';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import type { ReservationRow } from '@/lib/db/reservations';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-KAV8W', date: '2030-01-15',
    first_name: 'Jose', last_name: 'Rios', email: 'j@e.com',
    id_type: 'V', id_number: '262626262', adults: 1, children: 0,
    total_usd: 15, bcv_rate: 36.5, total_ves: 547.5,
    status: 'confirmed', payment_ref: 'REF', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

describe('ReservationDetailDialog', () => {
  it('shows reservation data when open', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.getByText('PP-KAV8W')).toBeInTheDocument();
    expect(screen.getByText(/Jose Rios/)).toBeInTheDocument();
    expect(screen.getByText(/V-262626262/)).toBeInTheDocument();
    expect(screen.getByText(/\$15\.00/)).toBeInTheDocument();
  });
  it('offers "Iniciar check-in" for confirmed reservations', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Iniciar check-in/i })).toBeInTheDocument();
  });
  it('hides "Iniciar check-in" for checked_in reservations', () => {
    render(<ReservationDetailDialog reservation={row({ status: 'checked_in' })} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Iniciar check-in/i })).toBeNull();
  });
  it('is a slide-over dialog named "Detalle de la reserva"', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Detalle de la reserva' })).toBeInTheDocument();
  });
  it('shows payment and audit data: C2P ref, BCV rate, Bs. total, created and check-in times', () => {
    render(
      <ReservationDetailDialog
        reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z', payment_ref: 'C2P-998877' })}
        open onOpenChange={() => {}} onStartCheckin={vi.fn()}
      />,
    );
    expect(screen.getByText('C2P-998877')).toBeInTheDocument();
    expect(screen.getByText('Bs. 36.50 / USD')).toBeInTheDocument();
    expect(screen.getByText('Bs. 547.50')).toBeInTheDocument();
    expect(screen.getByText('j@e.com')).toBeInTheDocument();
    expect(screen.getByText(/^10 ene\.? 2030, 6:00 a\. m\.$/)).toBeInTheDocument();
    expect(screen.getByText(/^15 ene\.? 2030, 10:15 a\. m\.$/)).toBeInTheDocument();
  });
  it('uses first-letter:uppercase (not capitalize) for the long date', () => {
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} />);
    const date = screen.getByText(longDateEs('2030-01-15'));
    expect(date).toHaveClass('first-letter:uppercase');
    expect(date).not.toHaveClass('capitalize');
  });
  it('shows dashes for missing payment data and the expiry of pending payments', () => {
    render(
      <ReservationDetailDialog
        reservation={row({ status: 'pending_payment', payment_ref: null, bcv_rate: null, total_ves: null, expires_at: '2030-01-15T15:00:00Z' })}
        open onOpenChange={() => {}} onStartCheckin={vi.fn()}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Expira')).toBeInTheDocument();
  });
  it('resends the voucher when onResend is provided', async () => {
    const onResend = vi.fn();
    render(<ReservationDetailDialog reservation={row()} open onOpenChange={() => {}} onStartCheckin={vi.fn()} onResend={onResend} />);
    await userEvent.click(screen.getByRole('button', { name: /Reenviar voucher/i }));
    expect(onResend).toHaveBeenCalledWith(row().id);
  });
});
