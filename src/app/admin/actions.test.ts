import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

const ADMIN_EMAIL = 'admin@club.com';
process.env.ADMIN_EMAILS = ADMIN_EMAIL;

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

describe('admin actions reject a logged-in NON-admin user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-9', email: 'intruder@evil.com' };
  });

  it('adminListReservations rejects a non-allowlisted email and never reads data', async () => {
    await expect(adminListReservations('2030-01-15')).rejects.toThrow('Unauthorized');
    expect(listReservationsByDate).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings rejects a non-allowlisted email and never writes', async () => {
    await expect(
      adminUpdateSettings({ daily_capacity: 100, adult_price_usd: 10, child_price_usd: 5 })
    ).rejects.toThrow('Unauthorized');
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe('admin settings validation (authorized user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
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

  it('adminUpsertOverride forwards reason to db', async () => {
    const res = await adminUpsertOverride('2030-02-01', 25, 'Mantenimiento');
    expect(res.ok).toBe(true);
    expect(upsertOverride).toHaveBeenCalledWith('2030-02-01', 25, 'Mantenimiento');
  });
});

describe('adminGetDaySummary aggregates (authorized user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
  });

  it('computes occupancy, revenue and pending counts from the day rows', async () => {
    const row = (over: Record<string, unknown>) => ({
      id: 'x', code: 'PP-00000', date: '2030-01-15', first_name: 'A', last_name: 'B',
      email: 'a@b.c', id_type: 'V', id_number: '1', adults: 2, children: 1,
      total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
      payment_ref: null, expires_at: null, checked_in_at: null, created_at: '', ...over,
    });
    vi.mocked(listReservationsByDate).mockResolvedValue([
      row({ status: 'confirmed' }),
      row({ status: 'checked_in', adults: 1, children: 0, total_usd: 15, total_ves: 547.5 }),
      row({ status: 'pending_payment' }),
      row({ status: 'failed' }),
    ] as never);
    vi.mocked(getSettings).mockResolvedValue({
      daily_capacity: 100, adult_price_usd: 15, child_price_usd: 5,
      last_bcv_rate: null, last_bcv_rate_at: null,
    } as never);

    const s = await adminGetDaySummary('2030-01-15');
    expect(s).toEqual({
      capacity: 100,
      confirmedPeople: 4,      // 3 (confirmed) + 1 (checked_in); pending/failed excluded
      checkedInParties: 1,
      checkedInPeople: 1,
      revenueUsd: 50,          // 35 + 15
      revenueVes: 1825,        // 1277.5 + 547.5
      paidCount: 2,
      pendingCount: 1,
    });
  });
});
