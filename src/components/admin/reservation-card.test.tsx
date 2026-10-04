// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationCard } from './reservation-card';
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

describe('ReservationCard', () => {
  it('shows Check-in for confirmed and calls onCheckin', async () => {
    const onCheckin = vi.fn();
    render(<ReservationCard reservation={row()} onCheckin={onCheckin} onResend={vi.fn()} onDetail={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Check-in/i }));
    expect(onCheckin).toHaveBeenCalledWith(row().id);
  });
  it('always offers "Ver detalle"', async () => {
    const onDetail = vi.fn();
    render(<ReservationCard reservation={row({ status: 'checked_in' })} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={onDetail} />);
    await userEvent.click(screen.getByRole('button', { name: /Ver detalle/i }));
    expect(onDetail).toHaveBeenCalledWith(row().id);
  });
  it('shows "Ingreso registrado" instead of Check-in for checked_in', () => {
    render(<ReservationCard reservation={row({ status: 'checked_in', checked_in_at: '2030-01-15T14:01:00Z' })} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={vi.fn()} />);
    expect(screen.getByText(/Ingreso registrado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Check-in$/i })).toBeNull();
  });
  it('offers "Reenviar voucher" for confirmed and calls onResend', async () => {
    const onResend = vi.fn();
    render(<ReservationCard reservation={row()} onCheckin={vi.fn()} onResend={onResend} onDetail={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Reenviar voucher/i }));
    expect(onResend).toHaveBeenCalledWith(row().id);
  });
  it('shows "Verificar" for pending payments, which opens the detail', async () => {
    const onDetail = vi.fn();
    render(<ReservationCard reservation={row({ status: 'pending_payment' })} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={onDetail} />);
    expect(screen.queryByRole('button', { name: /Reenviar voucher/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onDetail).toHaveBeenCalledWith(row().id);
  });
  it('uses the shared status pill', () => {
    render(<ReservationCard reservation={row()} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={vi.fn()} />);
    expect(screen.getByText('Confirmada')).toHaveClass('bg-emerald-700');
  });
  it('shows the visit date with only its first letter capitalized', () => {
    render(<ReservationCard reservation={row()} onCheckin={vi.fn()} onResend={vi.fn()} onDetail={vi.fn()} />);
    const line = screen.getByText(/15 ene/);
    expect(line).toHaveClass('first-letter:uppercase');
    expect(line).not.toHaveClass('capitalize');
  });
});
