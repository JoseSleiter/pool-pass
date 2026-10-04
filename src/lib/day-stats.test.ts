import { describe, it, expect } from 'vitest';
import { bucketCheckinsByHour } from './day-stats';

type Row = Parameters<typeof bucketCheckinsByHour>[0][number];
const r = (over: Partial<Row>): Row => ({
  status: 'checked_in', checked_in_at: '2030-01-15T13:05:00Z', adults: 1, children: 0, ...over,
});

describe('bucketCheckinsByHour', () => {
  it('returns an empty list when nobody checked in', () => {
    expect(bucketCheckinsByHour([])).toEqual([]);
    expect(bucketCheckinsByHour([r({ status: 'confirmed', checked_in_at: null })])).toEqual([]);
  });

  it('sums people (adults + children) per Caracas hour, ascending, skipping empty hours', () => {
    expect(bucketCheckinsByHour([
      r({ checked_in_at: '2030-01-15T15:40:00Z', adults: 2, children: 1 }), // 11:40 Caracas
      r({ checked_in_at: '2030-01-15T13:05:00Z', adults: 2, children: 0 }), // 09:05
      r({ checked_in_at: '2030-01-15T13:55:00Z', adults: 0, children: 1 }), // 09:55
    ])).toEqual([
      { hour: 9, people: 3 },
      { hour: 11, people: 3 },
    ]);
  });

  it('ignores rows that are not checked_in or lack a timestamp', () => {
    expect(bucketCheckinsByHour([
      r({ status: 'confirmed' }),
      r({ checked_in_at: null }),
      r({ adults: 4 }),
    ])).toEqual([{ hour: 9, people: 4 }]);
  });
});
