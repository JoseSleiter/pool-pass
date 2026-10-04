// src/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
let mockUser: { email: string } | null = null;
let rotateSession = false;

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (cookies: CookieToSet[]) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        if (rotateSession) opts.cookies.setAll([{ name: 'sb-token', value: 'fresh', options: { path: '/' } }]);
        return { data: { user: mockUser } };
      },
    },
  }),
}));

import { middleware } from './middleware';

process.env.ADMIN_EMAILS = 'boss@club.com';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';

const FORWARDED_SCOPE = 'x-middleware-request-x-pp-scope';

describe('middleware', () => {
  beforeEach(() => {
    mockUser = null;
    rotateSession = false;
  });

  it('marks /admin/login as admin scope for the root layout', async () => {
    const res = await middleware(new NextRequest('http://localhost/admin/login'));
    expect(res.status).toBe(200);
    expect(res.headers.get(FORWARDED_SCOPE)).toBe('admin');
  });

  it('overrides a scope header sent by the client', async () => {
    const req = new NextRequest('http://localhost/admin/login', { headers: { 'x-pp-scope': 'spoofed' } });
    const res = await middleware(req);
    expect(res.headers.get(FORWARDED_SCOPE)).toBe('admin');
  });

  it('keeps the scope and the refreshed session cookie when Supabase rotates it', async () => {
    mockUser = { email: 'boss@club.com' };
    rotateSession = true;
    const res = await middleware(new NextRequest('http://localhost/admin'));
    expect(res.headers.get(FORWARDED_SCOPE)).toBe('admin');
    expect(res.headers.get('x-middleware-request-cookie')).toContain('sb-token=fresh');
    expect(res.cookies.get('sb-token')?.value).toBe('fresh');
  });

  it('still redirects non-admins to the login with next', async () => {
    mockUser = { email: 'guest@example.com' };
    const res = await middleware(new NextRequest('http://localhost/admin/settings'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/admin/login?next=%2Fadmin%2Fsettings');
  });
});
