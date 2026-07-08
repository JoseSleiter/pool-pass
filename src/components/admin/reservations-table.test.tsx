// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationsTable } from './reservations-table';
import type { ReservationRow } from '@/lib/db/reservations';

function row(over: Partial<ReservationRow>): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

describe('ReservationsTable', () => {
  it('filters rows by name, code, or ID number', async () => {
    render(
      <ReservationsTable
        rows={[
          row({ code: 'PP-AAAAA', first_name: 'Ana' }),
          row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', first_name: 'Luis', id_number: '999' }),
        ]}
        onCheckIn={vi.fn()}
        onResend={vi.fn()}
      />
    );
    expect(screen.getAllByTestId('res-row')).toHaveLength(2);
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'luis');
    expect(screen.getAllByTestId('res-row')).toHaveLength(1);
    expect(screen.getByText(/PP-BBBBB/)).toBeInTheDocument();
  });

  it('only offers check-in for confirmed rows', () => {
    render(
      <ReservationsTable
        rows={[row({ status: 'checked_in' }), row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-CCCCC', status: 'confirmed' })]}
        onCheckIn={vi.fn()}
        onResend={vi.fn()}
      />
    );
    expect(screen.getAllByRole('button', { name: /check-in/i })).toHaveLength(1);
  });

  it('shows compact party labels', () => {
    render(
      <ReservationsTable
        rows={[row({ adults: 2, children: 1 })]}
        onCheckIn={vi.fn()}
        onResend={vi.fn()}
      />
    );
    expect(screen.getByText(/2A 1N/)).toBeInTheDocument();
  });

  it('shows check-in time for checked_in rows', () => {
    render(
      <ReservationsTable
        rows={[row({ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' })]}
        onCheckIn={vi.fn()}
        onResend={vi.fn()}
      />
    );
    expect(screen.getByText(/ingresó 10:15/i)).toBeInTheDocument();
  });

  it('labels pending rows as payment under verification', () => {
    render(
      <ReservationsTable
        rows={[row({ status: 'pending_payment' })]}
        onCheckIn={vi.fn()}
        onResend={vi.fn()}
      />
    );
    expect(screen.getByText(/pago en verificación/i)).toBeInTheDocument();
  });
});
