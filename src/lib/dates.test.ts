import { describe, it, expect } from 'vitest';
import { shortDateEs, longDateEs } from './dates';

describe('spanish date formatting (Caracas)', () => {
  it('shortDateEs renders weekday + day + month', () => {
    // 2030-01-15 is a Tuesday
    expect(shortDateEs('2030-01-15').toLowerCase()).toContain('mar');
    expect(shortDateEs('2030-01-15')).toContain('15');
  });
  it('longDateEs spells out the month', () => {
    const s = longDateEs('2030-01-15').toLowerCase();
    expect(s).toContain('martes');
    expect(s).toContain('enero');
  });
});
