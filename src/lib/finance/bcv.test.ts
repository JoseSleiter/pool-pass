// src/lib/finance/bcv.test.ts
import { describe, it, expect } from 'vitest';
import type { BcvHistoryRow } from '@/lib/bcv-history';
import {
  formatVariation, rateSummary, sourceLabel, sparklinePoints, variationPct, variationTrend, withVariation,
} from './bcv';

const row = (id: number, rate: number, source: string | null = 'auto'): BcvHistoryRow => ({
  id, rate, source, fetched_at: `2026-10-0${id}T13:00:00Z`,
});

describe('variationPct', () => {
  it('is the % change vs the previous (older) rate', () => {
    expect(variationPct(37, 36.5)).toBeCloseTo(1.369863, 5);
    expect(variationPct(36.5, 40)).toBeCloseTo(-8.75, 10);
    expect(variationPct(36.5, 36.5)).toBe(0);
  });

  it('is null without a usable previous rate', () => {
    expect(variationPct(37, null)).toBeNull();
    expect(variationPct(37, undefined)).toBeNull();
    expect(variationPct(37, 0)).toBeNull();
  });
});

describe('withVariation', () => {
  // Newest first, as listBcvHistory returns them.
  const rows = [row(3, 37), row(2, 36.5), row(1, 36.5)];

  it('compares each row with the next (older) one and the last with the older neighbour', () => {
    const out = withVariation(rows, row(9, 40));
    expect(out.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(out[0].variationPct).toBeCloseTo(1.369863, 5);
    expect(out[1].variationPct).toBe(0);
    expect(out[2].variationPct).toBeCloseTo(-8.75, 10);
  });

  it('leaves the oldest row of all (no neighbour) without variation', () => {
    const out = withVariation(rows, null);
    expect(out[2].variationPct).toBeNull();
  });

  it('handles an empty page', () => {
    expect(withVariation([], null)).toEqual([]);
  });
});

describe('formatVariation / variationTrend', () => {
  it('formats with sign and two decimals', () => {
    expect(formatVariation(1.369863)).toBe('+1.37 %');
    expect(formatVariation(-8.75)).toBe('-8.75 %');
  });

  it('shows 0.00 % without sign when it rounds to zero', () => {
    expect(formatVariation(0)).toBe('0.00 %');
    expect(formatVariation(0.004)).toBe('0.00 %');
    expect(formatVariation(-0.004)).toBe('0.00 %');
  });

  it('shows a dash for the first row', () => {
    expect(formatVariation(null)).toBe('—');
  });

  it('classifies the trend consistently with the rounding', () => {
    expect(variationTrend(1.2)).toBe('up');
    expect(variationTrend(-1.2)).toBe('down');
    expect(variationTrend(-0.004)).toBe('flat');
    expect(variationTrend(null)).toBe('none');
  });
});

describe('sparklinePoints', () => {
  it('spreads x evenly and maps min→bottom, max→top inside the padding', () => {
    expect(sparklinePoints([1, 2, 3], 100, 20, 2)).toEqual([
      { x: 2, y: 18 }, { x: 50, y: 10 }, { x: 98, y: 2 },
    ]);
  });

  it('draws a flat line in the middle when all rates are equal', () => {
    expect(sparklinePoints([5, 5], 100, 20, 2)).toEqual([{ x: 2, y: 10 }, { x: 98, y: 10 }]);
  });

  it('centers a single point and returns nothing for no data', () => {
    expect(sparklinePoints([5], 100, 20, 2)).toEqual([{ x: 50, y: 10 }]);
    expect(sparklinePoints([], 100, 20, 2)).toEqual([]);
  });
});

describe('rateSummary', () => {
  it('gives min, max and the latest (first, newest) rate', () => {
    expect(rateSummary([row(3, 37), row(2, 36.5), row(1, 38)])).toEqual({ min: 36.5, max: 38, last: 37 });
  });

  it('is null for an empty page', () => {
    expect(rateSummary([])).toBeNull();
  });
});

describe('sourceLabel', () => {
  it('names the known sources in Spanish and keeps unknown ones raw', () => {
    expect(sourceLabel('auto')).toBe('Automática');
    expect(sourceLabel('manual')).toBe('Manual');
    expect(sourceLabel('cron')).toBe('cron');
    expect(sourceLabel(null)).toBe('Sin origen');
  });
});
