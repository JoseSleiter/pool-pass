import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  countReservationsByStatus: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/reservation-counts', () => ({ countReservationsByStatus: mocks.countReservationsByStatus }));

import { adminCountReservationStatuses } from './reservations-actions';

const COUNTS = { all: 6, confirmed: 2, checked_in: 1, pending: 1, canceled: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'admin@club.com', role: 'operator' });
  mocks.countReservationsByStatus.mockResolvedValue(COUNTS);
});

describe('adminCountReservationStatuses', () => {
  it('requires an admin and never reaches the DB without one', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(adminCountReservationStatuses({ page: 1, pageSize: 10 })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.countReservationsByStatus).not.toHaveBeenCalled();
  });

  it('validates the query with the shared zod parser', async () => {
    await expect(adminCountReservationStatuses({ page: 0, pageSize: 7 })).rejects.toThrow('Invalid query');
    expect(mocks.countReservationsByStatus).not.toHaveBeenCalled();
  });

  it('returns the counts for the parsed query', async () => {
    const out = await adminCountReservationStatuses({ page: 1, pageSize: 10, q: 'ana', statuses: ['confirmed'] });
    expect(out).toEqual(COUNTS);
    expect(mocks.countReservationsByStatus).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ana', statuses: ['confirmed'], page: 1, pageSize: 10 }),
    );
  });
});
