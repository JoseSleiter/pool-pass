import { describe, it, expect } from 'vitest';
import { PARTY_MIN, GROUP_MAX, canAddGuest, canRemoveGuest } from './party-limits';

describe('party limits (mirror bookingSchema: 0–20 per group, ≥ 1 in total)', () => {
  it('exposes the bounds', () => {
    expect(PARTY_MIN).toBe(1);
    expect(GROUP_MAX).toBe(20);
  });

  it('canAddGuest is false once that group reaches 20 (the other group does not count)', () => {
    expect(canAddGuest(0)).toBe(true);
    expect(canAddGuest(19)).toBe(true);
    expect(canAddGuest(20)).toBe(false);
  });

  it('canRemoveGuest needs someone in that group and keeps at least 1 person overall', () => {
    expect(canRemoveGuest(2, 2, 1)).toBe(true);
    expect(canRemoveGuest(1, 1, 1)).toBe(true); // the other group still has someone
    expect(canRemoveGuest(0, 0, 1)).toBe(false); // empty group
    expect(canRemoveGuest(1, 1, 0)).toBe(false); // last person
  });
});
