import { describe, it, expect } from 'vitest';
import { classifyCheckin, INVALID_REASON_TEXT, caracasTime12, reservationDateEs } from './checkin-state';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';

function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-AAAAA', date: TODAY,
    first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com',
    id_type: 'V', id_number: '12345678', adults: 2, children: 1,
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5,
    status: 'confirmed', payment_ref: 'REF-1', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z',
    ...over,
  };
}

describe('classifyCheckin', () => {
  it('confirmed reservation for today is valid', () => {
    expect(classifyCheckin(row(), TODAY)).toEqual({ kind: 'valid' });
  });

  it('confirmed reservation for another date is wrong-date and carries the real date', () => {
    expect(classifyCheckin(row({ date: '2030-01-20' }), TODAY)).toEqual({
      kind: 'wrong-date',
      date: '2030-01-20',
    });
  });

  it('checked-in reservation is already-in with its timestamp', () => {
    expect(
      classifyCheckin(row({ status: 'checked_in', checked_in_at: '2030-01-15T14:00:00Z' }), TODAY)
    ).toEqual({ kind: 'already-in', checkedInAt: '2030-01-15T14:00:00Z' });
  });

  it('already-in wins over wrong date', () => {
    expect(
      classifyCheckin(
        row({ status: 'checked_in', date: '2030-01-20', checked_in_at: '2030-01-20T14:00:00Z' }),
        TODAY
      )
    ).toEqual({ kind: 'already-in', checkedInAt: '2030-01-20T14:00:00Z' });
  });

  it('checked-in without timestamp keeps checkedInAt null', () => {
    expect(classifyCheckin(row({ status: 'checked_in' }), TODAY)).toEqual({
      kind: 'already-in',
      checkedInAt: null,
    });
  });

  it('missing reservation is invalid/not-found', () => {
    expect(classifyCheckin(null, TODAY)).toEqual({ kind: 'invalid', reason: 'not-found' });
  });

  it.each([
    ['pending_payment', 'pending'],
    ['failed', 'failed'],
    ['expired', 'expired'],
  ] as const)('status %s is invalid with reason %s (even on another date)', (status, reason) => {
    expect(classifyCheckin(row({ status }), TODAY)).toEqual({ kind: 'invalid', reason });
    expect(classifyCheckin(row({ status, date: '2030-01-20' }), TODAY)).toEqual({ kind: 'invalid', reason });
  });
});

describe('INVALID_REASON_TEXT', () => {
  it('has a distinct, non-empty line for every reason', () => {
    const lines = Object.values(INVALID_REASON_TEXT);
    expect(lines).toHaveLength(4);
    expect(new Set(lines).size).toBe(4);
    lines.forEach((l) => expect(l.length).toBeGreaterThan(10));
  });

  it('pending payment is called out explicitly', () => {
    expect(INVALID_REASON_TEXT.pending).toMatch(/^Pago pendiente/);
  });
});

describe('caracasTime12', () => {
  it.each([
    ['2030-01-15T14:00:00Z', '10:00 a. m.'], // UTC-4
    ['2030-01-15T23:05:00Z', '7:05 p. m.'],
    ['2030-01-15T16:30:00Z', '12:30 p. m.'], // noon is p. m.
    ['2030-01-15T04:15:00Z', '12:15 a. m.'], // midnight is 12, not 0
  ])('%s → %s', (iso, expected) => {
    expect(caracasTime12(iso)).toBe(expected);
  });
});

describe('reservationDateEs', () => {
  it('long Spanish date with weekday and year', () => {
    expect(reservationDateEs('2030-01-20')).toBe('domingo, 20 de enero de 2030');
  });

  it('does not shift the day near year end', () => {
    expect(reservationDateEs('2030-12-31')).toBe('martes, 31 de diciembre de 2030');
  });
});
