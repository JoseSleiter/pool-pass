import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));
vi.mock('@/lib/db/admin-roles', () => ({
  getAdminRole: vi.fn(async () => null),
}));

import { requireAdmin } from './require-admin';
import { getAdminRole } from '@/lib/db/admin-roles';

const ADMIN_EMAIL = 'admin@club.com';
process.env.ADMIN_EMAILS = ADMIN_EMAIL;

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminRole).mockResolvedValue(null);
  });

  it('throws Unauthorized when there is no session', async () => {
    mockUser = null;
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
    expect(getAdminRole).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the session email is not on the allowlist', async () => {
    mockUser = { id: 'u1', email: 'intruder@evil.com' };
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
    expect(getAdminRole).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the session has no email', async () => {
    mockUser = { id: 'u1' };
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
  });

  it('treats an allowlisted email without a role row as owner', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    await expect(requireAdmin()).resolves.toEqual({ email: ADMIN_EMAIL, role: 'owner' });
    expect(getAdminRole).toHaveBeenCalledWith(ADMIN_EMAIL);
  });

  it('returns the lowercased email and looks the role up lowercased', async () => {
    mockUser = { id: 'u1', email: 'Admin@Club.com' };
    await expect(requireAdmin()).resolves.toEqual({ email: ADMIN_EMAIL, role: 'owner' });
    expect(getAdminRole).toHaveBeenCalledWith(ADMIN_EMAIL);
  });

  it('returns the stored role (operator)', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(requireAdmin()).resolves.toEqual({ email: ADMIN_EMAIL, role: 'operator' });
  });

  it('throws Forbidden when owner is required and the role is operator', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    vi.mocked(getAdminRole).mockResolvedValue('operator');
    await expect(requireAdmin({ role: 'owner' })).rejects.toThrow('Forbidden');
  });

  it('passes the owner requirement for the default (no row) owner', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    await expect(requireAdmin({ role: 'owner' })).resolves.toEqual({ email: ADMIN_EMAIL, role: 'owner' });
  });

  it('fails closed when the role lookup errors', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    vi.mocked(getAdminRole).mockRejectedValue(new Error('db down'));
    await expect(requireAdmin()).rejects.toThrow('db down');
  });
});
