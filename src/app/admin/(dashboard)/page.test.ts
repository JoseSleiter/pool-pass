import { describe, it, expect, vi, beforeEach } from 'vitest';
import { todayCaracas } from '@/lib/dates';

const mocks = vi.hoisted(() => ({
  adminListReservations: vi.fn(),
  adminGetDayMetrics: vi.fn(),
}));

vi.mock('@/app/admin/actions', () => ({ adminListReservations: mocks.adminListReservations }));
vi.mock('@/app/admin/metrics-actions', () => ({ adminGetDayMetrics: mocks.adminGetDayMetrics }));
vi.mock('@/components/admin/day-view', () => ({ AdminDayView: () => null }));

import AdminHome from './page';

const run = (params: { date?: string }) => AdminHome({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminListReservations.mockResolvedValue([]);
  mocks.adminGetDayMetrics.mockResolvedValue({ marker: 'metrics' });
});

describe('admin home page', () => {
  it('loads rows and metrics for a valid ?date= and keys the view by date', async () => {
    const el = await run({ date: '2030-01-15' });
    expect(mocks.adminListReservations).toHaveBeenCalledWith('2030-01-15');
    expect(mocks.adminGetDayMetrics).toHaveBeenCalledWith('2030-01-15');
    expect(el.key).toBe('2030-01-15');
    expect(el.props).toMatchObject({
      date: '2030-01-15', today: todayCaracas(), rows: [], metrics: { marker: 'metrics' },
    });
  });

  it.each([{}, { date: 'hoy' }, { date: '2030-02-31' }])('falls back to today (Caracas) for %j', async (params) => {
    const today = todayCaracas();
    const el = await run(params);
    expect(mocks.adminGetDayMetrics).toHaveBeenCalledWith(today);
    expect(el.props).toMatchObject({ date: today, today });
  });
});
