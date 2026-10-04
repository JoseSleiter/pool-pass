// src/app/admin/(dashboard)/finance/bcv/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ adminBcvHistoryPage: vi.fn() }));

vi.mock('@/app/admin/finance-actions', () => ({ adminBcvHistoryPage: mocks.adminBcvHistoryPage }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import BcvPage from './page';

const row = (id: number, rate: number) => ({
  id, rate, source: 'auto', fetched_at: '2026-10-04T13:00:00Z', variationPct: null,
});

async function renderPage(sp: Record<string, string | string[] | undefined>) {
  render(await BcvPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminBcvHistoryPage.mockResolvedValue({ rows: [], total: 0 });
});

describe('/admin/finance/bcv', () => {
  it('parses paging from the URL', async () => {
    await renderPage({ page: '3', pageSize: '25' });
    expect(mocks.adminBcvHistoryPage).toHaveBeenCalledWith({ page: 3, pageSize: 25 });
    expect(screen.getByRole('heading', { level: 1, name: 'Tasas BCV' })).toBeInTheDocument();
  });

  it('shows an empty state without pagination when nothing was recorded', async () => {
    await renderPage({});
    expect(mocks.adminBcvHistoryPage).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByText('Aún no hay tasas registradas')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
  });

  it('renders the sparkline, the list and pagination', async () => {
    mocks.adminBcvHistoryPage.mockResolvedValue({
      rows: Array.from({ length: 10 }, (_, i) => row(30 - i, 36 + i / 10)),
      total: 30,
    });
    await renderPage({});
    expect(screen.getByTestId('bcv-sparkline')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('Mostrando 1–10 de 30 registros')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: /paginación/i }))
      .getByRole('link', { name: 'Página 2' })).toHaveAttribute('href', '/admin/finance/bcv?page=2&pageSize=10');
  });
});
