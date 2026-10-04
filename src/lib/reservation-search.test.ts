import { describe, it, expect } from 'vitest';
import { searchTerms, termPattern } from './reservation-search';

describe('searchTerms', () => {
  it('returns no terms for empty / whitespace / undefined input', () => {
    expect(searchTerms(undefined)).toEqual([]);
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('splits on whitespace, lowercases and strips accents', () => {
    expect(searchTerms('  Ana   Pérez ')).toEqual(['ana', 'perez']);
    expect(searchTerms('PÉREZ')).toEqual(['perez']);
    expect(searchTerms('pérez')).toEqual(['perez']);
    expect(searchTerms('Núñez Gómez')).toEqual(['nunez', 'gomez']);
  });

  it('normalizes decomposed (NFD) input the same as composed', () => {
    expect(searchTerms('Pérez')).toEqual(['perez']);
  });

  it('keeps reservation codes and apostrophes intact (lowercased)', () => {
    expect(searchTerms('PP-AB12C')).toEqual(['pp-ab12c']);
    expect(searchTerms("O'Brien")).toEqual(["o'brien"]);
  });

  it('collapses dotted id numbers and drops a V-/E-/P-/J- prefix', () => {
    expect(searchTerms('12.345.678')).toEqual(['12345678']);
    expect(searchTerms('V-12345678')).toEqual(['12345678']);
    expect(searchTerms('j-1234567')).toEqual(['1234567']);
  });

  it('turns PostgREST and LIKE metacharacters into separators', () => {
    expect(searchTerms('a,status.eq.failed')).toEqual(['a', 'status', 'eq', 'failed']);
    expect(searchTerms('x)or(y')).toEqual(['x', 'or', 'y']);
    expect(searchTerms('100%_*"\\:')).toEqual(['100']);
  });

  it('drops terms made only of punctuation', () => {
    expect(searchTerms("Ana - ' Pérez")).toEqual(['ana', 'perez']);
  });

  it('keeps at most 5 terms', () => {
    expect(searchTerms('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('termPattern', () => {
  it('wraps the term in substring wildcards', () => {
    expect(termPattern('ana')).toBe('%ana%');
  });
});
