import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { cookies } from 'next/headers';
import { getLocale, getDictionary } from './index';
import { es } from './es';
import { en } from './en';

function withCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === 'pp_lang' && value !== undefined ? { name, value } : undefined,
  } as never);
}

describe('getLocale', () => {
  beforeEach(() => vi.mocked(cookies).mockReset());

  it('defaults to es when the cookie is missing', async () => {
    withCookie(undefined);
    await expect(getLocale()).resolves.toBe('es');
  });

  it('returns en when pp_lang=en', async () => {
    withCookie('en');
    await expect(getLocale()).resolves.toBe('en');
  });

  it.each(['fr', 'EN', '', 'es-VE'])('falls back to es for invalid value %j', async (value) => {
    withCookie(value);
    await expect(getLocale()).resolves.toBe('es');
  });
});

describe('getDictionary', () => {
  it('returns the dictionary for each locale', () => {
    expect(getDictionary('es')).toBe(es);
    expect(getDictionary('en')).toBe(en);
  });
});
