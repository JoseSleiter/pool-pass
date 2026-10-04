import { describe, it, expect } from 'vitest';
import {
  isIsoDate, occupancyLevel, occupancyPercent, parseDayParam, shiftIsoDate,
} from './day-metrics';

describe('occupancyPercent', () => {
  it('is the rounded whole percent of capacity in use', () => {
    expect(occupancyPercent(0, 100)).toBe(0);
    expect(occupancyPercent(45, 100)).toBe(45);
    expect(occupancyPercent(1, 3)).toBe(33);
    expect(occupancyPercent(141, 200)).toBe(71); // 70.5 rounds up
  });

  it('can exceed 100 when the day is overbooked', () => {
    expect(occupancyPercent(120, 100)).toBe(120);
  });

  it('is null for a closed day (capacity 0 or less)', () => {
    expect(occupancyPercent(0, 0)).toBeNull();
    expect(occupancyPercent(3, 0)).toBeNull();
  });
});

describe('occupancyLevel (roadmap §2 bands)', () => {
  it.each<[number, string]>([
    [0, 'normal'],
    [70, 'normal'],
    [71, 'high'],
    [90, 'high'],
    [91, 'peak'],
    [100, 'peak'],
    [130, 'peak'],
  ])('%i %% → %s', (pct, level) => {
    expect(occupancyLevel(pct)).toBe(level);
  });
});

describe('isIsoDate', () => {
  it('accepts real calendar dates in YYYY-MM-DD', () => {
    expect(isIsoDate('2030-01-15')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate('hoy')).toBe(false);
    expect(isIsoDate('2030-1-15')).toBe(false);
    expect(isIsoDate('2030-02-31')).toBe(false);
    expect(isIsoDate('2029-02-29')).toBe(false);
    expect(isIsoDate('2030-01-15T00:00:00Z')).toBe(false);
  });
});

describe('shiftIsoDate', () => {
  it('moves by whole days across month and year boundaries', () => {
    expect(shiftIsoDate('2030-01-15', -1)).toBe('2030-01-14');
    expect(shiftIsoDate('2030-01-15', 1)).toBe('2030-01-16');
    expect(shiftIsoDate('2030-03-01', -1)).toBe('2030-02-28');
    expect(shiftIsoDate('2030-12-31', 1)).toBe('2031-01-01');
  });
});

describe('parseDayParam', () => {
  it('keeps a valid ?date= value', () => {
    expect(parseDayParam('2030-01-15', '2030-06-01')).toBe('2030-01-15');
  });

  it('falls back to today for missing, invalid or repeated params', () => {
    expect(parseDayParam(undefined, '2030-06-01')).toBe('2030-06-01');
    expect(parseDayParam('2030-02-31', '2030-06-01')).toBe('2030-06-01');
    expect(parseDayParam(['2030-01-15', '2030-01-16'], '2030-06-01')).toBe('2030-06-01');
  });
});
