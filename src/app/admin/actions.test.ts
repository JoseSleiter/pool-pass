import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string } | null = null;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));
vi.mock('@/lib/db/reservations', () => ({
  listReservationsByDate: vi.fn(),
  getReservation: vi.fn(),
  checkInReservation: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listOverrides: vi.fn(),
  upsertOverride: vi.fn(),
  deleteOverride: vi.fn(),
}));
vi.mock('@/lib/email/send', () => ({
  sendVoucherEmail: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  adminListReservations, adminGetDaySummary, adminCheckIn, adminResendVoucher,
  adminGetSettings, adminUpdateSettings, adminUpsertOverride, adminDeleteOverride,
} from './actions';
import {
  listReservationsByDate, getReservation, checkInReservation, getSettings,
  updateSettings, listOverrides, upsertOverride, deleteOverride,
} from '@/lib/db/reservations';
import { sendVoucherEmail } from '@/lib/email/send';

describe('admin actions auth gating (no user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
  });

  it('adminListReservations rejects with Unauthorized and never hits the data layer', async () => {
    await expect(adminListReservations('2030-01-15')).rejects.toThrow('Unauthorized');
    expect(listReservationsByDate).not.toHaveBeenCalled();
  });

  it('adminGetDaySummary rejects with Unauthorized and never hits the data layer', async () => {
    await expect(adminGetDaySummary('2030-01-15')).rejects.toThrow('Unauthorized');
    expect(listReservationsByDate).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('adminCheckIn rejects with Unauthorized and never hits the data layer', async () => {
    await expect(adminCheckIn('6f9619ff-8b86-d011-b42d-00c04fc964ff')).rejects.toThrow('Unauthorized');
    expect(checkInReservation).not.toHaveBeenCalled();
  });

  it('adminResendVoucher rejects with Unauthorized and never reads or emails', async () => {
    await expect(adminResendVoucher('6f9619ff-8b86-d011-b42d-00c04fc964ff')).rejects.toThrow('Unauthorized');
    expect(getReservation).not.toHaveBeenCalled();
    expect(sendVoucherEmail).not.toHaveBeenCalled();
  });

  it('adminGetSettings rejects with Unauthorized and never hits the data layer', async () => {
    await expect(adminGetSettings()).rejects.toThrow('Unauthorized');
    expect(getSettings).not.toHaveBeenCalled();
    expect(listOverrides).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings rejects with Unauthorized and never hits the data layer', async () => {
    await expect(
      adminUpdateSettings({ daily_capacity: 100, adult_price_usd: 10, child_price_usd: 5 })
    ).rejects.toThrow('Unauthorized');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride rejects with Unauthorized and never hits the data layer', async () => {
    await expect(adminUpsertOverride('2030-01-15', 5)).rejects.toThrow('Unauthorized');
    expect(upsertOverride).not.toHaveBeenCalled();
  });

  it('adminDeleteOverride rejects with Unauthorized and never hits the data layer', async () => {
    await expect(adminDeleteOverride('2030-01-15')).rejects.toThrow('Unauthorized');
    expect(deleteOverride).not.toHaveBeenCalled();
  });
});

describe('admin settings validation (authorized user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1' };
  });

  it('adminUpdateSettings rejects a non-integer daily_capacity without hitting the data layer', async () => {
    const res = await adminUpdateSettings({
      daily_capacity: 1.5, adult_price_usd: 15, child_price_usd: 5,
    });
    expect(res.ok).toBe(false);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings rejects a negative daily_capacity without hitting the data layer', async () => {
    const res = await adminUpdateSettings({
      daily_capacity: -1, adult_price_usd: 15, child_price_usd: 5,
    });
    expect(res.ok).toBe(false);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride rejects a malformed date without hitting the data layer', async () => {
    const res = await adminUpsertOverride('2030-13-99x', 5);
    expect(res.ok).toBe(false);
    expect(upsertOverride).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride rejects a negative capacity without hitting the data layer', async () => {
    const res = await adminUpsertOverride('2030-03-05', -2);
    expect(res.ok).toBe(false);
    expect(upsertOverride).not.toHaveBeenCalled();
  });
});
