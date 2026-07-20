import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockUser: { id: string; email?: string } | null = null;

vi.mock('@/lib/db/ssr-client', () => ({
  ssrClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
}));

import { requireAdmin } from './require-admin';

const ADMIN_EMAIL = 'admin@club.com';
process.env.ADMIN_EMAILS = ADMIN_EMAIL;

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws Unauthorized when there is no session', async () => {
    mockUser = null;
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
  });

  it('throws Unauthorized when the session email is not on the allowlist', async () => {
    mockUser = { id: 'u1', email: 'intruder@evil.com' };
    await expect(requireAdmin()).rejects.toThrow('Unauthorized');
  });

  it('resolves for an allowlisted admin email', async () => {
    mockUser = { id: 'u1', email: ADMIN_EMAIL };
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
