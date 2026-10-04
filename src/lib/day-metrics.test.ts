import { describe, it, expect } from 'vitest';
import { occupancyLevel, occupancyPercent } from './day-metrics';

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
