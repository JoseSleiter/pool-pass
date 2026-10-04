import { describe, it, expect } from 'vitest';
import {
  searchTerms, termPattern, parseReservationQuery, pageRange, SORT_COLUMNS, DEFAULT_SORT,
} from './reservation-search';

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

describe('parseReservationQuery', () => {
  const base = { page: 1, pageSize: 10 };

  it('accepts the minimal query', () => {
    expect(parseReservationQuery(base)).toEqual({ page: 1, pageSize: 10 });
  });

  it('accepts a full query and dedupes statuses', () => {
    expect(parseReservationQuery({
      dateFrom: '2030-01-01', dateTo: '2030-01-31',
      statuses: ['failed', 'expired', 'failed'],
      q: '  Ana  ', guestType: 'family',
      sort: { by: 'name', dir: 'asc' },
      page: 3, pageSize: 50,
    })).toEqual({
      dateFrom: '2030-01-01', dateTo: '2030-01-31',
      statuses: ['failed', 'expired'],
      q: 'Ana', guestType: 'family',
      sort: { by: 'name', dir: 'asc' },
      page: 3, pageSize: 50,
    });
  });

  it('coerces numeric strings coming from URL params', () => {
    expect(parseReservationQuery({ page: '2', pageSize: '25' })).toEqual({ page: 2, pageSize: 25 });
  });

  it('normalizes a blank q and an empty statuses list to undefined', () => {
    const r = parseReservationQuery({ ...base, q: '   ', statuses: [] });
    expect(r?.q).toBeUndefined();
    expect(r?.statuses).toBeUndefined();
  });

  it.each([
    ['missing page', { pageSize: 10 }],
    ['page 0', { page: 0, pageSize: 10 }],
    ['fractional page', { page: 1.5, pageSize: 10 }],
    ['pageSize not in 10/25/50', { page: 1, pageSize: 20 }],
    ['malformed date', { ...base, dateFrom: '2030-1-5' }],
    ['impossible date', { ...base, dateTo: '2030-02-30' }],
    ['dateFrom after dateTo', { ...base, dateFrom: '2030-02-01', dateTo: '2030-01-01' }],
    ['unknown status', { ...base, statuses: ['cancelled'] }],
    ['unknown guestType', { ...base, guestType: 'group' }],
    ['sort column outside whitelist', { ...base, sort: { by: 'email', dir: 'asc' } }],
    ['sort dir outside whitelist', { ...base, sort: { by: 'date', dir: 'up' } }],
    ['q longer than 100 chars', { ...base, q: 'a'.repeat(101) }],
    ['not an object', 'page=1'],
    ['null', null],
  ])('rejects %s', (_label, raw) => {
    expect(parseReservationQuery(raw)).toBeNull();
  });
});

describe('pageRange', () => {
  it('maps a 1-based page to an inclusive row range', () => {
    expect(pageRange(1, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(3, 25)).toEqual({ from: 50, to: 74 });
  });
});

describe('sort whitelist', () => {
  it('maps every sort key to real columns', () => {
    expect(SORT_COLUMNS).toEqual({
      date: ['date', 'created_at'],
      code: ['code'],
      name: ['last_name', 'first_name'],
      guests: ['party_size'],
      total_usd: ['total_usd'],
      status: ['status'],
    });
  });

  it('defaults to newest visit date first', () => {
    expect(DEFAULT_SORT).toEqual({ by: 'date', dir: 'desc' });
  });
});
