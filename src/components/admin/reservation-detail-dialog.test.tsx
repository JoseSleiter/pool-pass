// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
