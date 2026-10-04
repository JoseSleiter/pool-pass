// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReservationsDataTable } from './reservations-data-table';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';
import type { ReservationRow } from '@/lib/db/reservations';

function row(over: Partial<ReservationRow>): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

const rows = [
  row({}),
  row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', status: 'pending_payment' }),
  row({ id: 'c0000000-0000-0000-0000-000000000000', code: 'PP-CCCCC', status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' }),
  row({ id: 'd0000000-0000-0000-0000-000000000000', code: 'PP-DDDDD', status: 'expired' }),
];

function renderTable(state: ReservationsState = DEFAULT_STATE) {
  const handlers = { onDetail: vi.fn(), onResend: vi.fn(), onCheckin: vi.fn() };
  render(<ReservationsDataTable state={state} rows={rows} {...handlers} />);
  return handlers;
}

const rowOf = (code: string) => screen.getByText(code).closest('tr')!;

describe('ReservationsDataTable', () => {
  it('has sortable headers with aria-sort and sort links', () => {
    renderTable();
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'descending');
    for (const name of ['Código', 'Cliente', 'Personas', 'Total', 'Estado']) {
      expect(screen.getByRole('columnheader', { name })).toHaveAttribute('aria-sort', 'none');
    }
    expect(screen.getByRole('link', { name: 'Fecha' })).toHaveAttribute('href', '/admin/reservations?sort=date&dir=asc');
    expect(screen.getByRole('link', { name: 'Total' })).toHaveAttribute('href', '/admin/reservations?sort=total_usd&dir=asc');
  });

  it('reflects the active column and flips it', () => {
    renderTable({ ...DEFAULT_STATE, sort: 'total_usd', dir: 'asc', statuses: ['confirmed'] });
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('link', { name: 'Total' }))
      .toHaveAttribute('href', '/admin/reservations?status=confirmed&sort=total_usd&dir=desc');
  });

  it('shows date, client, people, totals and the status pill', () => {
    renderTable();
    const r = within(rowOf('PP-AAAAA'));
    expect(r.getByText(/15 ene/)).toHaveClass('first-letter:uppercase');
    expect(r.getByText('Ana Pérez')).toBeInTheDocument();
    expect(r.getByText('V-12345678')).toBeInTheDocument();
    expect(r.getByText('3')).toBeInTheDocument();
    expect(r.getByText('2A 1N')).toBeInTheDocument();
    expect(r.getByText('$35.00')).toBeInTheDocument();
    expect(r.getByText('Bs. 1277.50')).toBeInTheDocument();
    expect(within(rowOf('PP-CCCCC')).getByText('Ingresó 10:15 a. m.')).toBeInTheDocument();
  });

  it('offers check-in, resend and detail for confirmed rows (44px icons)', async () => {
    const h = renderTable();
    const checkin = screen.getByRole('button', { name: 'Check-in PP-AAAAA' });
    expect(checkin).toHaveClass('size-11');
    await userEvent.click(checkin);
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar voucher PP-AAAAA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle PP-AAAAA' }));
    expect(h.onCheckin).toHaveBeenCalledWith(rows[0].id);
    expect(h.onResend).toHaveBeenCalledWith(rows[0].id);
    expect(h.onDetail).toHaveBeenCalledWith(rows[0].id);
  });

  it('pending rows offer "Verificar" (opens detail) and no resend/check-in', async () => {
    const h = renderTable();
    expect(screen.queryByRole('button', { name: 'Reenviar voucher PP-BBBBB' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check-in PP-BBBBB' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Verificar pago de PP-BBBBB' }));
    expect(h.onDetail).toHaveBeenCalledWith(rows[1].id);
  });

  it('checked-in rows can resend but not check in; expired rows only show detail', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Reenviar voucher PP-CCCCC' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check-in PP-CCCCC' })).toBeNull();
    expect(within(rowOf('PP-DDDDD')).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Ver detalle PP-DDDDD']);
  });
});
