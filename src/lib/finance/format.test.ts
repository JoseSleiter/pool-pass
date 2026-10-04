// src/lib/finance/format.test.ts
import { describe, it, expect } from 'vitest';
import { EMPTY, caracasDateTime, formatBs, formatRate, formatUsd } from './format';

describe('caracasDateTime', () => {
  it('renders dd/mm/yyyy HH:MM in America/Caracas (UTC-4)', () => {
    expect(caracasDateTime('2026-10-04T14:05:00Z')).toBe('04/10/2026 10:05');
  });

  it('crosses midnight correctly', () => {
    expect(caracasDateTime('2026-10-04T03:59:00Z')).toBe('03/10/2026 23:59');
    expect(caracasDateTime('2026-10-04T04:00:00Z')).toBe('04/10/2026 00:00');
  });
});

describe('money and rates', () => {
  it('formats USD with two decimals', () => {
    expect(formatUsd(15)).toBe('$15.00');
    expect(formatUsd('35.5')).toBe('$35.50');
  });

  it('formats Bs. with two decimals, dash when missing', () => {
    expect(formatBs(1277.5)).toBe('Bs. 1277.50');
    expect(formatBs('547.5')).toBe('Bs. 547.50');
    expect(formatBs(null)).toBe(EMPTY);
  });

  it('formats BCV rates with four decimals, dash when missing', () => {
    expect(formatRate(36.5)).toBe('Bs. 36.5000');
    expect(formatRate('37.1234')).toBe('Bs. 37.1234');
    expect(formatRate(null)).toBe(EMPTY);
  });

  it('EMPTY is an em dash', () => {
    expect(EMPTY).toBe('—');
  });
});
