import { describe, it, expect } from 'vitest';
import { todayState, remainingOn } from './availability';

describe('todayState', () => {
  it.each([
    [80, 100, 'open'],
    [20, 100, 'open'], // exactly 20 % is not "below 20 %"
    [19, 100, 'low'],
    [1, 100, 'low'],
    [1, 6, 'low'], // 1 < 1.2
    [1, 5, 'open'], // 1 < 1 is false
    [0, 100, 'soldOut'],
    [0, 0, 'soldOut'], // closed day (override capacity 0)
  ] as const)('remaining %i of %i → %s', (remaining, capacity, expected) => {
    expect(todayState(remaining, capacity)).toBe(expected);
  });
});

describe('remainingOn', () => {
  const availability = { '2030-01-10': 7, '2030-01-11': 0 };

  it('returns the computed remaining slots when the day is listed', () => {
    expect(remainingOn('2030-01-10', availability, 100)).toBe(7);
    expect(remainingOn('2030-01-11', availability, 100)).toBe(0);
  });

  it('falls back to the default capacity for untouched days', () => {
    expect(remainingOn('2030-01-12', availability, 100)).toBe(100);
  });

  it('is undefined for untouched days when the default capacity is unknown', () => {
    expect(remainingOn('2030-01-12', availability)).toBeUndefined();
  });
});
