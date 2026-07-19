import { describe, it, expect, vi } from 'vitest';
import { isValidRate, parseBcvHtml, firstSuccessfulRate, type RateSource } from './bcv';

describe('isValidRate', () => {
  it('accepts positive finite numbers', () => {
    expect(isValidRate(732.47)).toBe(true);
    expect(isValidRate(1)).toBe(true);
  });
  it('rejects zero, negatives, NaN and non-numbers', () => {
    expect(isValidRate(0)).toBe(false);
    expect(isValidRate(-5)).toBe(false);
    expect(isValidRate(NaN)).toBe(false);
    expect(isValidRate('732')).toBe(false);
    expect(isValidRate(null)).toBe(false);
    expect(isValidRate(undefined)).toBe(false);
  });
});

describe('parseBcvHtml', () => {
  it('parses the USD rate from the #dolar block (comma decimals)', () => {
    const html = `
      <div id="dolar" class="recuadrotsmc"><div class="row">
        <div class="col"><strong>USD</strong></div>
        <div class="col centrado"><strong> 732,47000000</strong></div>
      </div></div>`;
    expect(parseBcvHtml(html)).toBeCloseTo(732.47, 2);
  });

  it('handles thousands separators (VE format 1.234,56)', () => {
    const html = `<div id="dolar"><strong>USD</strong><strong>1.234,56</strong></div>`;
    expect(parseBcvHtml(html)).toBeCloseTo(1234.56, 2);
  });

  it('throws when the #dolar block is missing', () => {
    expect(() => parseBcvHtml('<html><body>no rate here</body></html>')).toThrow();
  });
});

describe('firstSuccessfulRate', () => {
  const ok = (name: string, rate: number): RateSource => ({ name, fetch: vi.fn(async () => rate) });
  const fail = (name: string): RateSource => ({ name, fetch: vi.fn(async () => { throw new Error(`${name} down`); }) });

  it('returns the first source that yields a valid rate', async () => {
    const s2 = ok('b', 700);
    const sources = [ok('a', 732), s2];
    expect(await firstSuccessfulRate(sources)).toBe(732);
    expect(s2.fetch).not.toHaveBeenCalled(); // short-circuits
  });

  it('falls through failing sources to the next working one', async () => {
    expect(await firstSuccessfulRate([fail('a'), fail('b'), ok('c', 715)])).toBe(715);
  });

  it('skips a source that returns an invalid rate', async () => {
    expect(await firstSuccessfulRate([ok('a', 0), ok('b', 720)])).toBe(720);
  });

  it('throws with all source errors when every source fails', async () => {
    await expect(firstSuccessfulRate([fail('a'), fail('b')])).rejects.toThrow(/a down[\s\S]*b down/);
  });
});
