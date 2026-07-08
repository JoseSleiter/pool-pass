import { describe, it, expect } from 'vitest';
import { partyLabel, partyShort } from './party';

describe('partyLabel', () => {
  it('formats adults and children', () => {
    expect(partyLabel(2, 1)).toBe('2 adultos, 1 niño');
  });
  it('uses singular forms', () => {
    expect(partyLabel(1, 2)).toBe('1 adulto, 2 niños');
  });
  it('omits zero groups (child-only)', () => {
    expect(partyLabel(0, 3)).toBe('3 niños');
    expect(partyLabel(2, 0)).toBe('2 adultos');
  });
});

describe('partyShort', () => {
  it('formats compact admin labels', () => {
    expect(partyShort(2, 1)).toBe('2A 1N');
    expect(partyShort(0, 4)).toBe('4N');
    expect(partyShort(2, 0)).toBe('2A');
  });
});
