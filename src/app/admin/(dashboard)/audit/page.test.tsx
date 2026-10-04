// src/app/admin/(dashboard)/audit/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), adminSearchAudit: vi.fn() }));

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/app/admin/finance-actions', () => ({ adminSearchAudit: mocks.adminSearchAudit }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import AuditPage from './page';

const entry = (id: number) => ({
  id, at: '2026-10-04T14:05:00Z', actor_email: 'dueno@club.com', action: 'role.upsert',
  target: 'ops@club.com', details: { role: 'operator' },
});

async function renderPage(sp: Record<string, string | string[] | undefined> = {}) {
  render(await AuditPage({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: 'dueno@club.com', role: 'owner' });
  mocks.adminSearchAudit.mockResolvedValue({ rows: [], total: 0 });
});

describe('/admin/audit', () => {
  it('shows operators a friendly notice and never reads the log', async () => {
    mocks.requireAdmin.mockResolvedValue({ email: 'ops@club.com', role: 'operator' });
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeInTheDocument();
    expect(screen.getByText('Solo el dueño puede ver la auditoría.')).toBeInTheDocument();
    expect(mocks.adminSearchAudit).not.toHaveBeenCalled();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('propagates auth failures (fail closed)', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('Unauthorized');
    expect(mocks.adminSearchAudit).not.toHaveBeenCalled();
  });

  it('owners get the log filtered and paginated from the URL', async () => {
    await renderPage({ action: 'role.upsert', page: '2', pageSize: '25' });
    expect(mocks.adminSearchAudit).toHaveBeenCalledWith({ action: 'role.upsert', page: 2, pageSize: 25 });
  });

  it('drops an unknown action filter', async () => {
    await renderPage({ action: 'evil' });
    expect(mocks.adminSearchAudit).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('shows an empty state without pagination', async () => {
    await renderPage();
    expect(screen.getByText('No hay acciones registradas')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
  });

  it('renders entries with pagination links that keep the action', async () => {
    mocks.adminSearchAudit.mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => entry(i + 1)), total: 12 });
    await renderPage({ action: 'role.upsert' });
    expect(within(screen.getByRole('table')).getAllByText('Rol de acceso asignado')).toHaveLength(10);
    expect(within(screen.getByRole('navigation', { name: /paginación/i }))
      .getByRole('link', { name: 'Página 2' }))
      .toHaveAttribute('href', '/admin/audit?action=role.upsert&page=2&pageSize=10');
  });
});
