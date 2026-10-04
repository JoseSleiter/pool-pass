// src/app/admin/(dashboard)/layout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/components/admin/topbar-data', () => ({ loadShellStatus: vi.fn() }));
vi.mock('@/components/admin/admin-shell', () => ({ AdminShell: () => null }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

import AdminDashboardLayout from './layout';
import { requireAdmin } from '@/lib/auth/require-admin';
import { loadShellStatus } from '@/components/admin/topbar-data';
import { AdminShell } from '@/components/admin/admin-shell';
import { redirect } from 'next/navigation';

const status = { bcv: null, pendingCount: 0, today: '2026-10-04' };

describe('AdminDashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadShellStatus).mockResolvedValue(status);
  });

  it('passes {email, role} from requireAdmin and the shell status', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ email: 'op@club.com', role: 'operator' });
    const el = await AdminDashboardLayout({ children: 'x' });
    expect(el.type).toBe(AdminShell);
    expect(el.props).toMatchObject({ user: { email: 'op@club.com', role: 'operator' }, status, children: 'x' });
  });

  it.each(['Unauthorized', 'Forbidden'])('redirects to the login on %s', async (message) => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error(message));
    await expect(AdminDashboardLayout({ children: 'x' })).rejects.toThrow('REDIRECT:/admin/login');
    expect(loadShellStatus).not.toHaveBeenCalled();
  });

  it('fails closed on any other error', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('role lookup failed'));
    await expect(AdminDashboardLayout({ children: 'x' })).rejects.toThrow('role lookup failed');
    expect(redirect).not.toHaveBeenCalled();
  });
});
