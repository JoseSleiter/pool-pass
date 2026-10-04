// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationsTable } from './reservations-table';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
function row(over: Partial<ReservationRow>): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

const rows = [
  row({ code: 'PP-AAAAA', first_name: 'Ana', status: 'confirmed' }),
  row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', first_name: 'Luis', id_number: '999', status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' }),
];

describe('ReservationsTable', () => {
  it('filters rows by search text', async () => {
    render(<ReservationsTable rows={rows} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getAllByTestId('res-row')).toHaveLength(2);
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'luis');
    expect(screen.getAllByTestId('res-row')).toHaveLength(1);
  });

  it('filters by status chip', async () => {
    render(<ReservationsTable rows={rows} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Ingresaron · 1/i }));
    expect(screen.getAllByTestId('res-row')).toHaveLength(1);
    expect(screen.getByText('PP-BBBBB')).toBeInTheDocument();
  });

  it('shows results counter', () => {
    render(<ReservationsTable rows={rows} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByText(/2 reservas encontradas/i)).toBeInTheDocument();
  });

  it('shows empty state when no rows', () => {
    render(<ReservationsTable rows={[]} today={TODAY} onCheckIn={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByText(/No hay reservas para este día/i)).toBeInTheDocument();
  });

  it('opens the approve dialog from a confirmed card and calls onCheckIn', async () => {
    const onCheckIn = vi.fn().mockResolvedValue({ ok: true });
    render(<ReservationsTable rows={[rows[0]]} today={TODAY} onCheckIn={onCheckIn} onResend={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Check-in$/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Aprobar check-in/i }));
    expect(onCheckIn).toHaveBeenCalledWith(rows[0].id);
  });
  it('resends the voucher from the detail drawer', async () => {
    const onResend = vi.fn();
    render(<ReservationsTable rows={[rows[0]]} today={TODAY} onCheckIn={vi.fn()} onResend={onResend} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Detalle de la reserva' });
    await userEvent.click(within(drawer).getByRole('button', { name: /Reenviar voucher/i }));
    expect(onResend).toHaveBeenCalledWith(rows[0].id);
  });
});
