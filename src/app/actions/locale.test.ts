import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { cookies } from 'next/headers';
import { setLocale } from './locale';

const set = vi.fn();

describe('setLocale', () => {
  beforeEach(() => {
    set.mockReset();
    vi.mocked(cookies).mockResolvedValue({ set } as never);
  });

  it('stores the locale in the pp_lang cookie for a year', async () => {
    await setLocale('en');
    expect(set).toHaveBeenCalledWith(
      'pp_lang',
      'en',
      expect.objectContaining({ path: '/', maxAge: 31_536_000, sameSite: 'lax', httpOnly: true })
    );
  });

  it('ignores values that are not a supported locale (server actions are public)', async () => {
    await setLocale('fr' as never);
    await setLocale({ evil: true } as never);
    expect(set).not.toHaveBeenCalled();
  });
});
