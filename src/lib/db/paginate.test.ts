import { describe, it, expect } from 'vitest';
import { pageRange } from './paginate';

describe('pageRange', () => {
  it('maps a 1-based page to an inclusive PostgREST range', () => {
    expect(pageRange(1, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(3, 25)).toEqual({ from: 50, to: 74 });
  });

  it('accepts the max page size (100)', () => {
    expect(pageRange(2, 100)).toEqual({ from: 100, to: 199 });
  });

  it('rejects page < 1 or non-integer pages', () => {
    expect(() => pageRange(0, 10)).toThrow(RangeError);
    expect(() => pageRange(1.5, 10)).toThrow(RangeError);
  });

  it('rejects page sizes outside 1–100', () => {
    expect(() => pageRange(1, 0)).toThrow(RangeError);
    expect(() => pageRange(1, 101)).toThrow(RangeError);
    expect(() => pageRange(1, 2.5)).toThrow(RangeError);
  });
});
