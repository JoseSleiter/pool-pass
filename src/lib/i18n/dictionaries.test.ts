import { describe, it, expect } from 'vitest';
import { es } from './es';
import { en } from './en';
import { isLocale, LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from './types';

/** Flattens a nested dictionary into { 'a.b.c': 'value' }. Non-string leaves are a bug. */
function leaves(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value !== null && typeof value === 'object') Object.assign(out, leaves(value, path));
    else throw new Error(`${path} must be a string or a nested object, got ${typeof value}`);
  }
  return out;
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

const esLeaves = leaves(es);
const enLeaves = leaves(en);

describe('dictionaries', () => {
  it('flattens nested keys (sanity check of the helper)', () => {
    expect(leaves({ a: { b: 'x', c: { d: 'y' } } })).toEqual({ 'a.b': 'x', 'a.c.d': 'y' });
  });

  it('en has exactly the same nested keys as es', () => {
    expect(Object.keys(enLeaves).sort()).toEqual(Object.keys(esLeaves).sort());
  });

  it('has no empty strings', () => {
    for (const [path, value] of Object.entries({ ...esLeaves, ...enLeaves })) {
      expect(value.trim(), path).not.toBe('');
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    for (const path of Object.keys(esLeaves)) {
      expect(placeholders(enLeaves[path]), path).toEqual(placeholders(esLeaves[path]));
    }
  });

  it('en is actually translated (no value copied verbatim from es)', () => {
    const copied = Object.keys(esLeaves).filter((p) => esLeaves[p] === enLeaves[p]);
    expect(copied).toEqual([]);
  });
});

describe('locale constants', () => {
  it('supports es and en with es as default and pp_lang as cookie', () => {
    expect(LOCALES).toEqual(['es', 'en']);
    expect(DEFAULT_LOCALE).toBe('es');
    expect(LOCALE_COOKIE).toBe('pp_lang');
  });

  it('isLocale accepts only the supported codes', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('en')).toBe(true);
    for (const bad of ['EN', 'fr', '', undefined, null, 1]) expect(isLocale(bad)).toBe(false);
  });
});
