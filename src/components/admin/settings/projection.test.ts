import { describe, it, expect } from 'vitest';
import { projectRevenue } from './projection';

describe('projectRevenue', () => {
  it('returns both extremes of a full day', () => {
    expect(projectRevenue(100, 7, 1)).toEqual({
      capacity: 100, allAdults: 700, allChildren: 100, min: 100, max: 700,
    });
  });

  it('orders min/max even if children cost more than adults', () => {
    const p = projectRevenue(10, 2, 5)!;
    expect(p.allAdults).toBe(20);
    expect(p.allChildren).toBe(50);
    expect(p.min).toBe(20);
    expect(p.max).toBe(50);
  });

  it('rounds to cents', () => {
    expect(projectRevenue(3, 0.1, 0.2)).toMatchObject({ allAdults: 0.3, allChildren: 0.6 });
  });

  it('is zero for a closed (capacity 0) day', () => {
    expect(projectRevenue(0, 7, 1)).toMatchObject({ min: 0, max: 0 });
  });

  it('returns null for invalid inputs', () => {
    expect(projectRevenue(Number.NaN, 7, 1)).toBeNull();
    expect(projectRevenue(10.5, 7, 1)).toBeNull();
    expect(projectRevenue(-1, 7, 1)).toBeNull();
    expect(projectRevenue(10, -1, 1)).toBeNull();
    expect(projectRevenue(10, 7, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
