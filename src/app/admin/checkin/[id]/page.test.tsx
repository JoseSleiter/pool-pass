// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReservationRow } from '@/lib/db/reservations';
import { todayCaracas } from '@/lib/dates';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getReservation: vi.fn(),
  adminCheckIn: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/reservations', () => ({ getReservation: mocks.getReservation }));
vi.mock('@/app/admin/actions', () => ({ adminCheckIn: mocks.adminCheckIn }));

import CheckinPage, { metadata } from './page';

const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: ID, code: 'PP-AAAAA', date: todayCaracas(),
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

async function renderPage(id: string) {
  render(await CheckinPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'admin@example.com', role: 'owner' });
});

describe('/admin/checkin/[id]', () => {
  it('re-verifies the admin and never reads PII when that fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(CheckinPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow('Unauthorized');
    expect(mocks.getReservation).not.toHaveBeenCalled();
  });

  it('a non-UUID id never hits the database and shows the invalid gate', async () => {
    await renderPage('not-a-uuid');
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.getReservation).not.toHaveBeenCalled();
    expect(screen.getByTestId('gate')).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reserva no encontrada o no válida');
  });

  it('a lookup error renders the invalid gate instead of crashing', async () => {
    mocks.getReservation.mockRejectedValue(new Error('db down'));
    await renderPage(ID);
    expect(mocks.getReservation).toHaveBeenCalledWith(ID);
    expect(screen.getByTestId('gate')).toHaveAttribute('data-state', 'invalid');
  });

  it('a confirmed reservation for today renders the valid gate full-bleed', async () => {
    mocks.getReservation.mockResolvedValue(row());
    await renderPage(ID);
    expect(screen.getByTestId('gate')).toHaveAttribute('data-state', 'valid');
    expect(screen.getByRole('main')).toHaveClass('min-h-dvh');
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeInTheDocument();
  });

  it('is not indexable', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
