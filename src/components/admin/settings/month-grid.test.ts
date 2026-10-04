import { describe, it, expect } from 'vitest';
import { monthGrid, shiftMonth, monthLabelEs, WEEKDAYS_ES } from './month-grid';

describe('monthGrid', () => {
  it('builds Monday-first weeks padded with null (Oct 2026 starts on Thursday)', () => {
    const weeks = monthGrid('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('fits a 28-day February starting on Monday in exactly 4 weeks', () => {
    const weeks = monthGrid('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks[3][6]).toBe('2027-02-28');
  });

  it('handles a leap February', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });
});

describe('monthLabelEs', () => {
  it('is the Spanish month and year (lowercase; the UI uppercases the first letter)', () => {
    expect(monthLabelEs('2030-09')).toBe('septiembre de 2030');
  });
});

it('weekday headers start on Monday', () => {
  expect(WEEKDAYS_ES.map((d) => d.short)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
});
