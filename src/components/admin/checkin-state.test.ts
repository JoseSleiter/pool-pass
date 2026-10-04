import { describe, it, expect } from 'vitest';
import { classifyCheckin, INVALID_REASON_TEXT } from './checkin-state';
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
