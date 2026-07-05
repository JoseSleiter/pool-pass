import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  })),
}));
vi.mock('@/lib/db/reservations', () => ({
  listReservationsByDate: vi.fn(),
  getReservation: vi.fn(),
  checkInReservation: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock('@/lib/email/send', () => ({
  sendVoucherEmail: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  adminListReservations, adminGetDaySummary, adminCheckIn, adminResendVoucher,
} from './actions';
import {
  listReservationsByDate, getReservation, checkInReservation, getSettings,
} from '@/lib/db/reservations';
import { sendVoucherEmail } from '@/lib/email/send';

describe('admin actions auth gating (no user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
