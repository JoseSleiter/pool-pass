import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE, ariaSort, lastPage, parseReservationsParams, parseReservationsState,
  reservationsHref, sortHref, stateToParams, type ReservationsState,
} from './search-params';

const S = (over: Partial<ReservationsState> = {}): ReservationsState => ({ ...DEFAULT_STATE, ...over });

describe('parseReservationsState', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseReservationsState({})).toEqual(DEFAULT_STATE);
    expect(DEFAULT_STATE).toEqual({
      q: '', statuses: [], from: '', to: '', guest: '', sort: 'date', dir: 'desc', page: 1, pageSize: 10,
    });
  });

  it('reads every supported param', () => {
    expect(parseReservationsState({
      q: '  ana  ', status: 'confirmed', from: '2030-01-01', to: '2030-01-31', guest: 'family',
      sort: 'total_usd', dir: 'desc', page: '3', pageSize: '25',
    })).toEqual(S({
      q: 'ana', statuses: ['confirmed'], from: '2030-01-01', to: '2030-01-31', guest: 'family',
      sort: 'total_usd', dir: 'desc', page: 3, pageSize: 25,
    }));
  });

  it('accepts status as csv or repeated, deduped in canonical order', () => {
    expect(parseReservationsState({ status: 'expired,failed' }).statuses).toEqual(['failed', 'expired']);
    expect(parseReservationsState({ status: ['checked_in', 'pending_payment', 'checked_in'] }).statuses)
      .toEqual(['pending_payment', 'checked_in']);
  });

  it('drops unknown statuses', () => {
    expect(parseReservationsState({ status: 'confirmed,bogus' }).statuses).toEqual(['confirmed']);
  });

  it('falls back to defaults for every invalid value', () => {
    expect(parseReservationsState({
      from: '2030-02-30', to: 'mañana', guest: 'vip', sort: 'email', dir: 'up', page: '-2', pageSize: '30',
    })).toEqual(DEFAULT_STATE);
  });

  it('ignores a reversed date range', () => {
    const s = parseReservationsState({ from: '2030-02-01', to: '2030-01-01' });
    expect([s.from, s.to]).toEqual(['', '']);
  });

  it('rejects non-integer and out-of-range pages', () => {
    for (const page of ['1.5', '0', '10001', 'abc', '']) {
      expect(parseReservationsState({ page }).page).toBe(1);
    }
    expect(parseReservationsState({ page: '10000' }).page).toBe(10000);
  });

  it('defaults the direction per column', () => {
    expect(parseReservationsState({ sort: 'name' }).dir).toBe('asc');
    expect(parseReservationsState({ sort: 'date' }).dir).toBe('desc');
  });

  it('uses the first value of repeated scalar params and caps q at 100 chars', () => {
    expect(parseReservationsState({ q: ['ana', 'luis'] }).q).toBe('ana');
    expect(parseReservationsState({ q: 'a'.repeat(150) }).q).toHaveLength(100);
  });
});

describe('parseReservationsParams', () => {
  it('produces the zod-validated query for searchReservations', () => {
    expect(parseReservationsParams({
      q: 'ana', status: 'failed,expired', from: '2030-01-01', guest: 'individual', sort: 'name', page: '2', pageSize: '50',
    }).query).toEqual({
      q: 'ana', statuses: ['failed', 'expired'], dateFrom: '2030-01-01', guestType: 'individual',
      sort: { by: 'name', dir: 'asc' }, page: 2, pageSize: 50,
    });
  });

  it('never throws on garbage: defaults state and query', () => {
    const { state, query } = parseReservationsParams({ page: 'NaN', pageSize: '1e9', status: ',,,', sort: '__proto__' });
    expect(state).toEqual(DEFAULT_STATE);
    expect(query).toEqual({ sort: { by: 'date', dir: 'desc' }, page: 1, pageSize: 10 });
  });
describe('stateToParams / reservationsHref', () => {
  it('is the bare path for the default state', () => {
    expect(stateToParams(DEFAULT_STATE)).toEqual({});
    expect(reservationsHref(DEFAULT_STATE)).toBe('/admin/reservations');
  });

  it('serializes non-default values and resets the page on any other change', () => {
    expect(reservationsHref(S({ page: 4, pageSize: 25 }), { statuses: ['failed', 'expired'] }))
      .toBe('/admin/reservations?status=failed%2Cexpired&pageSize=25');
  });

  it('keeps an explicit page', () => {
    expect(reservationsHref(S(), { page: 3 })).toBe('/admin/reservations?page=3');
  });

  it('round-trips through the parser', () => {
    const state = S({
      q: 'josé', statuses: ['confirmed'], from: '2030-01-01', to: '2030-01-02', guest: 'family',
      sort: 'code', dir: 'asc', page: 2, pageSize: 50,
    });
    const url = new URL(reservationsHref(state, { page: 2 }), 'http://x');
    expect(parseReservationsState(Object.fromEntries(url.searchParams))).toEqual(state);
  });
});

describe('sortHref / ariaSort', () => {
  it('flips the direction of the active column', () => {
    expect(sortHref(S({ sort: 'name', dir: 'asc' }), 'name')).toBe('/admin/reservations?sort=name&dir=desc');
  });

  it('uses the column default for a new column and goes back to page 1', () => {
    expect(sortHref(S({ page: 5 }), 'total_usd')).toBe('/admin/reservations?sort=total_usd&dir=asc');
    expect(sortHref(S({ sort: 'code', dir: 'asc' }), 'date')).toBe('/admin/reservations');
  });

  it('exposes aria-sort only on the active column', () => {
    expect(ariaSort(DEFAULT_STATE, 'date')).toBe('descending');
    expect(ariaSort(S({ sort: 'code', dir: 'asc' }), 'code')).toBe('ascending');
    expect(ariaSort(DEFAULT_STATE, 'code')).toBe('none');
  });
});

describe('lastPage', () => {
  it('is at least 1', () => {
    expect(lastPage(0, 10)).toBe(1);
    expect(lastPage(10, 10)).toBe(1);
    expect(lastPage(11, 10)).toBe(2);
    expect(lastPage(142, 25)).toBe(6);
  });
});
});
