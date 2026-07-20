import { describe, it, expect } from 'vitest';
import { shortDateEs, longDateEs, visitLabelEs } from './dates';

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
  it('visitLabelEs capitalizes tokens and keeps accents intact', () => {
    expect(visitLabelEs('2026-07-17')).toBe('Vie, 17 Jul 2026'); // Friday
    expect(visitLabelEs('2026-01-03')).toBe('Sáb, 03 Ene 2026'); // Saturday (accent)
    expect(visitLabelEs('2026-01-07')).toBe('Mié, 07 Ene 2026'); // Wednesday (accent)
  });
});
