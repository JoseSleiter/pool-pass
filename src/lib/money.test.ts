import { describe, it, expect } from 'vitest';
import { totalUsd, usdToVes, roundMoney } from './money';

describe('money', () => {
  it('computes total USD from attendee counts and prices', () => {
    expect(totalUsd(2, 3, { adult: 15, child: 5 })).toBe(45);
  });

  it('converts USD to VES at the given rate, rounded to 2 decimals', () => {
    expect(usdToVes(45, 36.1234)).toBe(1625.55); // 45 * 36.1234 = 1625.553
  });

  it('roundMoney fixes floating point residue', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});
