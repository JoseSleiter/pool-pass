import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

const ADMIN_EMAIL = 'admin@club.com';
const OPS_EMAIL = 'ops@club.com';
process.env.ADMIN_EMAILS = `${ADMIN_EMAIL},${OPS_EMAIL}`;

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
vi.mock('@/lib/db/admin-roles', () => ({
  getAdminRole: vi.fn(async () => null),
  listAdminRoles: vi.fn(async () => []),
  upsertAdminRole: vi.fn(async () => {}),
}));
vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(async () => {}),
  listAudit: vi.fn(async () => ({ rows: [], total: 0 })),
}));
vi.mock('@/lib/bcv-history', () => ({
  listBcvHistory: vi.fn(async () => ({ rows: [], total: 0 })),
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
import { getAdminRole } from '@/lib/db/admin-roles';
import { logAudit } from '@/lib/audit';

// Default for every test: an allowlisted email with no admin_roles row = owner.
// (vi.clearAllMocks only clears call history, so a test that switches the role
// must not leak it — this resets it before every test.)
beforeEach(() => {
  vi.mocked(getAdminRole).mockResolvedValue(null);
});

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
    vi.mocked(upsertOverride).mockResolvedValue(undefined);
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

describe('owner-only actions reject an operator', () => {
  const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'ops-1', email: OPS_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
  });

  it('adminGetSettings rejects with Forbidden and never reads', async () => {
    await expect(adminGetSettings()).rejects.toThrow('Forbidden');
    expect(getSettings).not.toHaveBeenCalled();
    expect(listOverrides).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings rejects with Forbidden and never writes', async () => {
    await expect(
      adminUpdateSettings({ daily_capacity: 100, adult_price_usd: 10, child_price_usd: 5 })
    ).rejects.toThrow('Forbidden');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride rejects with Forbidden and never writes', async () => {
    await expect(adminUpsertOverride('2030-01-15', 5)).rejects.toThrow('Forbidden');
    expect(upsertOverride).not.toHaveBeenCalled();
  });

  it('adminDeleteOverride rejects with Forbidden and never writes', async () => {
    await expect(adminDeleteOverride('2030-01-15')).rejects.toThrow('Forbidden');
    expect(deleteOverride).not.toHaveBeenCalled();
  });

  it('an operator can still check guests in', async () => {
    vi.mocked(checkInReservation).mockResolvedValue(undefined);
    await expect(adminCheckIn(ID)).resolves.toEqual({ ok: true });
    expect(checkInReservation).toHaveBeenCalledWith(ID);
  });

  it('an operator can still read the day list', async () => {
    vi.mocked(listReservationsByDate).mockResolvedValue([]);
    await expect(adminListReservations('2030-01-15')).resolves.toEqual([]);
  });
});

describe('admin write actions record an audit entry on success only', () => {
  const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
  const reservation = {
    id: ID, code: 'PP-ABCDE', date: '2030-01-15', first_name: 'Ana', last_name: 'Pérez',
    email: 'ana@example.com', id_type: 'V', id_number: '123', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
    payment_ref: 'REF-1', expires_at: null, checked_in_at: null, created_at: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'admin-1', email: ADMIN_EMAIL };
  });

  it('adminCheckIn logs reservation.check_in', async () => {
    vi.mocked(checkInReservation).mockResolvedValue(undefined);
    await expect(adminCheckIn(ID)).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({ actor: ADMIN_EMAIL, action: 'reservation.check_in', target: ID });
  });

  it('adminCheckIn does not log when the check-in fails', async () => {
    vi.mocked(checkInReservation).mockRejectedValue(new Error('reservation not in expected status'));
    const res = await adminCheckIn(ID);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminResendVoucher logs reservation.resend_voucher with the code', async () => {
    vi.mocked(getReservation).mockResolvedValue(reservation as never);
    vi.mocked(sendVoucherEmail).mockResolvedValue(undefined);
    await expect(adminResendVoucher(ID)).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({
      actor: ADMIN_EMAIL, action: 'reservation.resend_voucher', target: ID, details: { code: 'PP-ABCDE' },
    });
  });

  it('adminResendVoucher does not log when the email fails', async () => {
    vi.mocked(getReservation).mockResolvedValue(reservation as never);
    vi.mocked(sendVoucherEmail).mockRejectedValue(new Error('smtp down'));
    const res = await adminResendVoucher(ID);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminResendVoucher does not log for a non-resendable reservation', async () => {
    vi.mocked(getReservation).mockResolvedValue({ ...reservation, status: 'pending_payment' } as never);
    const res = await adminResendVoucher(ID);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings logs settings.update with the saved values', async () => {
    vi.mocked(updateSettings).mockResolvedValue(undefined);
    const values = { daily_capacity: 80, adult_price_usd: 15, child_price_usd: 5 };
    await expect(adminUpdateSettings(values)).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({ actor: ADMIN_EMAIL, action: 'settings.update', details: values });
  });

  it('adminUpdateSettings does not log when the save fails', async () => {
    vi.mocked(updateSettings).mockRejectedValue(new Error('db down'));
    const res = await adminUpdateSettings({ daily_capacity: 80, adult_price_usd: 15, child_price_usd: 5 });
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpdateSettings does not log invalid input', async () => {
    const res = await adminUpdateSettings({ daily_capacity: -1, adult_price_usd: 15, child_price_usd: 5 });
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminUpsertOverride logs override.upsert with capacity and reason', async () => {
    vi.mocked(upsertOverride).mockResolvedValue(undefined);
    await expect(adminUpsertOverride('2030-02-01', 25, '  Mantenimiento ')).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({
      actor: ADMIN_EMAIL, action: 'override.upsert', target: '2030-02-01',
      details: { capacity: 25, reason: 'Mantenimiento' },
    });
  });

  it('adminUpsertOverride does not log when the save fails', async () => {
    vi.mocked(upsertOverride).mockRejectedValue(new Error('db down'));
    const res = await adminUpsertOverride('2030-02-01', 25);
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('adminDeleteOverride logs override.delete', async () => {
    vi.mocked(deleteOverride).mockResolvedValue(undefined);
    await expect(adminDeleteOverride('2030-02-01')).resolves.toEqual({ ok: true });
    expect(logAudit).toHaveBeenCalledWith({ actor: ADMIN_EMAIL, action: 'override.delete', target: '2030-02-01' });
  });

  it('adminDeleteOverride does not log when the delete fails', async () => {
    vi.mocked(deleteOverride).mockRejectedValue(new Error('db down'));
    const res = await adminDeleteOverride('2030-02-01');
    expect(res.ok).toBe(false);
    expect(logAudit).not.toHaveBeenCalled();
  });
});
