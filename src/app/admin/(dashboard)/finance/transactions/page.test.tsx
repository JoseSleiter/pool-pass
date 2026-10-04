// src/app/admin/(dashboard)/finance/transactions/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TransactionRow } from '@/lib/finance/transactions';

const mocks = vi.hoisted(() => ({ adminListTransactions: vi.fn() }));

vi.mock('@/app/admin/finance-actions', () => ({ adminListTransactions: mocks.adminListTransactions }));
vi.mock('@/lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dates')>()),
  todayCaracas: () => '2026-10-04',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import TransactionsPage from './page';

const zeroTotals = { collectedUsd: 0, collectedVes: 0, collectedCount: 0, pendingUsd: 0, pendingCount: 0 };

function tx(i: number): TransactionRow {
  return {
    id: `r${i}`, code: `PP-AAA${i}${i}`, first_name: 'Ana', last_name: 'Pérez',
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
    payment_ref: `C2P-${i}`, checked_in_at: null, created_at: '2026-10-04T14:05:00Z',
  };
}

async function renderPage(sp: Record<string, string | string[] | undefined>) {
  render(await TransactionsPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminListTransactions.mockResolvedValue({ rows: [], total: 0, totals: zeroTotals });
});

describe('/admin/finance/transactions', () => {
  it('defaults to the last 30 Caracas days, page 1 of 10', async () => {
    await renderPage({});
    expect(mocks.adminListTransactions).toHaveBeenCalledWith({
      dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Transacciones C2P' })).toBeInTheDocument();
  });

  it('passes parsed filters and paging to the action', async () => {
    await renderPage({ from: '2026-09-01', to: '2026-09-30', status: 'pending_payment', page: '2', pageSize: '25' });
    expect(mocks.adminListTransactions).toHaveBeenCalledWith({
      dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'pending_payment', page: 2, pageSize: 25,
    });
  });

  it('shows an empty state and no pagination when the range has no transactions', async () => {
    await renderPage({});
    expect(screen.getByText('No hay transacciones en este rango')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    // Totals are still shown (all zeros) so the range is explicit.
    expect(screen.getByRole('region', { name: 'Totales del rango' })).toBeInTheDocument();
  });

  it('renders rows, totals and pagination links that keep the filters', async () => {
    mocks.adminListTransactions.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, i) => tx(i)),
      total: 25,
      totals: { collectedUsd: 350, collectedVes: 12775, collectedCount: 10, pendingUsd: 0, pendingCount: 0 },
    });
    await renderPage({ from: '2026-09-01', to: '2026-09-30', status: 'confirmed' });

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    expect(within(screen.getByTestId('totals-collected')).getByText('$350.00')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–10 de 25 transacciones')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /paginación/i });
    expect(within(nav).getByRole('link', { name: 'Página 2' })).toHaveAttribute(
      'href',
      '/admin/finance/transactions?from=2026-09-01&to=2026-09-30&status=confirmed&page=2&pageSize=10',
    );
  });

  it('explains an out-of-range page instead of looking empty', async () => {
    mocks.adminListTransactions.mockResolvedValue({ rows: [], total: 25, totals: zeroTotals });
    await renderPage({ page: '9' });
    expect(screen.getByText('Esta página no tiene resultados')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });
});
