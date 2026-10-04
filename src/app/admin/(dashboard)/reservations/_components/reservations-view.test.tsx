// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  adminCheckIn: vi.fn(),
  adminResendVoucher: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('@/app/admin/actions', () => ({
  adminCheckIn: mocks.adminCheckIn,
  adminResendVoucher: mocks.adminResendVoucher,
}));

import { ReservationsView } from './reservations-view';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
const COUNTS = { all: 40, confirmed: 20, checked_in: 10, pending: 6, canceled: 4 };
function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}
const rows = [row(), row({ id: 'b0000000-0000-0000-0000-000000000000', code: 'PP-BBBBB', status: 'pending_payment' })];

function renderView(over: { state?: Partial<ReservationsState>; rows?: ReservationRow[]; total?: number } = {}) {
  const list = over.rows ?? rows;
  render(
    <ReservationsView
      state={{ ...DEFAULT_STATE, ...over.state }}
      rows={list}
      total={over.total ?? list.length}
      counts={COUNTS}
      today={TODAY}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ReservationsView', () => {
  it('renders the heading, filters, desktop table and mobile cards for the same rows', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: 'Reservas' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Buscar reservas' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Filtrar por estado' })).toBeInTheDocument();
    expect(screen.getAllByTestId('res-table-row')).toHaveLength(2);
    expect(screen.getAllByTestId('res-row')).toHaveLength(2);
  });

  it('shows the per-status counts on the status chips', () => {
    renderView();
    expect(screen.getByRole('link', { name: 'Todas 40' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pendientes 6' })).toBeInTheDocument();
  });

  it('wires the shared pagination with the current filters', () => {
    renderView({ state: { statuses: ['confirmed'], page: 2 }, total: 42 });
    expect(screen.getByText('Mostrando 11–20 de 42 reservas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Página siguiente' }))
      .toHaveAttribute('href', '/admin/reservations?status=confirmed&page=3&pageSize=10');
  });

  it('resends the voucher from a row and confirms with a toast', async () => {
    mocks.adminResendVoucher.mockResolvedValue({ ok: true });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar voucher PP-AAAAA' }));
    expect(mocks.adminResendVoucher).toHaveBeenCalledWith(rows[0].id);
    expect(await screen.findByRole('status')).toHaveTextContent('Voucher reenviado por correo');
  });

  it('shows the server message when resending fails', async () => {
    mocks.adminResendVoucher.mockResolvedValue({ ok: false, message: 'Reserva no reenviable.' });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar voucher PP-AAAAA' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Reserva no reenviable.');
  });

  it('checks in through CheckinDialog, then refreshes the list', async () => {
    mocks.adminCheckIn.mockResolvedValue({ ok: true });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Check-in PP-AAAAA' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar check-in' }));
    expect(mocks.adminCheckIn).toHaveBeenCalledWith(rows[0].id);
    expect(mocks.router.refresh).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Check-in aprobado');
  });

  it('opens the detail drawer with the payment reference', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle PP-AAAAA' }));
    const drawer = await screen.findByRole('dialog', { name: 'Detalle de la reserva' });
    expect(within(drawer).getByText('REF-1')).toBeInTheDocument();
  });

  it('shows an empty state with a link to clear the filters', () => {
    renderView({ state: { q: 'zzz' }, rows: [], total: 0 });
    expect(screen.getByText('No hay reservas que coincidan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Limpiar filtros' })).toHaveAttribute('href', '/admin/reservations');
    expect(screen.getByText('Sin reservas')).toBeInTheDocument();
  });
});
