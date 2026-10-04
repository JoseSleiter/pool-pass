import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReservationRow, SettingsRow } from '@/lib/db/reservations';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listReservationsByDate: vi.fn(),
  getSettings: vi.fn(),
  listOverrides: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/reservations', () => ({
  listReservationsByDate: mocks.listReservationsByDate,
  getSettings: mocks.getSettings,
  listOverrides: mocks.listOverrides,
}));

import { adminGetDayMetrics } from './metrics-actions';

const settings: SettingsRow = {
  daily_capacity: 100, adult_price_usd: 10, child_price_usd: 5,
  last_bcv_rate: null, last_bcv_rate_at: null,
};

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 'r1', code: 'PP-0001', date: '2030-01-15',
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 0,
    total_usd: 20, bcv_rate: 36.5, total_ves: 730,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T12:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'admin@club.com', role: 'operator' });
  mocks.listReservationsByDate.mockResolvedValue([row()]);
  mocks.getSettings.mockResolvedValue(settings);
  mocks.listOverrides.mockResolvedValue([]);
});

function expectNoDataReads() {
  expect(mocks.listReservationsByDate).not.toHaveBeenCalled();
  expect(mocks.getSettings).not.toHaveBeenCalled();
  expect(mocks.listOverrides).not.toHaveBeenCalled();
}

describe('adminGetDayMetrics', () => {
  it('rejects with Unauthorized and never reads data when the gate fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(adminGetDayMetrics('2030-01-15')).rejects.toThrow('Unauthorized');
    expectNoDataReads();
  });

  it('is open to operators (no owner role required)', async () => {
    await adminGetDayMetrics('2030-01-15');
    expect(mocks.requireAdmin).toHaveBeenCalledWith();
  });

  it.each(['hoy', '2030-1-15', '2030-02-31', ''])('rejects the invalid date %j without reading data', async (d) => {
    await expect(adminGetDayMetrics(d)).rejects.toThrow('Invalid date');
    expectNoDataReads();
  });

  it('reads the day and uses the default capacity when there is no override', async () => {
    mocks.listOverrides.mockResolvedValue([{ date: '2030-01-20', capacity: 0, reason: null }]);
    const m = await adminGetDayMetrics('2030-01-15');
    expect(mocks.listReservationsByDate).toHaveBeenCalledWith('2030-01-15');
    expect(m.capacity).toBe(100);
    expect(m.override).toBeNull();
    expect(m.confirmedPeople).toBe(2);
    expect(m.collected).toEqual({ usd: 20, ves: 730, count: 1 });
  });

  it("uses the day's override so a closed day reports capacity 0", async () => {
    mocks.listOverrides.mockResolvedValue([{ date: '2030-01-15', capacity: 0, reason: 'Mantenimiento' }]);
    const m = await adminGetDayMetrics('2030-01-15');
    expect(m.capacity).toBe(0);
    expect(m.defaultCapacity).toBe(100);
    expect(m.override).toEqual({ capacity: 0, reason: 'Mantenimiento' });
  });
});
