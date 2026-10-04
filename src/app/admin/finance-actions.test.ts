// src/app/admin/finance-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  searchTransactions: vi.fn(),
  transactionTotals: vi.fn(),
  listBcvHistory: vi.fn(),
  searchAudit: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/db/transactions', () => ({
  searchTransactions: mocks.searchTransactions,
  transactionTotals: mocks.transactionTotals,
}));
vi.mock('@/lib/bcv-history', () => ({ listBcvHistory: mocks.listBcvHistory }));
vi.mock('@/lib/db/audit-search', () => ({ searchAudit: mocks.searchAudit }));

import { adminBcvHistoryPage, adminListTransactions, adminSearchAudit } from './finance-actions';

const OWNER = { email: 'owner@club.com', role: 'owner' as const };
const totals = { collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 2 };
const bcv = (id: number, rate: number) => ({ id, rate, source: 'auto', fetched_at: '2026-10-04T13:00:00Z' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(OWNER);
});

describe('adminListTransactions', () => {
  const q = { dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 };

  it('gates on any admin and returns the page plus range totals', async () => {
    mocks.searchTransactions.mockResolvedValue({ rows: [{ id: 'r1' }], total: 1 });
    mocks.transactionTotals.mockResolvedValue(totals);
    await expect(adminListTransactions({ ...q, status: 'confirmed' })).resolves.toEqual({
      rows: [{ id: 'r1' }], total: 1, totals,
    });
    expect(mocks.requireAdmin).toHaveBeenCalledWith();
    expect(mocks.searchTransactions).toHaveBeenCalledWith({ ...q, status: 'confirmed' });
    // Totals ignore the status filter: they describe the whole range.
    expect(mocks.transactionTotals).toHaveBeenCalledWith({ dateFrom: q.dateFrom, dateTo: q.dateTo });
  });

  it('never reads data when the gate fails', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(adminListTransactions(q)).rejects.toThrow('Unauthorized');
    expect(mocks.searchTransactions).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    await expect(adminListTransactions({ ...q, dateFrom: '2026-10-05' })).rejects.toThrow('Invalid query');
    await expect(adminListTransactions({ ...q, status: 'expired' })).rejects.toThrow('Invalid query');
    expect(mocks.searchTransactions).not.toHaveBeenCalled();
  });
});

describe('adminBcvHistoryPage', () => {
  beforeEach(() => mocks.listBcvHistory.mockReset());

  it('asks for row page*pageSize+1 as a 1-row page when the page is full', async () => {
    const page = Array.from({ length: 10 }, (_, i) => bcv(20 - i, 37));
    mocks.listBcvHistory
      .mockResolvedValueOnce({ rows: page, total: 25 })
      .mockResolvedValueOnce({ rows: [bcv(10, 36.63)], total: 25 });
    const res = await adminBcvHistoryPage({ page: 2, pageSize: 10 });
    expect(mocks.listBcvHistory).toHaveBeenNthCalledWith(1, { page: 2, pageSize: 10 });
    expect(mocks.listBcvHistory).toHaveBeenNthCalledWith(2, { page: 21, pageSize: 1 });
    expect(res.total).toBe(25);
    expect(res.rows[0].variationPct).toBe(0);
    expect(res.rows[9].variationPct).toBeCloseTo(((37 - 36.63) / 36.63) * 100, 10);
  });

  it('does not look further on the last (short) page: the oldest row has no variation', async () => {
    mocks.listBcvHistory.mockResolvedValueOnce({ rows: [bcv(2, 37), bcv(1, 36.5)], total: 12 });
    const res = await adminBcvHistoryPage({ page: 2, pageSize: 10 });
    expect(mocks.listBcvHistory).toHaveBeenCalledTimes(1);
    expect(res.rows[1].variationPct).toBeNull();
  });

  it('gates on any admin and validates paging', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(adminBcvHistoryPage({ page: 1, pageSize: 10 })).rejects.toThrow('Unauthorized');
    mocks.requireAdmin.mockResolvedValue(OWNER);
    await expect(adminBcvHistoryPage({ page: 0, pageSize: 10 })).rejects.toThrow('Invalid page');
  });
});

describe('adminSearchAudit', () => {
  it('requires the owner role', async () => {
    mocks.searchAudit.mockResolvedValue({ rows: [], total: 0 });
    await adminSearchAudit({ page: 1, pageSize: 10 });
    expect(mocks.requireAdmin).toHaveBeenCalledWith({ role: 'owner' });
  });

  it('never reads the log for an operator', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Forbidden'));
    await expect(adminSearchAudit({ page: 1, pageSize: 10 })).rejects.toThrow('Forbidden');
    expect(mocks.searchAudit).not.toHaveBeenCalled();
  });

  it('passes a valid action filter and rejects unknown ones', async () => {
    mocks.searchAudit.mockResolvedValue({ rows: [], total: 0 });
    await adminSearchAudit({ action: 'role.upsert', page: 2, pageSize: 25 });
    expect(mocks.searchAudit).toHaveBeenCalledWith({ action: 'role.upsert', page: 2, pageSize: 25 });
    await expect(adminSearchAudit({ action: 'evil', page: 1, pageSize: 10 })).rejects.toThrow('Invalid query');
  });
});
