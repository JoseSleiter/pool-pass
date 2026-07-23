import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseBookingParams } from './search-params';

function freezeToday(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T12:00:00-04:00`));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('parseBookingParams', () => {
  it('defaults to today / 2 adults / 1 child when params are absent', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({})).toEqual({ date: '2026-07-20', adults: 2, children: 1 });
  });

  it('keeps a valid future date', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2026-08-01' }).date).toBe('2026-08-01');
  });

  it('keeps today itself', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2026-07-20' }).date).toBe('2026-07-20');
  });

  it('clamps a past date to today', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2020-01-01' }).date).toBe('2026-07-20');
  });

  it('falls back to today on a malformed date', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: 'not-a-date' }).date).toBe('2026-07-20');
  });

  it('clamps adults/children into [0, 20]', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '99', children: '-5' })).toMatchObject({ adults: 20, children: 0 });
  });

  it('parses valid integer counts', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '3', children: '0' })).toMatchObject({ adults: 3, children: 0 });
  });

  it('falls back to defaults on non-integer counts', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '2.5', children: 'x' })).toMatchObject({ adults: 2, children: 1 });
  });

  it('falls back to today on a shape-valid but impossible date', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ date: '2026-13-45' }).date).toBe('2026-07-20');
    expect(parseBookingParams({ date: '2026-02-30' }).date).toBe('2026-07-20');
  });

  it('falls back to defaults on empty-string counts', () => {
    freezeToday('2026-07-20');
    expect(parseBookingParams({ adults: '', children: '' })).toMatchObject({ adults: 2, children: 1 });
  });
});
