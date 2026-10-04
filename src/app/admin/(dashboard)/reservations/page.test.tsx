import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminSearchReservations: vi.fn(),
  adminCountReservationStatuses: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); }),
}));
vi.mock('@/app/admin/actions', () => ({ adminSearchReservations: mocks.adminSearchReservations }));
vi.mock('@/app/admin/reservations-actions', () => ({ adminCountReservationStatuses: mocks.adminCountReservationStatuses }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('./_components/reservations-view', () => ({ ReservationsView: () => null }));

import AdminReservationsPage, { metadata } from './page';
import { DEFAULT_STATE } from './_lib/search-params';

type Props = { state: unknown; rows: unknown; total: number; counts: unknown; today: string };
const COUNTS = { all: 30, confirmed: 10, checked_in: 5, pending: 10, canceled: 5 };
async function renderPage(sp: Record<string, string | string[] | undefined>) {
  const el = await AdminReservationsPage({ searchParams: Promise.resolve(sp) });
  return (el as unknown as { props: Props }).props;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminSearchReservations.mockResolvedValue({ rows: [], total: 0 });
  mocks.adminCountReservationStatuses.mockResolvedValue(COUNTS);
});

describe('/admin/reservations page', () => {
  it('has a title', () => {
    expect(metadata.title).toBe('Reservas');
  });

  it('searches with the state parsed from the URL', async () => {
    mocks.adminSearchReservations.mockResolvedValue({ rows: [{ id: 'x' }], total: 30 });
    const props = await renderPage({ q: 'ana', status: 'pending_payment', sort: 'name', page: '2' });
    expect(mocks.adminSearchReservations).toHaveBeenCalledWith({
      q: 'ana', statuses: ['pending_payment'], sort: { by: 'name', dir: 'asc' }, page: 2, pageSize: 10,
    });
    expect(props.state).toEqual({ ...DEFAULT_STATE, q: 'ana', statuses: ['pending_payment'], sort: 'name', dir: 'asc', page: 2 });
    expect(props.rows).toEqual([{ id: 'x' }]);
    expect(props.total).toBe(30);
    expect(props.counts).toEqual(COUNTS);
    expect(mocks.adminCountReservationStatuses).toHaveBeenCalledWith(mocks.adminSearchReservations.mock.calls[0][0]);
    expect(props.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to defaults on invalid params instead of failing', async () => {
    const props = await renderPage({ page: 'abc', pageSize: '7', status: 'nope', from: '2030-13-01', sort: 'x', dir: 'y' });
    expect(mocks.adminSearchReservations).toHaveBeenCalledWith({ sort: { by: 'date', dir: 'desc' }, page: 1, pageSize: 10 });
    expect(props.state).toEqual(DEFAULT_STATE);
  });

  it('redirects a page past the end to the last page, keeping filters', async () => {
    mocks.adminSearchReservations.mockResolvedValue({ rows: [], total: 15 });
    await expect(renderPage({ page: '9', status: 'confirmed' }))
      .rejects.toThrow('NEXT_REDIRECT /admin/reservations?status=confirmed&page=2');
  });

  it('redirects to page 1 when there are no results at all', async () => {
    await expect(renderPage({ page: '3' })).rejects.toThrow('NEXT_REDIRECT /admin/reservations');
  });
});
